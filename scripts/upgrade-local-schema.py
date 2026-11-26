#!/usr/bin/env python3
"""Upgrade an existing local Docker stack with a verified private backup.
Never prints secret configuration, resets volumes, or sends test emails.
Requires Docker Compose, Python 3 and JDK 21. All logs/backups stay under ignored local/.
"""
import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time
import uuid
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SERVICES = ('identity', 'work', 'notification')
WRITERS = ('frontend', 'api-gateway', 'identity-service', 'work-service', 'notification-service')


def command(args, **kwargs):
    return subprocess.run(args, check=True, cwd=ROOT, **kwargs)


def capture(args):
    return command(args, capture_output=True, text=True).stdout.strip()


def private(path):
    path.chmod(0o700 if path.is_dir() else 0o600)
    return path


def inspect(container):
    return json.loads(capture(['docker', 'inspect', container]))[0]


def sql(container, query):
    return command(['docker', 'exec', '-i', container, 'sh', '-c',
                    'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot -N -B'], input=query, capture_output=True, text=True).stdout.strip()


def snapshot(container):
    tables = sql(container, "SELECT TABLE_SCHEMA,TABLE_NAME FROM information_schema.TABLES WHERE TABLE_TYPE='BASE TABLE' AND TABLE_SCHEMA IN ('tasknest_identity','tasknest_work','tasknest_notification') ORDER BY 1,2;").splitlines()
    counts = {}
    for row in tables:
        db, table = row.split('\t')
        counts[row] = int(sql(container, f'SELECT COUNT(*) FROM `{db}`.`{table}`;'))
    # Normalize only the documented legacy numeric -> UUID mapping before comparing.
    users = []
    if 'tasknest_identity\tusers' in counts:
        raw = sql(container, "SELECT id,SHA2(CONCAT_WS('|',full_name,email,password_hash,is_email_verified),256) FROM tasknest_identity.users;")
        for row in raw.splitlines():
            user_id, digest = row.split('\t')
            if user_id.isdecimal():
                user_id = str(uuid.UUID(bytes=hashlib.md5(('tasknest:user:' + user_id).encode()).digest(), version=3))
            users.append(user_id + ':' + digest)
    return {'counts': counts, 'accounts_digest': hashlib.sha256('\n'.join(sorted(users)).encode()).hexdigest()}


def verify_data(before, after, container):
    for table, count in before['counts'].items():
        if not table.endswith('\tflyway_schema_history'):
            if after['counts'].get(table) != count:
                raise RuntimeError('Existing row count changed: ' + table.replace('\t', '.'))
    if after['accounts_digest'] != before['accounts_digest']:
        raise RuntimeError('Existing account data changed')
    for service in SERVICES:
        folder = ROOT / f'services/{service}-service/src/main/resources/db/migration'
        expected = str(max(int(p.name.split('__')[0][1:]) for p in folder.glob('V*.sql')))
        actual = sql(container, f'SELECT version FROM tasknest_{service}.flyway_schema_history WHERE success=1 AND version IS NOT NULL ORDER BY installed_rank DESC LIMIT 1;')
        if actual != expected:
            raise RuntimeError('Unexpected Flyway version for ' + service)
    if sql(container, 'SELECT COUNT(*) FROM tasknest_work.projects p LEFT JOIN tasknest_work.project_storage_usage s ON s.project_id=p.id WHERE s.project_id IS NULL;') != '0':
        raise RuntimeError('Project quota backfill incomplete')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--skip-build', action='store_true', help='Only if Java verify already succeeded for the current source; JAR migration contents are still checked')
    args = parser.parse_args()
    os.chdir(ROOT)
    if not (ROOT / '.env').is_file():
        raise RuntimeError('Missing .env. Follow docs/database/TEAM_SCHEMA_UPGRADE.md for first-time setup.')
    jdk = Path(os.environ['JAVA_HOME']) / 'bin' if os.environ.get('JAVA_HOME') else None
    java = str(jdk / ('java.exe' if os.name == 'nt' else 'java')) if jdk else shutil.which('java')
    javac = str(jdk / ('javac.exe' if os.name == 'nt' else 'javac')) if jdk else shutil.which('javac')
    version = subprocess.run([java or 'java', '-version'], capture_output=True, text=True, check=True)
    if not javac or not re.search(r'version "21(?:[.\-"])', version.stderr + version.stdout):
        raise RuntimeError('Set JAVA_HOME to JDK 21 before running this command.')
    probe = ['docker', 'compose', '--env-file', '.env', '-f', 'infra/compose/compose.yml']
    mysql = capture(probe + ['ps', '--quiet', 'mysql'])
    if not mysql:
        raise RuntimeError('No running MySQL stack. Use first-time setup instructions; this script upgrades existing Docker data.')
    info = inspect(mysql)
    if info['State'].get('Health', {}).get('Status') != 'healthy':
        raise RuntimeError('MySQL must be healthy before upgrading.')
    compose_files = info['Config']['Labels']['com.docker.compose.project.config_files'].split(',')
    compose = ['docker', 'compose', '--env-file', '.env']
    for filename in compose_files:
        if not Path(filename).is_file():
            raise RuntimeError('Running Compose file is unavailable: ' + filename)
        compose += ['-f', filename]
    # Capture configuration in memory only; never print compose config or container env.
    config = json.loads(capture(compose + ['config', '--format', 'json']))
    live_env = dict(item.split('=', 1) for item in info['Config']['Env'] if '=' in item)
    configured_env = config['services']['mysql']['environment']
    for key in ('MYSQL_ROOT_PASSWORD', 'IDENTITY_DB_PASSWORD', 'WORK_DB_PASSWORD', 'NOTIFICATION_DB_PASSWORD'):
        if configured_env.get(key) != live_env.get(key):
            raise RuntimeError('Local credentials differ from the running MySQL environment. Resolve ' + key + ' without resetting volumes.')
    file_table = sql(mysql, "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='tasknest_work' AND TABLE_NAME='stored_files';")
    if file_table == '1' and sql(mysql, 'SELECT COUNT(*) FROM tasknest_work.stored_files;') != '0':
        raise RuntimeError('Work already has file metadata. Use the coordinated database + file-volume backup procedure in docs/database/TEAM_SCHEMA_UPGRADE.md before upgrading.')
    stamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S') + '-' + uuid.uuid4().hex[:6]
    backup = ROOT / 'local' / 'schema-backups' / stamp
    backup.mkdir(parents=True)
    private(backup)
    state = {'phase': 'preparing', 'compose_files': compose_files, 'backup': str(backup)}

    def phase(value):
        state['phase'] = value
        p = backup / 'state.json'
        p.write_text(json.dumps(state, indent=2))
        private(p)
        print(value, flush=True)

    clone = 'tasknest-schema-restore-' + uuid.uuid4().hex[:10]
    runner_name = 'tasknest-schema-migration-' + uuid.uuid4().hex[:10]
    runtime_env = backup / 'migration.env'
    writers_stopped = False
    try:
        phase('Building and verifying Java services (applications still running)')
        if not args.skip_build:
            wrapper = ROOT / ('mvnw.cmd' if os.name == 'nt' else 'mvnw')
            with (backup / 'build.log').open('w') as log:
                command([str(wrapper), '-B', 'verify'], stdout=log, stderr=subprocess.STDOUT)
        context = backup / 'runner'
        libs = context / 'lib'
        libs.mkdir(parents=True)
        for service in SERVICES:
            jar = ROOT / f'services/{service}-service/target/{service}-service-0.1.0-SNAPSHOT.jar'
            with zipfile.ZipFile(jar) as archive:
                for migration in (ROOT / f'services/{service}-service/src/main/resources/db/migration').glob('V*.sql'):
                    if archive.read('BOOT-INF/classes/db/migration/' + migration.name) != migration.read_bytes():
                        raise RuntimeError('Stale JAR migration; run Java verify again: ' + service)
                if service == 'identity':
                    for name in archive.namelist():
                        if name.startswith('BOOT-INF/lib/') and name.endswith('.jar'):
                            (libs / Path(name).name).write_bytes(archive.read(name))
            shutil.copytree(ROOT / f'services/{service}-service/src/main/resources/db/migration', context / 'migrations' / service)
        command([javac, '-cp', str(libs / '*'), '-d', str(context), str(ROOT / 'scripts/java/MigrateSchema.java')], capture_output=True)
        # Retain previous binaries/env before rebuilding image tags. These private files are for rollback only.
        rollback = backup / 'previous-containers'
        rollback.mkdir()
        for service in ('identity-service', 'work-service', 'notification-service', 'api-gateway'):
            cid = capture(compose + ['ps', '--all', '--quiet', service])
            if cid:
                p = rollback / (service + '.json')
                p.write_text(json.dumps(inspect(cid), indent=2)); private(p)
                command(['docker', 'cp', cid + ':/app/app.jar', str(rollback / (service + '.jar'))], capture_output=True)
                private(rollback / (service + '.jar'))
        with (backup / 'images.log').open('w') as log:
            command(compose + ['build', 'identity-service', 'work-service', 'notification-service', 'api-gateway'], stdout=log, stderr=subprocess.STDOUT)
        phase('Stopping application writers; MySQL and broker stay running')
        command(compose + ['stop', *WRITERS])
        writers_stopped = True
        before = snapshot(mysql)
        p = backup / 'before.json'; p.write_text(json.dumps(before, indent=2)); private(p)
        dump = backup / 'databases.sql'
        with dump.open('wb') as output:
            command(['docker', 'exec', mysql, 'sh', '-c',
                     'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump -uroot --single-transaction --routines --triggers --events --hex-blob --set-gtid-purged=OFF --databases tasknest_identity tasknest_work tasknest_notification'], stdout=output)
        private(dump)
        runtime_env.write_text('MYSQL_ROOT_PASSWORD=' + live_env['MYSQL_ROOT_PASSWORD'] + '\nTASKNEST_MIGRATION_PASSWORD=' + live_env['MYSQL_ROOT_PASSWORD'] + '\n')
        private(runtime_env)
        image = config['services']['work-service'].get('image') or info['Config']['Labels']['com.docker.compose.project'] + '-work-service'

        def migrate(target, label):
            with (backup / (label + '.log')).open('w') as log:
                command(['docker', 'run', '--rm', '--name', runner_name, '--user', '0:0',
                         '--network', 'container:' + target, '--env-file', str(runtime_env),
                         '--mount', 'type=bind,src=' + str(context) + ',dst=/runner,readonly',
                         '--entrypoint', 'java', image, '-cp', '/runner:/runner/lib/*', 'MigrateSchema'], stdout=log, stderr=subprocess.STDOUT)

        phase('Restoring backup and checking migrations on an isolated MySQL clone')
        command(['docker', 'run', '-d', '--name', clone, '--network', 'none', '--tmpfs', '/var/lib/mysql',
                 '--env-file', str(runtime_env), 'mysql:8.4'], capture_output=True)
        for _ in range(90):
            try:
                sql(clone, 'SELECT 1;')
                break
            except subprocess.CalledProcessError:
                time.sleep(1)
        else:
            raise RuntimeError('Restore-check MySQL startup timed out')
        with dump.open('rb') as source:
            command(['docker', 'exec', '-i', clone, 'sh', '-c', 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot'], stdin=source)
        if snapshot(clone) != before:
            raise RuntimeError('Backup restore does not match the original snapshot')
        migrate(clone, 'clone-migration')
        verify_data(before, snapshot(clone), clone)
        phase('Backup restore verified; applying live Flyway migrations')
        migrate(mysql, 'live-migration')
        after = snapshot(mysql)
        verify_data(before, after, mysql)
        p = backup / 'after.json'; p.write_text(json.dumps(after, indent=2)); private(p)
        phase('Live data verified; starting upgraded services')
        command(compose + ['up', '-d', '--no-deps', '--wait', '--wait-timeout', '180',
                           'identity-service', 'work-service', 'notification-service'])
        command(compose + ['up', '-d', '--no-deps', '--wait', '--wait-timeout', '120', 'api-gateway', 'frontend'])
        phase('Waiting for Gateway routes and Eureka registration')
        gateway = capture(compose + ['ps', '--quiet', 'api-gateway'])
        gateway_env = dict(item.split('=', 1) for item in inspect(gateway)['Config']['Env'] if '=' in item)
        gateway_port = gateway_env.get('SERVER_PORT', '8080')
        for _ in range(30):
            try:
                for route in ('/api/status', '/api/identity/status', '/api/work/status', '/api/notifications/status'):
                    command(['docker', 'exec', gateway, 'curl', '-fsS', '--max-time', '3',
                             'http://127.0.0.1:' + gateway_port + route], capture_output=True)
                break
            except subprocess.CalledProcessError:
                time.sleep(2)
        else:
            raise RuntimeError('Containers are healthy but Gateway routes are not ready; inspect Eureka registration')
        writers_stopped = False
        phase('COMPLETE: all service schemas match current Flyway migrations')
        print('Private backup and rollout logs: ' + str(backup), flush=True)
    except Exception:
        if writers_stopped:
            subprocess.run(compose + ['stop', *WRITERS], cwd=ROOT, capture_output=True)
            print('Upgrade stopped on error. Writers are stopped; do not repair/reset/retry blindly. Inspect private logs and restore instructions.', file=sys.stderr)
        print('Private backup/log folder: ' + str(backup), file=sys.stderr)
        raise
    finally:
        for name in (runner_name, clone):
            subprocess.run(['docker', 'rm', '-f', '-v', name], capture_output=True)
        runtime_env.unlink(missing_ok=True)
        # Keep dump/old binaries/logs; temporary library extraction is reproducible and large.
        shutil.rmtree(backup / 'runner', ignore_errors=True)


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""Validate the complete Flyway DDL chain and invariants on a disposable MySQL 8.4 container only.
No project .env, shared volume, application database or third-party Python package.
Optional --service-startup uses a temporary loopback port and the actual built service JARs.
"""
from auth_secrets import generate_auth_secrets
from check_uuid_upgrade import check_uuid_upgrade
from check_collaboration_schema import check_collaboration_schema
from export_schema_docs import export_schema_docs
from auth_integration_checks import AuthChecks, check_v2_upgrade
import re
import argparse
import os
from pathlib import Path
import secrets
import subprocess
import tempfile
import time
import uuid

ROOT = Path(__file__).resolve().parents[1]
DBS = {name: f'tasknest_{name}' for name in ('identity', 'work', 'notification')}
container = None
checks = 0


def migration_files(service):
    directory = ROOT / f'services/{service}-service/src/main/resources/db/migration'
    return sorted(directory.glob('V*.sql'), key=lambda migration: tuple(
        int(part) for part in re.split(r'[._]', migration.name.split('__', 1)[0][1:])
    ))


def sql(statement, db=None, *, rejects=None):
    global checks
    args = ['docker', 'exec', '-i', '-e', 'MYSQL_PWD', container, 'mysql', '-uroot', '--batch', '--skip-column-names']
    if db:
        args.append(DBS.get(db, db))
    result = subprocess.run(args, input="SET SESSION time_zone = '+00:00';\n" + statement,
                            text=True, capture_output=True, timeout=30)
    if rejects is not None:
        assert result.returncode != 0 and f'ERROR {rejects} ' in result.stderr, result.stderr or result.stdout
        checks += 1
    elif result.returncode:
        raise AssertionError(result.stderr)
    return result.stdout.strip()


def expect(statement, expected, db):
    global checks
    actual = sql(statement, db)
    assert actual == str(expected), f'Expected {expected!r}; got {actual!r}'
    checks += 1


def test_identity():
    sql("INSERT INTO users(id,full_name,email,password_hash) VALUES (1,'Nguyễn An','an@example.test','test-hash'),(2,'Trần Bình','binh@example.test','test-hash');", 'identity')
    sql("INSERT INTO users(id,full_name,email,password_hash) VALUES (UUID(),'Nguyễn An','an@example.test','hash');", 'identity', rejects=1062)
    sql("INSERT INTO users(id,full_name,email,password_hash) VALUES (UUID(),'Nguyễn An','UPPER@example.test','hash');", 'identity', rejects=3819)
    sql("INSERT INTO users(id,full_name,email,password_hash,is_email_verified) VALUES (UUID(),'Nguyễn An','other@example.test','hash',1);", 'identity', rejects=3819)
    for n in (1, 2):
        sql(f"INSERT INTO auth_sessions(id,user_id,created_at,expires_at,last_seen_at) VALUES ('session-{n}',1,'2026-10-20','2026-10-27','2026-10-20');", 'identity')
    sql("INSERT INTO auth_sessions(id,user_id,created_at,expires_at,last_seen_at) VALUES ('too-long',1,'2026-10-20','2026-10-28','2026-10-20');", 'identity', rejects=3819)
    sql("INSERT INTO refresh_tokens(id,session_id,token_hash,created_at) VALUES ('rt1','session-1',UNHEX(SHA2('rt1',256)),'2026-10-20');", 'identity')
    sql("INSERT INTO refresh_tokens(id,session_id,token_hash,created_at) VALUES ('rt2','session-1',UNHEX(SHA2('rt2',256)),'2026-10-21');", 'identity', rejects=1062)
    sql("START TRANSACTION; UPDATE refresh_tokens SET consumed_at='2026-10-21' WHERE id='rt1'; INSERT INTO refresh_tokens(id,session_id,token_hash,created_at) VALUES ('rt2','session-1',UNHEX(SHA2('rt2',256)),'2026-10-21'); UPDATE refresh_tokens SET replaced_by_id='rt2' WHERE id='rt1'; COMMIT;", 'identity')
    expect("SELECT COUNT(*) FROM refresh_tokens WHERE active_session_id='session-1';", 1, 'identity')
    sql("INSERT INTO refresh_tokens(id,session_id,token_hash,created_at) VALUES ('rt-other','session-2',UNHEX(SHA2('rt-other',256)),'2026-10-20');", 'identity')
    sql("UPDATE refresh_tokens SET replaced_by_id='rt-other' WHERE id='rt1';", 'identity', rejects=1452)
    token = "INSERT INTO account_tokens(user_id,purpose,token_hash,created_at,expires_at) VALUES (1,'EMAIL_VERIFICATION',UNHEX(SHA2('verify',256)),'2026-10-20','2026-10-21');"
    sql(token, 'identity')
    sql(token.replace("'verify'", "'verify2'"), 'identity', rejects=1062)
    sql(token.replace("'verify'", "'verify3'").replace("'2026-10-21'", "'2026-10-22'"), 'identity', rejects=3819)
    sql("UPDATE account_tokens SET revoked_at='2026-10-20 00:01:00';" + token.replace("'verify'", "'verify2'"), 'identity')


def test_work():
    project = "INSERT INTO projects(id,owner_user_id,name,description,starts_on,ends_on) VALUES ({id},1,'{name}','Mô tả dự án kiểm thử','2026-10-19','2026-11-15');"
    sql(project.format(id=1, name='TaskNest'), 'work')
    sql(project.format(id=2, name=' tasknest '), 'work', rejects=1062)
    sql(project.format(id=2, name='Dự án hai'), 'work')
    sql("UPDATE projects SET manager_user_id=owner_user_id WHERE id=1;", 'work', rejects=3819)
    sql("UPDATE projects SET ends_on='2026-10-18' WHERE id=1;", 'work', rejects=3819)
    sql("START TRANSACTION;" + project.format(id=3, name='Rollback project') + "ROLLBACK;", 'work')
    expect('SELECT COUNT(*) FROM projects WHERE id=3;', 0, 'work')
    sql("UPDATE projects SET status='ARCHIVED',archived_at='2026-10-27',archived_by=1 WHERE id=1;" + project.format(id=3, name='tasknest'), 'work')
    sql("UPDATE projects SET status='ACTIVE',archived_at=NULL,archived_by=NULL WHERE id=1;", 'work', rejects=1062)
    sql("UPDATE projects SET name='TaskNest new' WHERE id=3; UPDATE projects SET status='ACTIVE',archived_at=NULL,archived_by=NULL WHERE id=1;", 'work')
    sql("INSERT INTO project_memberships(project_id,user_id,joined_at,added_by) VALUES (1,1,'2026-10-19',1),(1,2,'2026-10-19',1),(2,1,'2026-10-19',1);", 'work')
    task = "INSERT INTO tasks(id,project_id,name,assignee_user_id,created_by,starts_on,deadline_on,estimated_seconds) VALUES ({id},{project},'{name}',{user},1,'2026-10-19','2026-11-01',{estimate});"
    for n, p, u in [(1,1,1),(2,2,1),(3,1,2)]:
        sql(task.format(id=n,project=p,name=f'Task {n}',user=u,estimate=3600), 'work')
    sql(task.format(id=4,project=1,name=' task 1 ',user=1,estimate=3600), 'work', rejects=1062)
    sql(task.format(id=4,project=2,name='Wrong assignee',user=2,estimate=3600), 'work', rejects=1452)
    sql(task.format(id=4,project=1,name='Zero estimate',user=1,estimate=0), 'work', rejects=3819)
    sql("UPDATE tasks SET status='DONE',completed_at='2026-10-27' WHERE id=1;", 'work', rejects=3819)
    sql("INSERT INTO project_invitation_links(id,project_id,public_code,created_by,created_at) VALUES (1,1,REPEAT('a',64),1,'2026-10-20');", 'work')
    sql("INSERT INTO project_invitation_links(project_id,public_code,created_by,created_at) VALUES (1,REPEAT('b',64),1,'2026-10-20');", 'work', rejects=1062)
    invite = "INSERT INTO project_invitations(project_id,invitee_user_id,invited_by,created_at,expires_at) VALUES (1,3,1,'2026-10-20','2026-10-27');"
    sql(invite, 'work'); sql(invite, 'work', rejects=1062)
    join = "INSERT INTO project_join_requests(project_id,user_id,invitation_link_id,created_at) VALUES (1,3,1,'2026-10-20');"
    sql(join, 'work'); sql(join, 'work', rejects=1062)
    sql("UPDATE project_invitation_links SET status='REVOKED',revoked_at='2026-10-21',revocation_reason='ROTATED' WHERE id=1;", 'work')
    expect("SELECT COUNT(*) FROM project_join_requests WHERE status='PENDING';", 1, 'work')
    sub = "INSERT INTO task_submissions(id,project_id,task_id,submission_no,submitted_by,assignee_user_id,result_note,deadline_on_snapshot,submitted_at) VALUES ({id},1,{task},{num},1,1,'Kết quả kiểm thử','2026-11-01','2026-10-25');"
    sql(sub.format(id=1,task=1,num=1), 'work')
    sql(sub.format(id=2,task=1,num=2), 'work', rejects=1062)
    sql("UPDATE tasks SET latest_submission_id=1 WHERE id=3;", 'work', rejects=1452)
    sql("START TRANSACTION; UPDATE task_submissions SET decision='ACCEPTED',reviewed_by=1,reviewed_at='2026-10-26' WHERE id=1; UPDATE tasks SET status='DONE',latest_submission_id=1,accepted_submission_id=1,completed_at='2026-10-26' WHERE id=1; COMMIT;", 'work')
    sql("UPDATE tasks SET status='IN_PROGRESS',accepted_submission_id=NULL,completed_at=NULL WHERE id=1;", 'work')
    expect("SELECT COUNT(*) FROM task_submissions WHERE task_id=1 AND decision='ACCEPTED';",1,'work')
    sql(sub.format(id=2,task=1,num=2), 'work')
    timer = "INSERT INTO time_entries(project_id,task_id,user_id,source,started_at,created_by,updated_by) VALUES ({project},{task},1,'TIMER','2026-10-26 01:00:00',1,1);"
    sql(timer.format(project=1,task=1), 'work')
    sql(timer.format(project=2,task=2), 'work', rejects=1062)
    sql("UPDATE time_entries SET ended_at='2026-10-26 02:00:00' WHERE id=1;", 'work')
    expect('SELECT duration_microseconds FROM time_entries WHERE id=1;',3600000000,'work')
    sql("UPDATE time_entries SET ended_at='2026-10-25' WHERE id=1;", 'work', rejects=3819)
    sql("INSERT INTO time_entries(project_id,task_id,user_id,source,started_at,created_by,updated_by) VALUES (1,1,1,'MANUAL','2026-10-26',1,1);", 'work', rejects=3819)
    sql("INSERT INTO time_entry_revisions(time_entry_id,revised_by,before_started_at,after_started_at,reason,revised_at) VALUES (1,1,'2026-10-26','2026-10-26','','2026-10-27');", 'work', rejects=3819)
    sql("INSERT INTO task_comments(id,project_id,task_id,author_user_id,body,creation_request_id,request_hash) VALUES (1,1,1,1,'Bình luận',UUID(),UNHEX(SHA2('comment-1',256)));", 'work')
    sql("UPDATE task_comments SET body=REPEAT('a',2001) WHERE id=1;", 'work', rejects=3819)
    sql("UPDATE task_comments SET deleted_at='2026-10-27',deleted_by=author_user_id,body=NULL WHERE id=1;", 'work')
    alert = "INSERT INTO task_alerts(project_id,task_id,alert_type,raised_at) VALUES (1,1,'RISK','2026-10-27');"
    sql(alert,'work'); sql(alert,'work',rejects=1062)
    sql("INSERT INTO task_alerts(project_id,task_id,alert_type,submission_id,raised_at) VALUES (1,1,'REVIEW_OVERDUE',2,'2026-11-02');", 'work')
    due_soon = "INSERT INTO task_alerts(project_id,task_id,alert_type,deadline_on_snapshot,raised_at) VALUES (1,1,'DUE_SOON','2026-11-01','2026-10-31');"
    sql(due_soon, 'work'); sql(due_soon, 'work', rejects=1062)
    sql("INSERT INTO task_alerts(project_id,task_id,alert_type,deadline_on_snapshot,raised_at) VALUES (1,1,'DUE_SOON','2026-11-05','2026-11-04');", 'work')
    sql("INSERT INTO task_alerts(project_id,task_id,alert_type,raised_at) VALUES (1,1,'DUE_SOON','2026-10-31');", 'work', rejects=3819)


def test_notification():
    notification = "INSERT INTO notifications(id,recipient_user_id,event_id,event_type,resource_type,resource_id,title,body) VALUES (1,1,'event-1','task.assigned','TASK','1','Thông báo','Được giao nhiệm vụ');"
    sql(notification, 'notification')
    sql(notification.replace('VALUES (1,', 'VALUES (2,'), 'notification', rejects=1062)
    job = "INSERT INTO email_jobs(id,event_id,recipient_user_id,recipient_email,event_type,purpose,notification_id,template_key,template_data) VALUES (1,'event-1',1,'an@example.test','task.assigned','TASK_EVENT',1,'assigned',JSON_OBJECT());"
    sql(job,'notification')
    sql(job.replace('VALUES (1,','VALUES (2,'),'notification',rejects=1062)
    sql(job.replace("VALUES (1,'event-1'", "VALUES (2,'event-2'").replace("'task.assigned'", "'task.comment.created'").replace(",1,'assigned'", ",NULL,'assigned'"), 'notification', rejects=3819)
    sql("UPDATE email_jobs SET sensitive_data=X'01' WHERE id=1;", 'notification', rejects=3819)
    sql("UPDATE email_jobs SET notification_id=1,recipient_user_id=2 WHERE id=1;", 'notification', rejects=1452)
    attempt = "INSERT INTO email_delivery_attempts(email_job_id,attempt_no,started_at) VALUES (1,1,'2026-10-27');"
    sql(attempt,'notification'); sql(attempt,'notification',rejects=1062)
    receipt = "INSERT INTO email_provider_events(dedupe_hash,provider_message_id,email_job_id,event_type,occurred_at) VALUES (UNHEX(SHA2('receipt',256)),'test-message',1,'delivered','2026-10-27');"
    sql(receipt,'notification'); sql(receipt,'notification',rejects=1062)


def test_common():
    for db in DBS:
        event = "INSERT INTO outbox_events(event_id,aggregate_type,aggregate_id,aggregate_version,event_type,occurred_at,payload) VALUES ('event-1','TEST','1',1,'test.created','2026-10-27',JSON_OBJECT());"
        sql(event,db); sql(event,db,rejects=1062)
        sql("UPDATE outbox_events SET sensitive_payload=X'01' WHERE event_id='event-1';",db,rejects=3819)
        done = "INSERT INTO processed_events(consumer_name,event_id,event_type) VALUES ('test','event-1','test.created');"
        sql(done,db); sql(done,db,rejects=1062)
        sql("INSERT INTO processed_events(consumer_name,event_id,event_type) VALUES ('other-consumer','event-1','test.created');",db)
    expect("SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema LIKE 'tasknest_%' AND constraint_schema <> unique_constraint_schema;",0,'work')


def test_concurrent_timer():
    global checks
    # Both sessions start together; the unique generated key resolves the actual race.
    sql('DELETE FROM time_entries WHERE id <> 1;', 'work')
    statement = "SET SESSION time_zone='+00:00'; SELECT SLEEP(0.3); INSERT INTO time_entries(project_id,task_id,user_id,source,started_at,created_by,updated_by) VALUES ({p},{t},1,'TIMER','2026-10-26 03:00:00',1,1);"
    processes = []
    for p, t in ((1,1),(2,2)):
        proc = subprocess.Popen(['docker','exec','-i','-e','MYSQL_PWD',container,'mysql','-uroot',DBS['work']], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        proc.stdin.write(statement.format(p=p,t=t)); proc.stdin.close(); proc.stdin = None
        processes.append(proc)
    results = [(proc, proc.communicate(timeout=30)) for proc in processes]
    assert sorted(proc.returncode for proc,_ in results) == [0,1], results
    assert any('ERROR 1062 ' in stderr for _,(_,stderr) in results), results
    checks += 1
    expect('SELECT COUNT(*) FROM time_entries WHERE ended_at IS NULL;',1,'work')



def verify_service_startup(service, port, password):
    """Run the actual packaged service twice: initial Flyway migrate then validate/restart."""
    jar = ROOT / f'services/{service}-service/target/{service}-service-0.1.0-SNAPSHOT.jar'
    if not jar.is_file():
        raise RuntimeError(f'Build service JARs with ./mvnw -B verify first: {jar}')
    username = f'test_{service}'
    db = DBS[service]
    sql(f"CREATE USER '{username}'@'%' IDENTIFIED BY '{password}'; GRANT ALL PRIVILEGES ON {db}.* TO '{username}'@'%';")
    env = os.environ.copy()
    env.update(generate_auth_secrets())
    env.update(AUTH_LOGIN_ACCOUNT_ATTEMPTS='10', AUTH_LOGIN_ADDRESS_ATTEMPTS='100',
               AUTH_LOGIN_WINDOW_SECONDS='900', AUTH_REFRESH_SESSION_ATTEMPTS='3',
               AUTH_REFRESH_ADDRESS_ATTEMPTS='100', AUTH_REFRESH_WINDOW_SECONDS='60')
    env.update(DB_HOST='127.0.0.1', DB_PORT=port, DB_NAME=db, DB_USERNAME=username,
               DB_PASSWORD=password, SCAFFOLD_SECURITY_PASSWORD=password,
               CONFIG_USERNAME='unused', CONFIG_PASSWORD=password,
               RABBITMQ_USERNAME='unused', RABBITMQ_PASSWORD=password,
               SPRING_CONFIG_IMPORT='', SPRING_APPLICATION_NAME=f'{service}-service',
               SPRING_SECURITY_USER_PASSWORD=password)
    java_home = env.get('JAVA_HOME')
    java = str(Path(java_home) / 'bin/java') if java_home else 'java'
    command = [java, '-Xmx256m', '-jar', str(jar),
               '--spring.cloud.config.enabled=false', '--spring.cloud.config.import-check.enabled=false', '--eureka.client.enabled=false',
               '--spring.config.location=' + (ROOT / f'infra/config-repo/{service}-service.yml').as_uri(),
               '--server.address=127.0.0.1', '--server.port=0', '--tasknest.files.root='+str(Path(tempfile.gettempdir())/container/'files'),
               '--management.server.address=127.0.0.1', '--management.server.port=0',
               '--management.endpoint.health.group.readiness.include=readinessState,db',
               '--spring.rabbitmq.dynamic=false', '--management.health.rabbit.enabled=false']
    auth_checks = None
    for run in range(2):
        with tempfile.TemporaryFile(mode='w+') as log:
            proc = subprocess.Popen(command, env=env, cwd=ROOT, stdout=log, stderr=subprocess.STDOUT)
            try:
                deadline = time.monotonic() + 60
                while time.monotonic() < deadline:
                    log.seek(0)
                    output = log.read()
                    if 'Started ' in output and 'Application in ' in output:
                        break
                    if proc.poll() is not None:
                        raise RuntimeError(output.replace(password, '[redacted]'))
                    time.sleep(0.5)
                else:
                    raise RuntimeError('Service startup timed out: ' + output.replace(password, '[redacted]'))
                expect('SELECT GROUP_CONCAT(version ORDER BY installed_rank) FROM flyway_schema_history WHERE success=1;', ','.join(m.name.split('__')[0][1:] for m in migration_files(service)), service)
                if service == 'identity':
                    app_port = int(re.search(r'Tomcat started on port (\d+)', output).group(1))
                    if run == 0:
                        auth_checks = AuthChecks(app_port, sql)
                        auth_checks.first_start()
                    else:
                        auth_checks.after_restart(app_port)
                print(f'PASS: {service}-service Flyway migrate/validate and JPA startup (run {run + 1})', flush=True)
            finally:
                if proc.poll() is None:
                    proc.terminate()
                    try:
                        proc.wait(timeout=15)
                    except subprocess.TimeoutExpired:
                        proc.kill()
                        proc.wait(timeout=5)

    if auth_checks is not None:
        auth_checks.clean_fixtures()



def test_concurrent_quota():
    global checks
    sql('UPDATE project_storage_usage SET used_bytes=0,reserved_bytes=524287999 WHERE project_id=1;', 'work')
    processes = []
    for _ in range(2):
        proc = subprocess.Popen(['docker','exec','-i','-e','MYSQL_PWD',container,'mysql','-uroot',DBS['work']], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        proc.stdin.write('SELECT SLEEP(0.3); UPDATE project_storage_usage SET reserved_bytes=reserved_bytes+1 WHERE project_id=1;')
        proc.stdin.close(); proc.stdin = None; processes.append(proc)
    results = [(proc,proc.communicate(timeout=30)) for proc in processes]
    assert sorted(proc.returncode for proc,_ in results) == [0,1], results
    assert any('ERROR 3819 ' in stderr for _,(_,stderr) in results), results
    checks += 1
    expect('SELECT reserved_bytes FROM project_storage_usage WHERE project_id=1;',524288000,'work')
    sql('UPDATE project_storage_usage SET reserved_bytes=0 WHERE project_id=1;', 'work')

def main():
    global container
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--service-startup', action='store_true', help='Migrate using built service JARs, validate restart; needs Java 21 and temporary loopback MySQL port')
    parser.add_argument('--export-docs', action='store_true', help='After passing checks, regenerate tracked physical schema dictionary and DDL snapshot')
    args = parser.parse_args()
    # Pass generated credentials via environment, never in command arguments or project config.
    env = os.environ.copy()
    password = secrets.token_hex(24)
    env.update(MYSQL_ROOT_PASSWORD=password)
    os.environ['MYSQL_PWD'] = password
    name = 'tasknest-schema-test-' + uuid.uuid4().hex[:12]
    network_args = ['--publish', '127.0.0.1::3306'] if args.service_startup else ['--network', 'none']
    result = subprocess.run(['docker','run','--detach',*network_args,'--tmpfs','/var/lib/mysql:rw','--name',name,
                             '--label','vn.tasknest.purpose=schema-test','-e','MYSQL_ROOT_PASSWORD','mysql:8.4'],
                            env=env,text=True,capture_output=True,timeout=60)
    if result.returncode:
        raise RuntimeError(result.stderr)
    container = result.stdout.strip()
    try:
        deadline = time.monotonic() + 90
        while time.monotonic() < deadline:
            ready = subprocess.run(['docker','exec','-e','MYSQL_PWD',container,'mysql','-uroot','--protocol=TCP','-h127.0.0.1','--batch','-e','SELECT 1'],capture_output=True,timeout=10)
            if ready.returncode == 0:
                break
            state = subprocess.run(['docker','inspect','--format','{{.State.Running}}',container], capture_output=True, text=True, timeout=10)
            if state.stdout.strip() != 'true':
                break
            time.sleep(1)
        if ready.returncode != 0:
            logs = subprocess.run(['docker','logs','--tail','50',container], capture_output=True, text=True, timeout=10)
            raise RuntimeError('Isolated MySQL readiness failed: ' + logs.stdout.replace(password, '[redacted]') + logs.stderr.replace(password, '[redacted]'))
        check_uuid_upgrade(ROOT, sql)
        if args.service_startup:
            check_v2_upgrade(ROOT, sql)
        for service, db in DBS.items():
            sql(f'CREATE DATABASE {db} CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_ci;')
            if args.service_startup:
                mapping = subprocess.run(['docker','port',container,'3306/tcp'],capture_output=True,text=True,check=True,timeout=10)
                port = mapping.stdout.strip().rsplit(':',1)[1]
                verify_service_startup(service, port, password)
                continue
            for migration in migration_files(service):
                sql(migration.read_text(),db)
                print(f'Applied {service}/{migration.name}',flush=True)
        test_identity(); test_work(); test_notification(); test_common(); test_concurrent_timer()
        check_collaboration_schema(sql, expect)
        test_concurrent_quota()
        if args.export_docs:
            export_schema_docs(ROOT, sql, container)
        for db in DBS:
            print(f'{DBS[db]}: {sql("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE();",db)} tables')
        print(f'PASS: {checks} constraint, history, transaction and concurrent-write assertions; MySQL {sql("SELECT VERSION();")}')
    finally:
        subprocess.run(['docker','rm','--force',container],capture_output=True,timeout=30)
        print('Removed isolated schema-test container.',flush=True)


if __name__ == '__main__':
    main()

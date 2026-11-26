#!/usr/bin/env python3
"""Project writes through Gateway + Work + isolated MySQL. Identity is a contract stub.
Never reads .env, changes live containers, or sends email. Build the two JARs with Java 21 first.
"""
import base64
import concurrent.futures
import http.server
import json
import os
from pathlib import Path
import secrets
import socket
import subprocess
import tempfile
import threading
import time
import urllib.error
import urllib.request
import uuid

ROOT = Path(__file__).resolve().parents[1]
OWNER = '00000000-0000-4000-8000-000000000001'
OTHER = '00000000-0000-4000-8000-000000000002'
MEMBER = '00000000-0000-4000-8000-000000000003'
OUTSIDER = '00000000-0000-4000-8000-000000000004'
TOKENS = {
    'Bearer valid-owner': (OWNER, True),
    'Bearer valid-other': (OTHER, True),
    'Bearer valid-member': (MEMBER, True),
    'Bearer valid-outsider': (OUTSIDER, True),
    'Bearer unverified': (OWNER, False),
}


def command(args, **kwargs):
    return subprocess.run(args, check=True, capture_output=True, text=True, timeout=90, **kwargs).stdout.strip()


def free_port():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        return sock.getsockname()[1]


class IdentityStub(http.server.BaseHTTPRequestHandler):
    registered = threading.Event()
    def log_message(self, *args):
        pass

    def do_GET(self):
        if self.path.startswith('/eureka/apps'):
            body = {'applications': {'versions__delta': '1', 'apps__hashcode': 'UP_1_', 'application': [{
                'name': 'IDENTITY-SERVICE', 'instance': [{'instanceId': 'fixture-identity', 'hostName': '127.0.0.1',
                    'app': 'IDENTITY-SERVICE', 'ipAddr': '127.0.0.1', 'status': 'UP', 'overriddenStatus': 'UNKNOWN',
                    'port': {'$': self.server.server_port, '@enabled': 'true'},
                    'securePort': {'$': 443, '@enabled': 'false'}, 'countryId': 1,
                    'dataCenterInfo': {'@class': 'com.netflix.appinfo.InstanceInfo$DefaultDataCenterInfo', 'name': 'MyOwn'},
                    'vipAddress': 'identity-service', 'secureVipAddress': 'identity-service', 'metadata': {}}]}]}}
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(body).encode())
            return
        if self.path.startswith('/internal/identity/profiles?'):
            token = self.headers.get('Authorization', '')
            if token not in ('Bearer valid-owner', 'Bearer valid-other'):
                self.send_response(401); self.end_headers(); return
            from urllib.parse import parse_qs, urlparse
            ids = parse_qs(urlparse(self.path).query).get('ids', [''])[0].split(',')
            self.send_response(200); self.send_header('Content-Type', 'application/json'); self.end_headers()
            self.wfile.write(json.dumps([{'id': user, 'fullName': 'Owner thật' if user == OWNER else 'Member thật'} for user in ids]).encode())
            return
        token = self.headers.get('Authorization', '')
        status = 200 if token in TOKENS else 401
        if token == 'Bearer outage':
            status = 503
        user_id, verified = TOKENS.get(token, (OWNER, False))
        body = {'success': status == 200, 'data': {'id': user_id, 'emailVerified': verified}}
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(body).encode())

    def do_POST(self):
        self.rfile.read(int(self.headers.get('Content-Length', '0')))
        if self.path == '/eureka/apps/WORK-SERVICE':
            self.registered.set()
            self.send_response(204)
        else:
            self.send_response(404)
        self.end_headers()

    def do_PUT(self):
        self.rfile.read(int(self.headers.get('Content-Length', '0')))
        self.send_response(200)
        self.end_headers()

    def do_DELETE(self):
        self.send_response(200)
        self.end_headers()


def main(workspace=False):
    container = 'tasknest-project-test-' + uuid.uuid4().hex[:8]
    processes = []
    password = secrets.token_hex(24)
    env = {**os.environ, 'MYSQL_ROOT_PASSWORD': password, 'MYSQL_DATABASE': 'tasknest_work',
           'DB_HOST': '127.0.0.1', 'DB_USERNAME': 'root', 'DB_PASSWORD': password, 'DB_NAME': 'tasknest_work',
           'CONFIG_USERNAME': 'unused', 'CONFIG_PASSWORD': password, 'SCAFFOLD_SECURITY_PASSWORD': password,
           'RABBITMQ_USERNAME': 'unused', 'RABBITMQ_PASSWORD': password, 'EUREKA_URL': 'http://127.0.0.1:1/eureka/'}
    fake = http.server.ThreadingHTTPServer(('127.0.0.1', 0), IdentityStub)
    threading.Thread(target=fake.serve_forever, daemon=True).start()

    def push_encode(raw):
        return base64.urlsafe_b64encode(raw).decode('ascii').rstrip('=')

    push_public_key = push_encode(bytes.fromhex(
        '046b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296'
        '4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5'))

    def sql(query):
        return command(['docker', 'exec', '-i', container, 'sh', '-c',
                        'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot -N -B tasknest_work'], input=query)

    def request(port, token='valid-owner', body=None, path='/api/work/projects', method=None, *, content_type='application/json', raw=False):
        headers = {'Content-Type': content_type}
        if token is not None:
            headers['Authorization'] = 'Bearer ' + token
        data = body if isinstance(body, bytes) else json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(f'http://127.0.0.1:{port}' + path,
                                     data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=15) as result:
                response_body = result.read()
                return result.status, response_body if raw else json.loads(response_body or b'{}')
        except urllib.error.HTTPError as error:
            return error.code, json.loads(error.read() or b'{}')

    def payload(name):
        return {'name': name, 'description': 'Project integration test description',
                'startsOn': '2026-10-19', 'endsOn': '2026-11-15'}

    with tempfile.TemporaryDirectory(prefix='tasknest-project-check-') as temp:
        logs = []
        try:
            command(['docker', 'run', '-d', '--name', container, '--tmpfs', '/var/lib/mysql',
                     '-p', '127.0.0.1::3306', '-e', 'MYSQL_ROOT_PASSWORD', '-e', 'MYSQL_DATABASE', 'mysql:8.4'], env=env)
            for _ in range(90):
                try:
                    sql('SELECT 1;')
                    break
                except subprocess.CalledProcessError:
                    time.sleep(1)
            else:
                raise AssertionError('MySQL startup timed out')
            env['DB_PORT'] = command(['docker', 'port', container, '3306/tcp']).rsplit(':', 1)[1]

            def start(service, port, instances):
                parent = 'platform' if service == 'api-gateway' else 'services'
                jar = ROOT / parent / service / 'target' / (service + '-0.1.0-SNAPSHOT.jar')
                java = str(Path(env['JAVA_HOME']) / 'bin/java') if env.get('JAVA_HOME') else 'java'
                log = open(Path(temp) / (service + '.log'), 'w+')
                logs.append(log)
                args = [java, '-XX:ActiveProcessorCount=2', '-jar', str(jar), '--spring.config.import=',
                        '--spring.cloud.config.enabled=false', '--spring.cloud.config.import-check.enabled=false',
                        '--spring.application.name=' + service, '--server.address=127.0.0.1',
                        '--spring.config.location=' + (ROOT / 'infra/config-repo' / (service + '.yml')).as_uri(),
                        '--server.port=' + str(port), '--management.server.port=0',
                        '--management.health.rabbit.enabled=false',
                        '--management.endpoint.health.group.readiness.include=readinessState,db' if service == 'work-service'
                        else '--management.endpoint.health.probes.enabled=true']
                for name, target in instances.items():
                    args.append(f'--spring.cloud.discovery.client.simple.instances.{name}[0].uri=http://127.0.0.1:{target}')
                if service == 'work-service':
                    # Exercise real Eureka HTTP transport as well as the qualified Identity client.
                    # Giving Eureka the @LoadBalanced builder causes a bootstrap loop and no registration.
                    args += ['--tasknest.files.root='+str(Path(temp)/'files'), '--tasknest.events.publish-enabled=false', '--spring.rabbitmq.listener.simple.auto-startup=false', '--eureka.client.enabled=true',
                             '--eureka.client.service-url.defaultZone=http://127.0.0.1:' + str(fake.server_port) + '/eureka/']
                else:
                    args.append('--eureka.client.enabled=false')
                if service == 'notification-service':
                    args += ['--tasknest.mail.enabled=false', '--spring.rabbitmq.listener.simple.auto-startup=false', '--spring.rabbitmq.listener.direct.auto-startup=false']
                launch_env = env
                if service == 'notification-service':
                    # Public P-256 generator and scalar 1 are test vectors, never production keys.
                    launch_env = {**env, 'DB_NAME': 'tasknest_notification',
                                  'PUSH_VAPID_PUBLIC_KEY': push_public_key,
                                  'PUSH_VAPID_PRIVATE_KEY': push_encode(bytes(31) + bytes([1])),
                                  'PUSH_VAPID_SUBJECT': 'mailto:fixture@example.invalid'}
                process = subprocess.Popen(args, env=launch_env, stdout=log, stderr=subprocess.STDOUT)
                processes.append(process)
                status_path = '/api/work/status' if service == 'work-service' else '/api/notifications/status' if service == 'notification-service' else '/api/status'
                for _ in range(120):
                    if process.poll() is not None:
                        log.seek(0)
                        raise AssertionError(service + ' exited:\n' + log.read()[-9000:])
                    try:
                        if request(port, path=status_path)[0] == 200:
                            return
                    except (OSError, ValueError):
                        pass
                    time.sleep(.5)
                log.seek(0)
                raise AssertionError(service + ' startup timeout:\n' + log.read()[-9000:])

            work, gateway = free_port(), free_port()
            notification_port = free_port() if workspace else None
            start('work-service', work, {'identity-service': fake.server_port})
            assert IdentityStub.registered.wait(15), 'Work did not register through direct Eureka HTTP transport'
            instances = {'identity-service': fake.server_port, 'work-service': work}
            if workspace: instances['notification-service'] = notification_port
            start('api-gateway', gateway, instances)
            for port in (work, gateway):
                for token, expected in [(None, 401), ('revoked', 401), ('unverified', 403), ('outage', 503)]:
                    result = request(port, token, payload('Must not be created'))
                    assert result[0] == expected, (port, token, result)
            assert sql('SELECT COUNT(*) FROM projects;') == '0'
            result = request(gateway, body={**payload('  TaskNest integration  '), 'ownerUserId': OTHER, 'role': 'MANAGER'})
            assert result[0] == 201, result
            created = result[1]['data']
            assert created['ownerUserId'] == OWNER and created['role'] == 'OWNER'
            assert created['name'] == 'TaskNest integration' and created['version'] == 0
            assert sql("SELECT COUNT(*) FROM activity_logs WHERE action='PROJECT_CREATED';") == '1'
            assert sql('SELECT COUNT(*) FROM project_storage_usage WHERE limit_bytes=524288000 AND used_bytes=0 AND reserved_bytes=0;') == '1'
            assert sql('SELECT COUNT(*) FROM project_memberships WHERE user_id=\'' + OWNER + '\';') == '1'
            assert request(gateway, body=payload('tasknest integration'))[0] == 409
            assert request(gateway, 'valid-other', payload('TaskNest integration'))[0] == 201
            project_path = '/api/work/projects/' + str(created['id'])
            for port in (work, gateway):
                listed = request(port)
                assert listed[0] == 200 and [item['id'] for item in listed[1]['data']['content']] == [created['id']], listed
                assert request(port, path=project_path)[1]['data']['version'] == 0
                assert request(port, 'valid-other', path=project_path)[0] == 404
                assert request(port, None)[0] == 401
            updated = request(gateway, body={**payload('Updated project'), 'version': 0}, path=project_path, method='PUT')
            assert updated[0] == 200 and updated[1]['data']['version'] == 1, updated
            assert request(gateway, path=project_path)[1]['data']['name'] == 'Updated project'
            assert request(gateway, body={**payload('Stale write'), 'version': 0}, path=project_path, method='PUT')[0] == 409
            # A removed owner must disappear from list and cannot read by guessing its ID.
            sql("UPDATE project_memberships SET status='REMOVED', removed_at=UTC_TIMESTAMP(6), removed_by=user_id WHERE project_id=" + str(created['id']))
            assert request(gateway)[1]['data']['content'] == []
            assert request(gateway, path=project_path)[0] == 404
            sql("UPDATE project_memberships SET status='ACTIVE', removed_at=NULL, removed_by=NULL WHERE project_id=" + str(created['id']))
            assert request(gateway, body={**payload('Invalid dates'), 'endsOn': '2026-10-18'})[0] == 400
            assert request(gateway, body={**payload('Missing dates'), 'startsOn': None})[0] == 400
            assert request(gateway, body=payload('  '))[0] == 400
            with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
                results = list(pool.map(lambda _: request(gateway, body=payload('Concurrent unique project'))[0], range(8)))
            assert results.count(201) == 1 and results.count(409) == 7, results
            assert sql("SELECT COUNT(*) FROM projects WHERE name='Concurrent unique project';") == '1'
            # Force the second insert to fail and prove the first insert rolls back as well.
            sql("CREATE TRIGGER reject_test_membership BEFORE INSERT ON project_memberships FOR EACH ROW SIGNAL SQLSTATE '23000' SET MESSAGE_TEXT='intentional membership failure';")
            assert request(gateway, body=payload('Rollback proof'))[0] == 409
            assert sql("SELECT COUNT(*) FROM projects WHERE name='Rollback proof';") == '0'
            assert sql("SELECT COUNT(*) FROM activity_logs WHERE action='PROJECT_CREATED';") == '3'
            sql('DROP TRIGGER reject_test_membership;')
            assert sql('SELECT COUNT(*) FROM projects p LEFT JOIN project_memberships m ON m.project_id=p.id AND m.user_id=p.owner_user_id AND m.status=\'ACTIVE\' WHERE m.user_id IS NULL;') == '0'

            # Verify project detail, current role resolution, outsider isolation, search/filter/sort and pagination (10/20/50).
            p1_id = created['id']
            detail_owner = request(gateway, 'valid-owner', path=f'/api/work/projects/{p1_id}')
            assert detail_owner[0] == 200 and detail_owner[1]['data']['id'] == p1_id and detail_owner[1]['data']['role'] == 'OWNER', detail_owner

            # Outsider (OTHER is not a member of p1 yet) and OUTSIDER cannot view p1 detail.
            assert request(gateway, 'valid-other', path=f'/api/work/projects/{p1_id}')[0] == 404
            assert request(gateway, 'valid-outsider', path=f'/api/work/projects/{p1_id}')[0] == 404
            assert request(gateway, 'valid-owner', path='/api/work/projects/999999')[0] == 404

            # Add OTHER as MANAGER and MEMBER as MEMBER on p1; also add a PENDING invitation for OUTSIDER.
            sql(f"""
                UPDATE projects SET manager_user_id='{OTHER}' WHERE id={p1_id};
                INSERT INTO project_memberships(project_id,user_id,status,joined_at,added_by)
                VALUES ({p1_id},'{OTHER}','ACTIVE',UTC_TIMESTAMP(6),'{OWNER}'),
                       ({p1_id},'{MEMBER}','ACTIVE',UTC_TIMESTAMP(6),'{OWNER}');
                INSERT INTO project_invitations(project_id,invitee_user_id,invited_by,status,created_at,expires_at)
                VALUES ({p1_id},'{OUTSIDER}','{OWNER}','PENDING',UTC_TIMESTAMP(6),DATE_ADD(UTC_TIMESTAMP(6), INTERVAL 7 DAY));
            """)
            assert request(gateway, 'valid-other', path=f'/api/work/projects/{p1_id}')[1]['data']['role'] == 'MANAGER'
            assert request(gateway, 'valid-member', path=f'/api/work/projects/{p1_id}')[1]['data']['role'] == 'MEMBER'
            # Pending invitee is still an outsider until accepting (GEN-03).
            assert request(gateway, 'valid-outsider', path=f'/api/work/projects/{p1_id}')[0] == 404
            assert request(gateway, 'valid-outsider', path='/api/work/projects')[1]['data']['totalElements'] == 0

            # Archive p3 ('Concurrent unique project') for status filtering checks.
            sql(f"UPDATE projects SET status='ARCHIVED', archived_at=UTC_TIMESTAMP(6), archived_by='{OWNER}' WHERE name='Concurrent unique project';")

            # List for OTHER: participates in 2 projects (OWNER of p2 'TaskNest integration', MANAGER of p1 'Updated project').
            other_all = request(gateway, 'valid-other', path='/api/work/projects')
            assert other_all[0] == 200 and other_all[1]['data']['size'] == 20 and other_all[1]['data']['totalElements'] == 2, other_all
            other_as_manager = request(gateway, 'valid-other', path='/api/work/projects?role=MANAGER')
            assert other_as_manager[0] == 200 and other_as_manager[1]['data']['totalElements'] == 1
            assert other_as_manager[1]['data']['content'][0]['id'] == p1_id and other_as_manager[1]['data']['content'][0]['role'] == 'MANAGER'
            other_as_owner = request(gateway, 'valid-other', path='/api/work/projects?role=OWNER')
            assert other_as_owner[0] == 200 and other_as_owner[1]['data']['totalElements'] == 1
            assert other_as_owner[1]['data']['content'][0]['role'] == 'OWNER'

            # List for OWNER: filter by status, search q, sort, and page sizes 10/20/50.
            owner_active = request(gateway, 'valid-owner', path='/api/work/projects?status=ACTIVE')
            assert owner_active[0] == 200 and owner_active[1]['data']['totalElements'] == 1
            owner_archived = request(gateway, 'valid-owner', path='/api/work/projects?status=ARCHIVED')
            assert owner_archived[0] == 200 and owner_archived[1]['data']['totalElements'] == 1
            assert owner_archived[1]['data']['content'][0]['status'] == 'ARCHIVED'

            owner_search = request(gateway, 'valid-owner', path='/api/work/projects?q=concurrent')
            assert owner_search[0] == 200 and owner_search[1]['data']['totalElements'] == 1
            assert owner_search[1]['data']['content'][0]['name'] == 'Concurrent unique project'
            assert request(gateway, 'valid-owner', path='/api/work/projects?q=%25')[1]['data']['totalElements'] == 0

            owner_name_asc = request(gateway, 'valid-owner', path='/api/work/projects?sort=NAME_ASC&size=10')
            assert [p['name'] for p in owner_name_asc[1]['data']['content']] == ['Concurrent unique project', 'Updated project']
            owner_name_desc = request(gateway, 'valid-owner', path='/api/work/projects?sort=NAME_DESC&size=50')
            assert [p['name'] for p in owner_name_desc[1]['data']['content']] == ['Updated project', 'Concurrent unique project']

            # Invalid pagination size (e.g. 15), negative page, or excessive offset is rejected with 400.
            assert request(gateway, 'valid-owner', path='/api/work/projects?size=15')[0] == 400
            assert request(gateway, 'valid-owner', path='/api/work/projects?page=-1')[0] == 400
            assert request(gateway, 'valid-owner', path='/api/work/projects?page=2147483647&size=50')[0] == 400

            # Removed member immediately loses list and detail visibility (MEM-03, GEN-03).
            sql(f"UPDATE project_memberships SET status='REMOVED', removed_at=UTC_TIMESTAMP(6), removed_by='{OWNER}' WHERE project_id={p1_id} AND user_id='{MEMBER}';")
            assert request(gateway, 'valid-member', path=f'/api/work/projects/{p1_id}')[0] == 404
            assert request(gateway, 'valid-member', path='/api/work/projects')[1]['data']['totalElements'] == 0

            # Restore fixture state before optional workspace suite runs.
            sql(f"""
                UPDATE projects SET manager_user_id=NULL WHERE id={p1_id};
                UPDATE projects SET status='ACTIVE', archived_at=NULL, archived_by=NULL WHERE name='Concurrent unique project';
                DELETE FROM project_memberships WHERE project_id={p1_id} AND user_id IN ('{OTHER}','{MEMBER}');
                DELETE FROM project_invitations WHERE project_id={p1_id};
            """)

            if workspace:
                from datetime import date, timedelta
                today = sql("SELECT DATE(DATE_ADD(UTC_TIMESTAMP(),INTERVAL 7 HOUR));")
                task_body = {'title': 'Task dữ liệu thật', 'description': 'Integration fixture', 'assigneeId': OWNER,
                    'priority': 'MEDIUM', 'startsOn': today, 'deadlineOn': str(date.fromisoformat(today) + timedelta(days=3)), 'estimatedSeconds': 3600}
                task_path = project_path + '/tasks'
                task_result = request(gateway,body=task_body,path=task_path)
                assert task_result[0] == 201, task_result
                task_id = task_result[1]['data']
                data_path = '/api/work/projects/workspace'
                data = request(gateway,path=data_path)
                assert data[0] == 200, data
                assert data[1]['data']['tasks'][0]['id'] == task_id
                assert data[1]['data']['members'][0]['name'] == 'Owner thật'
                assert request(gateway,'valid-other',path=data_path)[1]['data']['tasks'] == []
                assert request(gateway,None,path=data_path)[0] == 401
                task_prefix = task_path + '/' + str(task_id)
                assert request(gateway,body={'version':0},path=task_prefix+'/start',method='PUT')[0] == 200
                assert request(gateway,body={'version':0},path=task_prefix+'/start',method='PUT')[0] == 409
                timer = request(gateway,path=task_prefix+'/timer',method='POST')
                assert timer[0] == 201, timer
                assert request(gateway,path=task_prefix+'/timer',method='POST')[0] == 409
                resumed = request(gateway,path=data_path)[1]['data']['timeEntries'][0]
                assert resumed['endedAt'] is None and resumed['id'] == timer[1]['data']
                stop_path = project_path + '/time-entries/' + str(resumed['id']) + '/stop'
                assert request(gateway,'valid-other',path=stop_path,method='PUT')[0] == 404
                assert request(gateway,path=stop_path,method='PUT')[0] == 200
                assert request(gateway,path=stop_path,method='PUT')[0] == 200
                assert request(gateway,path=data_path)[1]['data']['timeEntries'][0]['endedAt'] is not None
                # Cross-project invitations disclose only invitation metadata, never task data.
                sql("INSERT INTO project_invitations(project_id,invitee_user_id,invited_by,created_at,expires_at) VALUES("+str(created['id'])+",'"+OTHER+"','"+OWNER+"',UTC_TIMESTAMP(6),DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 7 DAY));")
                invite = request(gateway,'valid-other',path=data_path)[1]['data']['invitations'][0]
                invite_path = project_path + '/invitations/' + str(invite['id']) + '/accept'
                assert request(gateway,path=invite_path,method='PUT')[0] == 404
                accepted = request(gateway,'valid-other',path=invite_path,method='PUT')
                assert accepted[0] == 200, accepted
                assert request(gateway,'valid-other',path=invite_path,method='PUT')[0] == 409
                assert len(request(gateway,'valid-other',path=data_path)[1]['data']['tasks']) == 1
                assert request(gateway,'valid-other',body={**task_body,'title':'Forged assignment'},path=task_path)[0] == 403
                # Members see their own time, not another user's history on a reassigned task.
                sql("UPDATE tasks SET assignee_user_id='"+OTHER+"' WHERE id="+str(task_id))
                member_task = request(gateway,'valid-other',path=data_path)[1]['data']['tasks'][0]
                assert member_task['spentSeconds'] == 0, member_task
                other_project = sql("SELECT id FROM projects WHERE owner_user_id='"+OTHER+"' LIMIT 1;")
                code = secrets.token_hex(32)
                sql("INSERT INTO project_invitation_links(project_id,public_code,created_by,created_at) VALUES("+other_project+",'"+code+"','"+OTHER+"',UTC_TIMESTAMP(6));")
                link_path = data_path+'/join-links/'+code
                preview = request(gateway,path=link_path)
                assert preview[0] == 200 and not preview[1]['data']['member'], preview
                assert request(gateway,body={'code':code,'reason':'Muốn tham gia'},path=data_path+'/join-requests')[0] == 201
                assert request(gateway,body={'code':code,'reason':''},path=data_path+'/join-requests')[0] == 409
                sent = request(gateway,path=data_path)[1]['data']['joinRequests'][0]
                cancel_path = '/api/work/projects/'+other_project+'/join-requests/'+str(sent['id'])+'/cancel'
                assert request(gateway,'valid-other',path=cancel_path,method='PUT')[0] == 409
                assert request(gateway,path=cancel_path,method='PUT')[0] == 200
                assert request(gateway,path=data_path)[1]['data']['joinRequests'][0]['status'] == 'CANCELLED'
                assert request(gateway,path='/internal/identity/profiles?ids='+OWNER)[0] in (401,403,404)
                sql('CREATE DATABASE tasknest_notification;')
                start('notification-service',notification_port,{'identity-service':fake.server_port})
                sql("INSERT INTO tasknest_notification.notifications(recipient_user_id,event_id,event_type,resource_type,resource_id,title,body) VALUES('"+OWNER+"','"+str(uuid.uuid4())+"','test.fixture','TASK','1','Thông báo thật','Nội dung kiểm thử');")
                inbox_path='/api/notifications/inbox'
                assert request(notification_port,None,path=inbox_path)[0] == 401
                assert request(notification_port,'revoked',path=inbox_path)[0] == 401
                assert request(notification_port,'outage',path=inbox_path)[0] == 503
                assert request(notification_port,'unverified',path=inbox_path)[0] == 403
                assert request(gateway,None,path=inbox_path)[0] == 401
                assert request(gateway,path=inbox_path)[0] == 200
                push_settings = inbox_path + '/push/settings'
                assert request(gateway,None,path=push_settings,method='POST',body={})[0] == 401
                push_response = request(gateway,path=push_settings,method='POST',body={})
                assert push_response[0] == 200 and push_response[1].get('publicKey') == push_public_key, push_response
                push_path = inbox_path + '/push'
                push_endpoint = 'https://fcm.googleapis.com/fcm/send/tasknest-test-fixture'
                push_preferences = {'work': True, 'collaboration': False, 'messages': True, 'details': False}
                push_device = {'endpoint': push_endpoint, 'p256dh': push_public_key,
                               'auth': push_encode(bytes(16)), 'preferences': push_preferences}
                assert request(gateway,path=push_path,method='PUT',body={**push_device, 'endpoint': 'https://example.invalid/push'})[0] == 400
                result = request(gateway,path=push_path,method='PUT',body=push_device)
                assert result[0] == 204, result
                result = request(gateway,path=push_path,method='PUT',body=push_device)
                assert result[0] == 204, result
                assert request(gateway,'valid-other',path=push_settings,method='POST',body={'endpoint':push_endpoint})[1].get('preferences') is None
                assert request(gateway,'valid-other',path=push_path,method='DELETE',body={'endpoint':push_endpoint})[0] == 204
                assert request(gateway,path=push_settings,method='POST',body={'endpoint':push_endpoint})[1]['preferences'] == push_preferences
                assert request(gateway,path=push_path,method='DELETE',body={'endpoint':push_endpoint})[0] == 204
                assert request(gateway,path=push_settings,method='POST',body={'endpoint':push_endpoint})[1].get('preferences') is None
                print('PASS: browser push registration, endpoint validation, privacy settings and account isolation.')
                inbox=request(notification_port,path=inbox_path)
                assert inbox[0] == 200 and inbox[1]['unreadCount'] == 1, inbox
                notification_id=inbox[1]['items'][0]['id']
                read_path=inbox_path+'/'+str(notification_id)+'/read'
                denied_read=request(notification_port,'valid-other',path=read_path,method='PUT')
                assert denied_read[0] == 404, denied_read
                assert request(notification_port,path=read_path,method='PUT')[0] == 200
                assert request(notification_port,path=inbox_path)[1]['unreadCount'] == 0
                assert request(notification_port,'valid-other',path=inbox_path)[1]['items'] == []
                from task_workflow_checks import check_workflow
                check_workflow(request, sql, gateway, project_path, task_body, OWNER, OTHER, other_project)
                from report_export_checks import check_report_exports
                check_report_exports(sql, gateway, project_path, OWNER, OTHER)
                print('PASS: workspace isolation, real task creation, member roles, persistent timer, invitation acceptance, private time totals and notification read ownership.')
            # The complete catalog and direct detail must remain usable beyond the first page.
            for index in range(25):
                result = request(gateway, body=payload(f'Catalog regression {index:02}'))
                assert result[0] == 201, result
            catalog = request(gateway, path='/api/work/projects/index')
            assert catalog[0] == 200 and len(catalog[1]['data']) == 27, catalog
            assert len(request(gateway)[1]['data']['content']) == 20
            assert p1_id in [project['id'] for project in catalog[1]['data']]
            assert p1_id not in [project['id'] for project in request(gateway)[1]['data']['content']]
            assert request(gateway, path=f'/api/work/projects/{p1_id}')[0] == 200
            assert request(gateway, 'valid-outsider', path='/api/work/projects/index')[1]['data'] == []
            assert request(gateway, None, path='/api/work/projects/index')[0] == 401
            assert request(gateway, 'unverified', path='/api/work/projects/index')[0] == 403
            assert len(request(gateway, path='/api/work/projects?q=Catalog')[1]['data']['content']) == 20
            last = request(gateway, path='/api/work/projects?q=Catalog&page=1')[1]['data']
            assert len(last['content']) == 5 and last['totalElements'] == 25
            print('PASS: full catalog >20 projects, authenticated index isolation, direct detail outside first page and paginated queries.', flush=True)
            from project_archive_checks import run as check_project_archive
            check_project_archive(request, sql, gateway, payload, OWNER, OTHER)
            from timesheet_checks import run as check_timesheet
            check_timesheet(request, sql, gateway, payload, OWNER, OTHER)
            print('PASS: direct Eureka registration and qualified load-balanced Identity lookup.')
            print('PASS: scoped list/detail, removed membership exclusion, saved version persistence and stale update rejection.')
            print('PASS: Gateway + Work authentication boundary, validation, owner assignment, case-insensitive uniqueness, concurrent creation and transaction rollback.')
            print('PASS: Project list, status/role filtering, name search, 10/20/50 pagination, project detail with current role, and outsider/removed-member isolation.')
            print('Identity was a local contract stub; no live database or email service was used.')
        except Exception:
            for log in logs:
                log.seek(0)
                print('\n'.join(line for line in log if 'Exception' in line or 'ERROR' in line or line.startswith(']'))[-10000:])
            raise
        finally:
            for process in reversed(processes):
                process.terminate()
            for process in processes:
                try:
                    process.wait(timeout=15)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()
            for log in logs:
                log.close()
            subprocess.run(['docker', 'rm', '-f', '-v', container], capture_output=True)
            fake.shutdown()


if __name__ == '__main__':
    main()

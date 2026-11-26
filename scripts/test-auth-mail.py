#!/usr/bin/env python3
"""End-to-end auth through Gateway + disposable MySQL/RabbitMQ + local fake Brevo.
Never reads .env and never sends real email. Build JARs with ./mvnw verify first.
"""
import http.server
import json
import os
from pathlib import Path
import re
import secrets
import socket
import subprocess
import tempfile
import threading
import time
import uuid
from urllib.parse import urlsplit, parse_qs
from auth_secrets import generate_auth_secrets
from auth_integration_checks import AuthChecks
import importlib.util

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('schema_check', ROOT/'scripts/test-schema.py')
schema = importlib.util.module_from_spec(spec); spec.loader.exec_module(schema)


def command(args):
    return subprocess.run(args, check=True, capture_output=True, text=True, timeout=90).stdout.strip()


def wait_for(predicate, label, timeout=45):
    deadline = time.monotonic()+timeout
    while time.monotonic()<deadline:
        if predicate(): return
        time.sleep(.25)
    raise AssertionError('Timed out: '+label)


class FakeBrevo(http.server.BaseHTTPRequestHandler):
    messages = []
    status = 201
    lock = threading.Lock()
    def log_message(self, *args): pass
    def do_POST(self):
        if self.headers.get('Transfer-Encoding', '').lower() == 'chunked':
            chunks=[]
            while True:
                size=int(self.rfile.readline().split(b';',1)[0],16)
                if size==0:
                    self.rfile.readline(); break
                chunks.append(self.rfile.read(size)); self.rfile.read(2)
            raw=b''.join(chunks)
        else:
            raw=self.rfile.read(int(self.headers['Content-Length']))
        body=json.loads(raw)
        assert self.path=='/v3/smtp/email'
        assert self.headers['api-key']=='test-not-a-real-key'
        with self.lock:
            self.messages.append(body)
            status=self.status
        self.send_response(status); self.send_header('Content-Type','application/json'); self.end_headers()
        self.wfile.write(json.dumps({'messageId':'<fake-'+uuid.uuid4().hex+'@example.test>'} if status==201 else {'code':'fake_failure'}).encode())


def main(members=False):
    containers=[]; processes=[]; logs=[]
    file_store=tempfile.TemporaryDirectory(prefix="tasknest-mail-files-")
    with socket.socket() as available:
        available.bind(("127.0.0.1",0));work_test_port=available.getsockname()[1]
    fake=http.server.ThreadingHTTPServer(('127.0.0.1',0), FakeBrevo)
    threading.Thread(target=fake.serve_forever,daemon=True).start()
    password=secrets.token_hex(24); prefix='tasknest-mail-test-'+uuid.uuid4().hex[:8]
    os.environ['MYSQL_ROOT_PASSWORD']=password
    os.environ['MYSQL_PWD']=password
    os.environ['RABBITMQ_DEFAULT_PASS']=password
    env=os.environ.copy(); env.update(generate_auth_secrets())
    env.update(DB_HOST='127.0.0.1', DB_USERNAME='root', DB_PASSWORD=password,
        SCAFFOLD_SECURITY_PASSWORD=password, CONFIG_USERNAME='unused',CONFIG_PASSWORD=password,
        SPRING_CONFIG_IMPORT='', EUREKA_CLIENT_ENABLED='false',
        RABBITMQ_HOST='127.0.0.1',RABBITMQ_USERNAME='mailtest',RABBITMQ_PASSWORD=password,
        AUTH_MAIL_GLOBAL_ATTEMPTS='12', MAIL_ENABLED='true', BREVO_API_KEY='test-not-a-real-key',MAIL_FROM_EMAIL='sender@example.test',
        MAIL_FROM_NAME='TaskNest',PUBLIC_APP_ORIGIN='http://localhost:3000',IDENTITY_COOKIE_SECURE='false')
    java=str(Path(env['JAVA_HOME'])/'bin/java') if env.get('JAVA_HOME') else 'java'
    try:
        mysql=prefix+'-mysql'; containers.append(mysql)
        command(['docker','run','-d','--name',mysql,'--tmpfs','/var/lib/mysql','-p','127.0.0.1::3306',
            '-e','MYSQL_ROOT_PASSWORD','mysql:8.4'])
        schema.container=mysql
        wait_for(lambda: subprocess.run(['docker','exec','-e','MYSQL_PWD',mysql,'mysql','-uroot','--protocol=TCP','-h127.0.0.1','--execute','SELECT 1'],capture_output=True).returncode==0,'MySQL startup',90)
        env['DB_PORT']=command(['docker','port',mysql,'3306/tcp']).rsplit(':',1)[1]
        for db in ('identity','notification'): schema.sql('CREATE DATABASE tasknest_'+db+';')
        rabbit=prefix+'-rabbit';containers.append(rabbit)
        command(['docker','run','-d','--name',rabbit,'--tmpfs','/var/lib/rabbitmq:rw,uid=100,gid=101,mode=0700','-p','127.0.0.1::5672',
            '-e','RABBITMQ_DEFAULT_USER=mailtest','-e','RABBITMQ_DEFAULT_PASS',
            '-e','RABBITMQ_DEFAULT_VHOST=/tasknest','rabbitmq:4.2-management-alpine'])
        wait_for(lambda: subprocess.run(['docker','exec','--user','100:101',rabbit,'rabbitmq-diagnostics','-q','check_running'],capture_output=True).returncode==0,'Rabbit startup',90)
        env['RABBITMQ_PORT']=command(['docker','port',rabbit,'5672/tcp']).rsplit(':',1)[1]

        def start(service, extra=()):
            parent='platform' if service=='api-gateway' else 'services'
            jar=ROOT/f'{parent}/{service}/target/{service}-0.1.0-SNAPSHOT.jar'
            cfg=(ROOT/f'infra/config-repo/{service}.yml').as_uri()
            common=(ROOT/'infra/config-repo/application.yml').as_uri()
            app_env={**env,'SPRING_APPLICATION_NAME':service,'DB_NAME':'tasknest_'+service.removesuffix('-service')}
            log=tempfile.TemporaryFile(mode='w+');logs.append(log)
            args=[java,'-Xmx256m','-XX:ActiveProcessorCount=2','-jar',str(jar),
                '--spring.config.location='+common+','+cfg,
                '--spring.cloud.config.enabled=false','--spring.cloud.config.import-check.enabled=false',
                '--server.address=127.0.0.1','--server.port=0', '--management.server.port=0',
                '--tasknest.mail.poll-ms=300','--tasknest.mail.api-base=http://127.0.0.1:'+str(fake.server_port)+'/v3',
                '--management.endpoint.health.group.readiness.include=readinessState']+list(extra)
            if service=='work-service': args=[argument for argument in args if argument!='--server.port=0']; args += ['--server.port='+str(work_test_port),'--tasknest.files.root='+file_store.name]
            if service=='notification-service': args += [f'--spring.cloud.discovery.client.simple.instances.work-service[0].uri=http://127.0.0.1:{work_test_port}',f'--spring.cloud.discovery.client.simple.instances.identity-service[0].uri=http://127.0.0.1:{identity_port}']
            proc=subprocess.Popen(args,env=app_env,stdout=log,stderr=subprocess.STDOUT,cwd=ROOT); processes.append(proc)
            def started():
                log.seek(0); output=log.read()
                if proc.poll() is not None: raise RuntimeError(output.replace(password,'[redacted]'))
                return bool(re.search(r'(Tomcat|Netty) started on port (\d+)',output)) and 'Application in ' in output
            wait_for(started,service+' startup',60)
            log.seek(0);return int(re.search(r'(?:Tomcat|Netty) started on port (\d+)',log.read()).group(1))

        identity_port=start('identity-service')
        notification_port=start('notification-service')
        gateway_port=start('api-gateway', ['--spring.cloud.gateway.server.webflux.routes[0].id=identity-test', '--spring.cloud.gateway.server.webflux.routes[0].predicates[0]=Path=/api/identity/**', '--spring.cloud.gateway.server.webflux.routes[0].uri=http://127.0.0.1:'+str(identity_port)])
        auth=AuthChecks(gateway_port,schema.sql)
        auth.email='mail-flow@example.test'
        register=lambda email: auth.request('/api/identity/auth/register',{
            'fullName':'Mail Flow Test','email':email,'password':auth.password,'confirmPassword':auth.password})
        auth.expect_status(auth.request('/api/identity/status'),200)
        registration=auth.expect_status(register(auth.email),201)
        account_id=registration[1]['data']['id']
        assert isinstance(account_id,str) and uuid.UUID(account_id).version==4
        auth.expect_status(auth.login(),403)
        wait_for(lambda: schema.sql("SELECT COUNT(*) FROM email_jobs WHERE status='ACCEPTED';",'notification')=='1','provider accepted')
        assert schema.sql('SELECT recipient_user_id FROM email_jobs LIMIT 1;', 'notification')==account_id
        assert schema.sql("SELECT JSON_TYPE(payload->'$.userId') FROM outbox_events LIMIT 1;", 'identity')=='STRING'
        assert schema.sql('SELECT schema_version FROM outbox_events LIMIT 1;', 'identity')=='2'
        with FakeBrevo.lock: first=FakeBrevo.messages[0]
        assert first['to'][0]['email']==auth.email
        link=re.search(r'http://localhost:3000/verify-email\?token=[A-Za-z0-9_-]+',first['textContent']).group()
        token=parse_qs(urlsplit(link).query)['token'][0]
        path='/api/identity/auth/verify-email?token='+token
        auth.expect_status(auth.request(path),200)
        auth.expect_status(auth.request(path),400)
        login = auth.expect_status(auth.login(),200)
        access = login[1]['data']['accessToken']
        auth.expect_status(auth.request('/api/identity/auth/session'),401)
        auth.expect_status(auth.request('/api/identity/auth/session',access_token='forged'),401)
        session=auth.expect_status(auth.request('/api/identity/auth/session',access_token=access),200)
        assert session[1]['data']['id']==account_id
        from profile_integration_checks import check_profile
        check_profile(auth, access)
        auth.expect_status(auth.request('/api/identity/auth/refresh-token',{}),200)
        auth.expect_status(auth.request('/api/identity/auth/logout',{}),200)
        auth.expect_status(auth.request('/api/identity/auth/session',access_token=access),401)
        auth.expect_status(auth.request('/api/identity/profile/avatar',access_token=access),401)
        auth.expect_status(auth.request('/api/identity/auth/refresh-token',{}),401)
        auth.expect_status(register(auth.email),409)
        assert schema.sql("SELECT sensitive_data IS NULL AND encryption_key_id IS NULL FROM email_jobs LIMIT 1;",'notification')=='1'
        assert token not in schema.sql('SELECT payload FROM outbox_events;','identity')
        schema.sql("UPDATE outbox_events SET status='PENDING',available_at=UTC_TIMESTAMP(6);",'identity')
        wait_for(lambda: schema.sql("SELECT COUNT(*) FROM outbox_events WHERE status='PUBLISHED' AND attempts=2;",'identity')=='1','republish')
        time.sleep(1)
        assert len(FakeBrevo.messages)==1
        assert schema.sql('SELECT COUNT(*) FROM processed_events;','notification')=='1'
        print('PASS: Gateway registration, encrypted Rabbit relay, Brevo contract, one-time email verification, login, rotation, logout and duplicate-event deduplication',flush=True)

        # Explicit provider throttling retries, while permanent/ambiguous failures never auto-resend.
        FakeBrevo.status=429; auth.expect_status(register('throttle@example.test'),201)
        wait_for(lambda: schema.sql("SELECT COUNT(*) FROM email_jobs WHERE status='QUEUED' AND attempt_count=1;",'notification')=='1','429 retry scheduling')
        FakeBrevo.status=201
        schema.sql("UPDATE email_jobs SET next_attempt_at=UTC_TIMESTAMP(6) WHERE status='QUEUED';",'notification')
        wait_for(lambda: schema.sql("SELECT COUNT(*) FROM email_jobs WHERE status='ACCEPTED';",'notification')=='2','retry accepted')
        FakeBrevo.status=401;auth.expect_status(register('permanent@example.test'),201)
        wait_for(lambda: schema.sql("SELECT COUNT(*) FROM email_jobs WHERE status='FAILED' AND last_error_safe='BREVO_HTTP_401';",'notification')=='1','permanent failure')
        FakeBrevo.status=503;auth.expect_status(register('ambiguous@example.test'),201)
        wait_for(lambda: schema.sql("SELECT COUNT(*) FROM email_delivery_attempts WHERE result='UNKNOWN';",'notification')=='1','ambiguous failure')
        count=len(FakeBrevo.messages);time.sleep(1);assert len(FakeBrevo.messages)==count
        print('PASS: 429 retry, permanent failure, ambiguous delivery held without automatic duplicate send, and encrypted payload cleanup',flush=True)
        from auth_security_checks import check_security_regressions
        check_security_regressions(auth, schema, env, rabbit, command, wait_for)
        from account_security_checks import check_account_security
        check_account_security(auth, schema, FakeBrevo, wait_for)
        if members:
            from project_members_checks import check_project_members
            check_project_members(auth, schema, start, identity_port, notification_port, FakeBrevo, wait_for)

    finally:
        for proc in reversed(processes):
            proc.terminate()
            try:proc.wait(timeout=15)
            except subprocess.TimeoutExpired:proc.kill();proc.wait(timeout=5)
        for log in logs:log.close()
        fake.shutdown();fake.server_close()
        file_store.cleanup()
        for name in reversed(containers): subprocess.run(['docker','rm','-fv',name],capture_output=True,timeout=30)
        print('Removed disposable mail-test processes/containers.',flush=True)


if __name__=='__main__':main()

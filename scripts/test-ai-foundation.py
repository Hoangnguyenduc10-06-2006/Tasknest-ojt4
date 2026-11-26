#!/usr/bin/env python3
"""Boot the real AI JAR and Flyway on disposable MySQL. No Groq calls or real data."""
from pathlib import Path
import http.server
import json
import os
import secrets
import socket
import subprocess
import tempfile
import threading
import time
import urllib.request
import urllib.error
import uuid

ROOT = Path(__file__).resolve().parents[1]
def port():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        return sock.getsockname()[1]

def main():
    name = 'tasknest-ai-test-' + uuid.uuid4().hex[:10]
    password = secrets.token_hex(24)
    env = dict(os.environ, MYSQL_ROOT_PASSWORD=password, DB_PASSWORD=password)
    container = None
    process = None
    identity = None
    with tempfile.TemporaryDirectory(prefix='tasknest-ai-test-') as temp:
        log_path = Path(temp) / 'service.log'
        try:
            container = subprocess.check_output(['docker', 'run', '-d', '--name', name, '--publish', '127.0.0.1::3306',
                '--tmpfs', '/var/lib/mysql:rw', '-e', 'MYSQL_ROOT_PASSWORD', 'mysql:8.4'], env=env, text=True, timeout=60).strip()
            for _ in range(90):
                result = subprocess.run(['docker', 'exec', container, 'sh', '-c', 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot -e "SELECT 1"'], capture_output=True, timeout=10)
                if result.returncode == 0: break
                time.sleep(1)
            else: raise RuntimeError('Disposable MySQL did not become ready')
            # MySQL can accept the first health probe while its initial data
            # dictionary is still settling on an empty tmpfs volume. Retry the
            # one-time test schema creation instead of making CI flaky.
            create = None
            for _ in range(30):
                create = subprocess.run(['docker', 'exec', container, 'sh', '-c', 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot -e "CREATE DATABASE IF NOT EXISTS tasknest_ai"'], capture_output=True, timeout=10)
                if create.returncode == 0: break
                time.sleep(1)
            else:
                detail = (create.stderr or b'').decode(errors='replace').replace(password, '[redacted]')
                raise RuntimeError('Disposable MySQL could not create AI schema: ' + detail[-1000:])
            db_port = subprocess.check_output(['docker', 'port', container, '3306/tcp'], text=True).strip().rsplit(':', 1)[1]
            class Identity(http.server.BaseHTTPRequestHandler):
                def do_GET(self):
                    valid = self.headers.get('Authorization') == 'Bearer test-active'
                    self.send_response(200 if valid else 401)
                    self.send_header('Content-Type', 'application/json'); self.end_headers()
                    self.wfile.write(json.dumps({'success': valid, 'data': {'id': '00000000-0000-4000-8000-000000000001', 'emailVerified': True}}).encode())
                def log_message(self, *args): pass
            identity = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Identity)
            threading.Thread(target=identity.serve_forever, daemon=True).start()
            app_port, health_port = port(), port()
            config = Path(temp) / 'application.properties'
            config.write_text(f'''spring.application.name=ai-service
spring.cloud.config.enabled=false
spring.security.user.password=test-only-unused-password
eureka.client.enabled=false
spring.cloud.discovery.client.simple.instances.identity-service[0].uri=http://127.0.0.1:{identity.server_port}
spring.datasource.url=jdbc:mysql://127.0.0.1:{db_port}/tasknest_ai
spring.datasource.username=root
spring.datasource.password=${{DB_PASSWORD}}
server.port={app_port}
management.server.port={health_port}
management.endpoints.web.exposure.include=health
management.endpoint.health.probes.enabled=true
tasknest.ai.enabled=false
tasknest.ai.provider=groq
tasknest.ai.model=openai/gpt-oss-120b
tasknest.ai.user-daily-limit=20
tasknest.ai.global-daily-limit=100
tasknest.ai.requests-per-minute=2
tasknest.ai.tokens-per-minute=8000
tasknest.ai.tokens-per-day=200000
tasknest.ai.max-completion-tokens=1500
''')
            jar = ROOT / 'services/ai-service/target/ai-service-0.1.0-SNAPSHOT.jar'
            with log_path.open('w') as log:
                process = subprocess.Popen(['java', '-jar', str(jar), '--spring.config.location=file:' + str(config)], env=env, stdout=log, stderr=subprocess.STDOUT)
                for _ in range(90):
                    if process.poll() is not None: raise RuntimeError('AI process exited during startup')
                    try:
                        with urllib.request.urlopen(f'http://127.0.0.1:{health_port}/actuator/health/readiness', timeout=2) as response:
                            if response.status == 200: break
                    except (urllib.error.URLError, TimeoutError): pass
                    time.sleep(1)
                else: raise RuntimeError('AI readiness timed out')
                def request(path, token=None, body=None):
                    headers = {'Content-Type': 'application/json'}
                    if token: headers['Authorization'] = 'Bearer ' + token
                    req = urllib.request.Request(f'http://127.0.0.1:{app_port}' + path, headers=headers, data=json.dumps(body).encode() if body else None)
                    try:
                        with urllib.request.urlopen(req, timeout=8) as response: return response.status, json.load(response)
                    except urllib.error.HTTPError as error:
                        data = error.read()
                        return error.code, json.loads(data) if data else {}
                assert request('/api/ai/status')[0] == 401
                assert request('/api/ai/status', 'test-revoked')[0] == 401
                code, payload = request('/api/ai/status', 'test-active')
                assert code == 200 and payload['data']['businessDataAccess'] is True
                code, payload = request('/api/ai/chat', 'test-active', {'message': 'Xin chào'})
                assert code == 503 and payload['code'] == 'AI_NOT_CONFIGURED'
                tables = subprocess.check_output(['docker', 'exec', container, 'sh', '-c', 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot -N -e "SELECT COUNT(*) FROM tasknest_ai.flyway_schema_history WHERE success=1"'], text=True).strip()
                assert tables == '1', tables
                quota_env = dict(env, AI_TEST_JDBC_URL=f'jdbc:mysql://127.0.0.1:{db_port}/tasknest_ai')
                subprocess.run([str(ROOT / 'mvnw'), '-q', '-pl', 'services/ai-service', '-Dtest=AiQuotaTest', 'test'], cwd=ROOT, env=quota_env, check=True, timeout=90)
                print('PASS real MySQL concurrent quota reservations and rollback.')
                print('PASS AI JAR startup, MySQL migration, active/revoked/anonymous sessions and disabled-provider fallback. No Groq call made.')
        except Exception:
            if log_path.exists(): print(log_path.read_text()[-6000:].replace(password, '[redacted]'))
            raise
        finally:
            if process:
                process.terminate()
                try: process.wait(timeout=15)
                except subprocess.TimeoutExpired: process.kill(); process.wait()
            if identity: identity.shutdown(); identity.server_close()
            if container: subprocess.run(['docker', 'rm', '-f', container], capture_output=True, timeout=30)

if __name__ == '__main__': main()

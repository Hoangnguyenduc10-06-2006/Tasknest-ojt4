"""Auth regression checks called ONLY by test-schema.py's disposable service-startup mode."""
import concurrent.futures
import http.client
import http.cookies
import json
import threading
from types import SimpleNamespace
from rate_limit_checks import check_in_one_window


class AuthChecks:
    def __init__(self, port, query):
        self.port = port
        self.query = query
        self.cookies = {}
        self.email = 'auth-regression@example.test'
        self.password = 'Auth-regression-123'
        self.checks = 0

    def request(self, path, body=None, *, csrf=True, origin='http://localhost:3000', cookies=None, access_token=None, extra_headers=None, method=None):
        jar = dict(self.cookies if cookies is None else cookies)
        headers = {'Content-Type': 'application/json', 'Origin': origin}
        if extra_headers: headers.update(extra_headers)
        if access_token:
            headers['Authorization'] = 'Bearer ' + access_token
        if jar:
            headers['Cookie'] = '; '.join(key + '=' + value for key, value in jar.items())
        if csrf and body is not None and 'XSRF-TOKEN' in jar:
            headers['X-XSRF-TOKEN'] = jar['XSRF-TOKEN']
        connection = http.client.HTTPConnection('127.0.0.1', self.port, timeout=20)
        try:
            connection.request(method or ('GET' if body is None else 'POST'), path,
                               body=None if body is None else json.dumps(body), headers=headers)
            response = connection.getresponse()
            raw = response.read()
            for key, value in response.getheaders():
                if key.lower() == 'set-cookie':
                    parsed = http.cookies.SimpleCookie()
                    parsed.load(value)
                    self.cookies.update({k: v.value for k, v in parsed.items()})
            return response.status, (raw if response.getheader('Content-Type','').startswith('image/') else json.loads(raw) if raw else {}), dict(response.getheaders())
        finally:
            connection.close()

    def expect_status(self, result, status):
        assert result[0] == status, f'Expected HTTP {status}, got {result[0]}'
        self.checks += 1
        return result

    def login(self):
        return self.request('/api/identity/auth/login', {'email': self.email, 'password': self.password})

    def first_start(self):
        self.expect_status(self.request('/api/identity/status'), 200)
        self.expect_status(self.request('/api/identity/auth/register', {
            'fullName': 'Auth Regression', 'email': self.email, 'accountPurpose': 'BOTH',
            'password': self.password, 'confirmPassword': self.password,
        }), 201)
        self.expect_status(self.login(), 403)
        # Verified fixture for rotation/rate-limit scenarios; complete token flow is tested by test-auth-mail.py.
        self.query("UPDATE users SET is_email_verified=1,email_verified_at=UTC_TIMESTAMP(6) WHERE email='auth-regression@example.test';", 'identity')
        login = self.expect_status(self.login(), 200)
        import uuid
        account_id = login[1]['data']['user']['id']
        assert isinstance(account_id, str) and uuid.UUID(account_id).version == 4
        self.checks += 1
        assert 'refreshToken' not in login[1]['data']
        self.check_onboarding(login[1]['data']['accessToken'], account_id)
        original = self.cookies['tasknest_refresh']
        self.expect_status(self.request('/api/identity/auth/refresh-token', {}, origin='https://foreign.example.test'), 403)
        self.expect_status(self.request('/api/identity/auth/refresh-token', {}, csrf=False), 403)
        self.expect_status(self.request('/api/identity/auth/refresh-token', {}), 200)
        assert self.cookies['tasknest_refresh'] != original
        self.expect_status(self.request('/api/identity/auth/refresh-token', {},
                                       cookies={**self.cookies, 'tasknest_refresh': original}), 401)
        assert self.query("SELECT COUNT(*) FROM auth_sessions WHERE revocation_reason='REFRESH_TOKEN_REUSE';", 'identity') == '1'
        self.checks += 3

        budget_fixture = SimpleNamespace(sql=self.query)
        def login_account_budget():
            statuses = []
            for _ in range(12):
                result = self.request('/api/identity/auth/login', {'email': self.email.upper(), 'password': 'wrong-password'})
                statuses.append(result[0])
                if result[0] == 429:
                    assert int(result[2]['Retry-After']) > 0
            assert statuses == [401] * 10 + [429] * 2, statuses
        check_in_one_window(budget_fixture, 'LOGIN', 'ACCOUNT', login_account_budget)
        self.checks += 1
        # Fresh scenarios; this is the disposable fixture database, never an application connection.
        self.query('DELETE FROM auth_rate_limit_buckets;', 'identity')
        self.expect_status(self.login(), 200)
        snapshot = dict(self.cookies)
        barrier = threading.Barrier(2)

        def parallel_refresh(_):
            barrier.wait()
            return self.request('/api/identity/auth/refresh-token', {}, cookies=snapshot)[0]

        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            statuses = list(pool.map(parallel_refresh, range(2)))
        assert sorted(statuses) == [200, 401], statuses
        assert self.query("SELECT COUNT(*) FROM auth_sessions WHERE revocation_reason='REFRESH_TOKEN_REUSE';", 'identity') == '2'
        self.checks += 2

        def refresh_session_budget():
            self.expect_status(self.login(), 200)
            # test-schema sets refresh-session-attempts=3 only in its isolated test process.
            for _ in range(3):
                self.expect_status(self.request('/api/identity/auth/refresh-token', {}), 200)
            self.expect_status(self.request('/api/identity/auth/refresh-token', {}), 429)
        check_in_one_window(budget_fixture, 'REFRESH', 'SESSION', refresh_session_budget)
        self.query('DELETE FROM auth_rate_limit_buckets;', 'identity')

        resend_email = 'resend-regression@example.test'
        self.expect_status(self.request('/api/identity/auth/register', {
            'fullName': 'Resend Regression', 'email': resend_email,
            'password': self.password, 'confirmPassword': self.password,
        }), 201)
        for _ in range(5):
            self.query('UPDATE account_tokens SET created_at=DATE_SUB(created_at,INTERVAL 61 SECOND), expires_at=DATE_SUB(expires_at,INTERVAL 61 SECOND);', 'identity')
            self.expect_status(self.request('/api/identity/auth/resend-verification', {'email': resend_email}), 200)
        self.query('UPDATE account_tokens SET created_at=DATE_SUB(created_at,INTERVAL 61 SECOND), expires_at=DATE_SUB(expires_at,INTERVAL 61 SECOND);', 'identity')
        self.expect_status(self.request('/api/identity/auth/resend-verification', {'email': resend_email}), 429)
        assert self.query("SELECT COUNT(*) FROM account_tokens WHERE issue_source='RESEND';", 'identity') == '5'
        self.checks += 1
        self.expect_status(self.request('/api/identity/auth/register', {
            'fullName': 'Auth Regression', 'email': 'a' * 250 + '@example.test',
            'password': self.password, 'confirmPassword': self.password,
        }), 400)
        self.expect_status(self.login(), 200)
        self.jwks = self.request('/api/identity/.well-known/jwks.json')[1]
        # Prove a committed budget also survives service restart, not only process memory.
        self.request('/api/identity/auth/login', {'email': 'restart-budget@example.test', 'password': 'wrong-password'})
        self.buckets_before_restart = self.query('SELECT SUM(request_count) FROM auth_rate_limit_buckets;', 'identity')
        print(f'PASS: {self.checks} live auth checks (origin, CSRF, limiter, replay, concurrency, resend, validation)', flush=True)

    def check_onboarding(self, token, account_id):
        import base64
        import struct
        import zlib
        def image(rgb):
            def chunk(kind, data):
                return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data) & 0xffffffff)
            png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', 1, 1, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(b'\0' + bytes(rgb))) + chunk(b'IEND', b'')
            return base64.b64encode(png).decode()
        path = '/api/identity/onboarding'
        self.expect_status(self.request(path), 401)
        state = self.expect_status(self.request(path, access_token=token), 200)[1]['data']
        assert state['user']['accountPurpose'] == 'BOTH' and state['user']['onboardingStatus'] == 'NOT_STARTED' and state['user']['onboardingStep'] == 1
        draft = {'company': 'Đội sản phẩm Việt', 'location': 'Hà Nội', 'goals': '', 'headline': 'React Developer', 'about': '', 'skills': ['React'], 'publishProfile': False, 'shareAvatar': False}
        body = {'purpose': 'BOTH', 'status': 'DEFERRED', 'step': 2, 'version': state['user']['version'], 'draft': draft, 'userId': 'forged-account'}
        saved = self.expect_status(self.request(path, body, method='PUT', access_token=token), 200)[1]['data']
        assert saved['user']['id'] == account_id and saved['user']['onboardingStatus'] == 'DEFERRED'
        assert self.request(path, access_token=token)[1]['data']['draft'] == draft
        self.expect_status(self.request(path, body, method='PUT', access_token=token), 409)
        profile = {'fullName': 'Auth Regression', 'jobTitle': 'Developer', 'bio': 'Profile test', 'version': saved['user']['version'], 'avatarBase64': image((255, 0, 0)), 'avatarPublic': False}
        user = self.expect_status(self.request('/api/identity/profile', profile, method='PUT', access_token=token), 200)[1]['data']
        public = '/api/identity/public/avatars/' + account_id
        self.expect_status(self.request(public), 404)
        self.expect_status(self.request('/api/identity/profile/avatar', access_token=token), 200)
        complete = {**body, 'status': 'COMPLETED', 'step': 3, 'version': user['version']}
        self.expect_status(self.request(path, complete, method='PUT', access_token=token), 400)
        draft.update(goals='Cần đội phát triển website quản lý lịch hẹn.', about='Phát triển ứng dụng React và phối hợp cùng đội triển khai sản phẩm.', shareAvatar=True)
        completed = self.expect_status(self.request(path, complete, method='PUT', access_token=token), 200)[1]['data']
        assert completed['user']['onboardingStatus'] == 'COMPLETED'
        first_image = self.expect_status(self.request(public), 200)[1]
        assert isinstance(first_image, bytes)
        updated = self.expect_status(self.request('/api/identity/profile', {**profile, 'version': completed['user']['version'], 'avatarBase64': image((0, 0, 255)), 'avatarPublic': True}, method='PUT', access_token=token), 200)[1]['data']
        assert self.expect_status(self.request(public), 200)[1] != first_image
        self.expect_status(self.request('/api/identity/profile', {**profile, 'version': updated['version'], 'avatarBase64': None, 'avatarPublic': False}, method='PUT', access_token=token), 200)
        self.expect_status(self.request(public), 404)
        self.expect_status(self.request('/api/identity/profile/avatar', access_token=token), 200)
        self.onboarding_before_restart = self.request(path, access_token=token)[1]['data']
        deferred = self.expect_status(self.request('/api/identity/auth/register', {'fullName': 'Deferred Setup', 'email': 'deferred-setup@example.test', 'password': self.password, 'confirmPassword': self.password, 'accountPurpose': 'UNDECIDED'}), 201)[1]['data']
        assert deferred['onboardingStatus'] == 'DEFERRED' and deferred['accountPurpose'] == 'UNDECIDED'
        print('PASS: onboarding intent, persisted deferral/drafts, stale versions, completion and canonical opt-in avatar updates', flush=True)

    def after_restart(self, port):
        self.port = port
        assert self.request('/api/identity/.well-known/jwks.json')[1] == self.jwks
        assert self.query('SELECT SUM(request_count) FROM auth_rate_limit_buckets;', 'identity') == self.buckets_before_restart
        refreshed = self.expect_status(self.request('/api/identity/auth/refresh-token', {}), 200)
        assert self.request('/api/identity/onboarding', access_token=refreshed[1]['data']['accessToken'])[1]['data'] == self.onboarding_before_restart
        self.checks += 2
        print('PASS: stable JWKS, existing refresh session and durable rate budgets after restart', flush=True)

    def clean_fixtures(self):
        self.query('''
            UPDATE refresh_tokens SET replaced_by_id=NULL;
            DELETE FROM refresh_tokens;
            DELETE FROM auth_sessions;
            DELETE FROM account_tokens;
            DELETE FROM outbox_events;
            DELETE FROM users;
            DELETE FROM auth_rate_limit_buckets;
        ''', 'identity')


def check_v2_upgrade(root, query):
    db = 'tasknest_identity_upgrade_test'
    query(f'CREATE DATABASE {db};')
    migrations = root / 'services/identity-service/src/main/resources/db/migration'
    query((migrations / 'V1__initialize_service.sql').read_text(), db)
    query((migrations / 'V2__create_domain_schema.sql').read_text(), db)
    query('''
        INSERT INTO users(id,full_name,email,password_hash) VALUES (1,'Legacy User','legacy@example.test','fixture');
        INSERT INTO account_tokens(user_id,purpose,token_hash,created_at,expires_at,revoked_at)
          VALUES (1,'EMAIL_VERIFICATION',UNHEX(SHA2('legacy-first',256)),'2026-10-20','2026-10-21','2026-10-20 01:00:00');
        INSERT INTO account_tokens(user_id,purpose,token_hash,created_at,expires_at)
          VALUES (1,'EMAIL_VERIFICATION',UNHEX(SHA2('legacy-resend',256)),'2026-10-20 01:00:00','2026-10-21 01:00:00');
    ''', db)
    query((migrations / 'V3__track_account_token_issue_source.sql').read_text(), db)
    assert query('SELECT GROUP_CONCAT(issue_source ORDER BY id) FROM account_tokens;', db) == 'REGISTER,RESEND'
    print('PASS: V2 data upgrade to V3 preserves and classifies token history', flush=True)

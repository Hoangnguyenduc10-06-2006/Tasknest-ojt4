"""Security regressions; called only inside test-auth-mail.py's disposable stack."""
import datetime
import json
import time
import uuid
from rate_limit_checks import check_in_one_window


def check_security_regressions(auth, schema, env, rabbit, command, wait_for):
    def forwarded(ip):
        return {'X-Tasknest-Proxy-Key': env['TASKNEST_PROXY_KEY'], 'X-Tasknest-Client-IP': ip}
    def register(email, password='Audit-password-123'):
        return auth.request('/api/identity/auth/register', {'fullName': 'Audit Test', 'email': email,
            'password': password, 'confirmPassword': password})
    auth.expect_status(register('a' * 65 + '@example.test'), 400)
    auth.expect_status(auth.request('/api/identity/auth/login', {'email': 'a' * 65 + '@example.test', 'password': auth.password}), 400)
    auth.expect_status(register('long-ascii@example.test', 'a' * 73), 400)
    auth.expect_status(register('long-unicode@example.test', 'ậ' * 25), 400)
    def login_ip_budget():
        for i in range(100):
            auth.expect_status(auth.request('/api/identity/auth/login', {'email': f'unknown-{i}@example.test',
                'password': 'wrong-password'}, extra_headers=forwarded('192.0.2.1')), 401)
        auth.expect_status(auth.request('/api/identity/auth/login', {'email': auth.email, 'password': auth.password},
            extra_headers=forwarded('192.0.2.1')), 429)
        auth.expect_status(auth.request('/api/identity/auth/login', {'email': auth.email, 'password': auth.password},
            extra_headers=forwarded('192.0.2.2')), 200)
    check_in_one_window(schema, 'LOGIN', 'IP', login_ip_budget)
    # Cheap duplicate-account requests consume a durable registration budget before hashing/DB writes.
    def registration_budget():
        for _ in range(10): auth.expect_status(register(auth.email), 409)
        limited = auth.expect_status(register(auth.email), 429)
        assert int(limited[2].get('Retry-After', limited[2].get('retry-after', 0))) > 0
    check_in_one_window(schema, 'REGISTER', 'IP', registration_budget)
    # Global budget spans different source IPs and both mail-producing operations.
    def global_mail_budget():
        for i in range(12):
            auth.expect_status(auth.request('/api/identity/auth/resend-verification', {'email': 'absent@example.test'},
                extra_headers=forwarded(f'198.51.100.{i+1}')), 404)
        auth.expect_status(auth.request('/api/identity/auth/resend-verification', {'email': 'absent@example.test'},
            extra_headers=forwarded('198.51.100.100')), 429)
    check_in_one_window(schema, 'MAIL', 'GLOBAL', global_mail_budget)
    print('PASS: proxy IP budgets isolated, register/global mail throttled, consistent email and BCrypt limits', flush=True)

    def enqueue(expires):
        event_id = str(uuid.uuid4())
        schema.sql("""INSERT INTO outbox_events(event_id,aggregate_type,aggregate_id,aggregate_version,event_type,schema_version,occurred_at,payload,sensitive_payload,encryption_key_id,status,available_at)
            SELECT '%s',aggregate_type,aggregate_id,aggregate_version,event_type,schema_version,UTC_TIMESTAMP(6),
            JSON_SET(payload,'$.expiresAt','%s'),sensitive_payload,encryption_key_id,'PENDING',UTC_TIMESTAMP(6)
            FROM outbox_events ORDER BY occurred_at LIMIT 1;""" % (event_id, expires.strftime('%Y-%m-%dT%H:%M:%SZ')), 'identity')
        wait_for(lambda: schema.sql("SELECT status FROM outbox_events WHERE event_id='%s';" % event_id, 'identity') == 'PUBLISHED', 'event publish')
        return event_id
    expired = enqueue(datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=25))
    wait_for(lambda: schema.sql("SELECT COUNT(*) FROM processed_events WHERE event_id='%s';" % expired, 'notification') == '1', 'expired event consumed')
    assert schema.sql("SELECT COUNT(*) FROM email_jobs WHERE event_id='%s';" % expired, 'notification') == '0'

    def queues():
        return json.loads(command(['docker', 'exec', '--user', '100:101', rabbit, 'rabbitmqctl', 'list_queues',
            '-p', '/tasknest', 'name', 'messages', 'messages_unacknowledged', '--formatter=json']))
    def dead_lettered():
        rows = queues()
        return (next(x['messages'] for x in rows if x['name'] == 'tasknest.notification.dead-letter') == 1
            and next(x['messages_unacknowledged'] for x in rows if x['name'] == 'tasknest.notification.events') == 0)
    # Force a temporary DB failure only in this disposable schema; retry must exhaust and reject to DLQ.
    schema.sql('RENAME TABLE email_jobs TO email_jobs_test_unavailable;', 'notification')
    try:
        failed = enqueue(datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=1))
        wait_for(dead_lettered, 'retry exhausted to DLQ', 30)
        assert schema.sql("SELECT COUNT(*) FROM processed_events WHERE event_id='%s';" % failed, 'notification') == '0'
    finally:
        schema.sql('RENAME TABLE email_jobs_test_unavailable TO email_jobs;', 'notification')
    print('PASS: expired event ACK/deduped without mail; DB failure retries then DLQ with no stuck unacked message', flush=True)

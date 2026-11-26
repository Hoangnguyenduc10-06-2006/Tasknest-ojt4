"""Runs only against test-auth-mail.py's disposable services and fake Brevo."""
import concurrent.futures
import uuid
from auth_integration_checks import AuthChecks


def check_project_members(auth, schema, start, identity_port, notification_port, fake_brevo, wait_for):
    schema.sql('CREATE DATABASE tasknest_work;')
    fake_brevo.status = 201
    work_port = start('work-service', [f'--spring.cloud.discovery.client.simple.instances.identity-service[0].uri=http://127.0.0.1:{identity_port}'])
    schema.sql('DELETE FROM auth_rate_limit_buckets;', 'identity')
    owner = auth.expect_status(auth.login(), 200)[1]['data']
    owner_id, owner_token = owner['user']['id'], owner['accessToken']
    users = []
    for index in range(3):
        user = str(uuid.uuid4()); email = f'member-{index}@example.test'
        schema.sql(f"INSERT INTO users(id,full_name,email,password_hash,is_email_verified,email_verified_at) SELECT '{user}','Member {index}','{email}',password_hash,1,UTC_TIMESTAMP(6) FROM users WHERE id='{owner_id}';", 'identity')
        session = AuthChecks(identity_port, schema.sql)
        session.email = email; session.password = auth.password
        session.request('/api/identity/status')
        token = session.expect_status(session.login(), 200)[1]['data']['accessToken']
        users.append((user, email, token))
    api = AuthChecks(work_port, schema.sql)
    def request(path, body=None, token=owner_token, method=None, status=200):
        response = api.request('/api/work/projects' + path, body, access_token=token, method=method)
        assert response[0] == status, (path, response[0], response[1])
        return response[1].get('data')
    created = request('', {'name':'Members integration', 'description':'Real members integration checks', 'startsOn':'2026-10-19', 'endsOn':'2026-11-15'}, status=201)
    project = '/' + str(created['id'])
    target, email, token = users[0]
    outsider, _, outsider_token = users[1]
    request(project+'/members', token=token, status=404)
    request(project+'/invitations', {'email':'missing@example.test'}, status=400)
    invitation = request(project+'/invitations', {'email':email.upper()}, status=201)
    request(project+'/invitations', {'email':email}, status=409)
    request(project+'/invitations/'+str(invitation)+'/accept', {}, status=404, method='PUT')
    wait_for(lambda: schema.sql("SELECT COUNT(*) FROM email_jobs WHERE purpose='PROJECT_EVENT' AND status='ACCEPTED';", 'notification') == '1', 'project invitation email accepted')
    assert schema.sql("SELECT COUNT(*) FROM notifications WHERE event_type='work.project-invitation.created';", 'notification') == '1'
    delivered = next(message for message in fake_brevo.messages if message['to'][0]['email'] == email)
    assert 'http://localhost:3000/invitations' in delivered['textContent']
    assert 'verify-email' not in delivered['textContent']
    # At-least-once relay must not duplicate either in-app notification or email job.
    schema.sql("UPDATE outbox_events SET status='PENDING',available_at=UTC_TIMESTAMP(6) WHERE event_type='work.project-invitation.created';", 'work')
    wait_for(lambda: schema.sql("SELECT attempts FROM outbox_events WHERE event_type='work.project-invitation.created';", 'work') == '2', 'project event republish')
    wait_for(lambda: schema.sql("SELECT status FROM outbox_events WHERE event_type='work.project-invitation.created';", 'work') == 'PUBLISHED', 'project republish confirm')
    assert schema.sql("SELECT COUNT(*) FROM email_jobs WHERE purpose='PROJECT_EVENT';", 'notification') == '1'
    request(project+'/invitations/'+str(invitation)+'/accept', {}, token=token, method='PUT')
    request(project+'/members?tab=invitations', token=token, status=403)
    request(project+'/invitations', {'email':users[1][1]}, token=token, status=403)
    request(project+'/invitation-link', {'action':'CREATE'}, token=token, method='PUT', status=403)
    request(project+'/invitations', {'email':email}, status=409)
    request(project+'/members/'+target+'/role', {'role':'Manager'}, method='PUT')
    link = request(project+'/invitation-link', {'action':'CREATE'}, token=token, method='PUT')
    assert len(link['code']) == 64
    old_code = link['code']
    request(project+'/members/'+owner_id+'/role', {'role':'Member'}, method='PUT', status=409)
    request(project+'/members/'+target+'/remove', {}, token=token, method='PUT', status=403)
    request('/workspace/join-requests', {'code':old_code, 'reason':'Ready to join'}, token=outsider_token, status=201)
    requests = request(project+'/members?tab=requests')['items']
    request_id = str(requests[0]['id'])
    link = request(project+'/invitation-link', {'action':'ROTATE'}, method='PUT')
    request('/workspace/join-links/'+old_code, token=outsider_token, status=404)
    assert link['code'] != old_code
    request(project+'/join-requests/'+request_id+'/decision', {'accept':True}, token=token, method='PUT')
    assert request(project+'/members', token=outsider_token)['role'] == 'MEMBER'
    # A single Manager, demotion of the previous one, then immediate removal of permissions.
    request(project+'/members/'+outsider+'/role', {'role':'Manager'}, method='PUT')
    assert request(project+'/members', token=token)['role'] == 'MEMBER'
    request(project+'/invitation-link', {'action':'ROTATE'}, token=token, method='PUT', status=403)
    request(project+'/members/'+target+'/remove', {}, method='PUT')
    request(project+'/members', token=token, status=404)
    # Removal is blocked while tasks remain unfinished.
    from datetime import datetime, timedelta, timezone
    today = datetime.now(timezone(timedelta(hours=7))).date()
    request(project+'/tasks', {'title':'Assigned task', 'description':'Test removal invariant', 'assigneeId':outsider, 'priority':'MEDIUM', 'startsOn':str(today), 'deadlineOn':str(today+timedelta(days=2)), 'estimatedSeconds':3600}, status=201)
    request(project+'/members/'+outsider+'/remove', {}, method='PUT', status=409)
    # The original sender alone may revoke, even if a different manager can list invitations.
    invited = request(project+'/invitations', {'email':users[2][1]}, status=201)
    request(project+'/invitations/'+str(invited)+'/cancel', {}, token=outsider_token, method='PUT', status=409)
    request(project+'/invitations/'+str(invited)+'/cancel', {}, method='PUT')
    # Concurrent invitations are serialized by the project lock.
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        statuses = list(pool.map(lambda _: api.request('/api/work/projects'+project+'/invitations', {'email':users[2][1]}, access_token=owner_token)[0], range(2)))
    assert sorted(statuses) == [201,409], statuses
    request(project+'/members?size=15', status=400)
    request(project+'/members?page=2147483647', status=400)
    request(project+'/invitation-link', {'action':'DISABLE'}, method='PUT')
    request('/workspace/join-links/'+link['code'], token=token, status=404)
    # Archived projects reject all member writes.
    schema.sql(f"UPDATE projects SET status='ARCHIVED',archived_at=UTC_TIMESTAMP(6),archived_by='{owner_id}' WHERE id={created['id']};", 'work')
    request(project+'/invitations', {'email':email}, status=409)
    request(project+'/invitation-link', {'action':'CREATE'}, method='PUT', status=409)
    request(project+'/members/'+outsider+'/role', {'role':'Member'}, method='PUT', status=409)
    print('PASS: real Identity/Work/MySQL/RabbitMQ + fake Brevo invitation email and notification, deduplication, acceptance, permissions, role replacement, task removal guard, QR link rotation/disable, join approval, concurrency and archive guards.', flush=True)

    from discovery_notification_checks import run as check_discovery_notifications
    check_discovery_notifications(auth, schema, work_port, notification_port, wait_for)

    from rule_completion_checks import run as check_rule_completion
    check_rule_completion(auth,schema,work_port,notification_port,fake_brevo,wait_for)

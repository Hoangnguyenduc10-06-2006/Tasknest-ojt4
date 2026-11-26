"""Discovery outbox -> real RabbitMQ -> recipient inbox, only in disposable test services."""
import json
import uuid
from datetime import datetime, timedelta, timezone
from auth_integration_checks import AuthChecks


def run(auth, schema, work_port, notification_port, wait):
    schema.sql('DELETE FROM auth_rate_limit_buckets;', 'identity')

    def login(email):
        client = AuthChecks(auth.port, schema.sql)
        client.email, client.password = email, auth.password
        client.request('/api/identity/status')
        session = client.expect_status(client.login(), 200)[1]['data']
        return session['user']['id'], session['accessToken']

    owner, owner_token = login(auth.email)
    candidate, candidate_token = login('member-2@example.test')
    customer, customer_token = login('member-1@example.test')
    invited, invited_token = login('member-0@example.test')
    api, inbox = AuthChecks(work_port, schema.sql), AuthChecks(notification_port, schema.sql)

    def request(path, body=None, token=owner_token, method=None, status=200):
        result = api.request('/api/work/community' + path, body, access_token=token, method=method)
        assert result[0] == status, (path, result[0], result[1])
        return result[1].get('data')

    def items(token):
        result = inbox.request('/api/notifications/inbox?size=50', access_token=token)
        assert result[0] == 200, result[0]
        return result[1]['items']

    def find(token, event):
        return next((item for item in items(token) if item['eventType'] == event), None)

    team = request('/teams', {'name': 'Đội kiểm tra thông báo', 'description': 'Kiểm tra luồng thông báo khám phá với hạ tầng thực.', 'skills': 'Java, React', 'acceptingWork': True}, status=201)
    base = f'/teams/{team}'
    request(base + '/invitations/by-user', {'userId': invited})
    wait(lambda: find(invited_token, 'team.invitation.created'), 'team invitation in recipient inbox')
    assert find(invited_token, 'team.invitation.created')['destinationPath'] == '/team-management'
    request(base + '/invitation', {'value': True}, token=invited_token, method='PUT')
    wait(lambda: find(owner_token, 'team.invitation.accepted'), 'team invitation response in owner inbox')
    assert schema.sql("SELECT COUNT(*) FROM outbox_events WHERE event_type='work.notification.v2.created' AND payload->>'$.type'='team.invitation.created';", 'work') == '1'
    tomorrow = datetime.now(timezone.utc).date() + timedelta(days=1)
    opening = request(base + '/openings', {'title': 'Lập trình viên React', 'description': 'Phát triển giao diện và phối hợp triển khai sản phẩm.', 'skills': 'React', 'workMode': 'REMOTE', 'weeklyHours': 20, 'slots': 1, 'closesOn': str(tomorrow + timedelta(days=20)), 'requestId': str(uuid.uuid4())}, status=201)
    application_body = {'introduction': 'Tôi có kinh nghiệm React và có thể tham gia phát triển sản phẩm.', 'skills': 'React', 'weeklyHours': 20, 'consent': True}
    application = request(f'{base}/openings/{opening}/applications', application_body, token=candidate_token, status=201)
    assert request(f'{base}/openings/{opening}/applications', application_body, token=candidate_token, status=201) == application
    wait(lambda: find(owner_token, 'discovery.application.created'), 'application in owner inbox')
    notification = find(owner_token, 'discovery.application.created')
    assert notification['projectId'] is None and notification['destinationPath'] == f'/team-management/{team}?opening={opening}&application={application}'
    assert not find(candidate_token, 'discovery.application.created')
    filtered=inbox.request('/api/notifications/inbox?size=10&category=discovery&unreadOnly=true',access_token=owner_token)
    assert filtered[0]==200 and filtered[1]['total']>=1
    assert all(item['eventType'].startswith(('discovery.','team.invitation.','work.milestone-')) for item in filtered[1]['items'])
    assert filtered[1]['matchingTotal']>=filtered[1]['total']
    event = schema.sql("SELECT event_id FROM outbox_events WHERE payload->>'$.type'='discovery.application.created' LIMIT 1;", 'work')
    wait(lambda: schema.sql(f"SELECT status FROM outbox_events WHERE event_id='{event}';", 'work') == 'PUBLISHED', 'first discovery publish confirmation')
    schema.sql(f"UPDATE outbox_events SET status='PENDING',available_at=UTC_TIMESTAMP(6) WHERE event_id='{event}';", 'work')
    wait(lambda: schema.sql(f"SELECT attempts>=2 AND status='PUBLISHED' FROM outbox_events WHERE event_id='{event}';", 'work') == '1', 'discovery replay publisher confirmation')
    assert schema.sql(f"SELECT COUNT(*) FROM notifications WHERE event_id='{event}';", 'notification') == '1'
    request(f'{base}/openings/{opening}/applications/{application}/review', {'accepted': True, 'feedback': 'Chào mừng bạn tham gia đội.', 'version': 0}, method='PUT')
    wait(lambda: find(candidate_token, 'discovery.application.accepted'), 'application decision in candidate inbox')
    assert find(candidate_token, 'discovery.application.accepted')['destinationPath'] == f'/teams?view=applications&application={application}'

    project_request = request('/requests', {'title': 'Website quản lý đặt lịch', 'description': 'Khách hàng cần website đặt lịch, quản lý khách hàng và theo dõi lịch hẹn.', 'skills': 'React', 'budgetMin': None, 'budgetMax': None, 'desiredDelivery': str(tomorrow + timedelta(days=40)), 'referenceUrl': None, 'publish': True, 'requestId': str(uuid.uuid4())}, token=customer_token, status=201)
    request(f'/requests/{project_request}/proposals', {'teamId': team, 'requestVersion': 0, 'plan': 'Thiết kế, phát triển giao diện, kiểm thử và bàn giao mã nguồn.', 'amount': 12000000, 'startsOn': str(tomorrow), 'endsOn': str(tomorrow + timedelta(days=30))}, method='PUT')
    wait(lambda: find(customer_token, 'discovery.proposal.created'), 'proposal in customer inbox')
    proposal = request(f'/requests/{project_request}/proposals', token=customer_token)['items'][0]['id']
    private_text = 'PRIVATE-DISCUSSION-' + uuid.uuid4().hex
    message_body = {'body': private_text, 'clientId': str(uuid.uuid4())}
    discussion = f'/requests/{project_request}/proposals/{proposal}/messages'
    message = request(discussion, message_body, token=customer_token, status=201)
    assert request(discussion, message_body, token=customer_token, status=201) == message
    wait(lambda: find(owner_token, 'discovery.discussion.message'), 'private discussion in owner inbox')
    assert find(owner_token, 'discovery.discussion.message')['destinationPath'] == f'/requests/{project_request}?proposal={proposal}&discussion=1'
    assert private_text not in json.dumps(items(owner_token))
    request(discussion, token=candidate_token, status=404)
    assert schema.sql("SELECT COUNT(*) FROM email_jobs WHERE event_type LIKE 'discovery.%';", 'notification') == '0'
    print('PASS discovery: real Identity/Work/outbox/RabbitMQ/Notification inbox, private recipients, exact destinations, retry deduplication, applicant decisions and message privacy.', flush=True)

    # Direct messaging shares the real outbox/inbox pipeline without copying chat bodies.
    room = request('/chat', {'kind': 'DIRECT', 'target': candidate}, status=201)
    private_chat = 'PRIVATE-CHAT-' + uuid.uuid4().hex
    chat_body = {'body': private_chat, 'clientId': str(uuid.uuid4())}
    chat_message = request(f'/chat/{room}/messages', chat_body, status=201)
    assert request(f'/chat/{room}/messages', chat_body, status=201) == chat_message
    wait(lambda: find(candidate_token, 'discovery.chat.message'), 'direct message in recipient inbox')
    chat_notice = find(candidate_token, 'discovery.chat.message')
    assert chat_notice['destinationPath'] == f'/messages?conversation={room}' and chat_notice['projectId'] is None
    assert private_chat not in json.dumps(items(candidate_token))
    assert schema.sql("SELECT COUNT(*) FROM notifications WHERE event_type='discovery.chat.message';", 'notification') == '1'
    assert schema.sql("SELECT COUNT(*) FROM email_jobs WHERE event_type='discovery.chat.message';", 'notification') == '0'
    request(f'/chat/{room}', token=customer_token, status=404)
    history = request(f'/chat/{room}', token=candidate_token)
    assert history['items'][0]['body'] == private_chat
    request(f'/chat/{room}/read', {'messageId': chat_message}, token=candidate_token, method='PUT')
    assert request('/chat/unread', token=candidate_token) == 0
    print('PASS messaging: real Identity tokens, Work/MySQL/outbox/RabbitMQ/Notification inbox, private text, precise conversation routing and duplicate suppression.', flush=True)

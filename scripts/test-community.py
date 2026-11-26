#!/usr/bin/env python3
"""Verify team reputation through Gateway, Work, Flyway and disposable MySQL."""
import base64
import concurrent.futures
from datetime import datetime, timedelta, timezone
import http.server
import importlib.util
import json
import os
from pathlib import Path
import secrets
import struct
import subprocess
import tempfile
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
import zlib

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("project_checks", ROOT / "scripts/test-project-foundation.py")
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)


class Identity(base.IdentityStub):
    def do_GET(self):
        if self.path == f"/internal/identity/profiles/{base.MEMBER}/avatar":
            self.send_response(200)
            self.send_header("Content-Type", "image/png")
            self.end_headers()
            self.wfile.write(chat_test_png(b"\x00\x60\x80"))
            return
        if self.path.startswith("/internal/identity/invitation-users?"):
            return self.reply([{"id": base.MEMBER, "fullName": "Lập trình viên"}, {"id": base.OUTSIDER, "fullName": "Thành viên mới"}])
        if self.path.startswith("/internal/identity/invitation-users/"):
            user = self.path.rsplit("/", 1)[1]
            if user not in (base.OWNER, base.OTHER, base.MEMBER, base.OUTSIDER):
                self.send_response(404)
                self.end_headers()
                return
            return self.reply({"id": user, "fullName": {base.MEMBER: "Lập trình viên", base.OUTSIDER: "Thành viên mới", base.OTHER: "Khách hàng"}.get(user, "Trưởng đội")})
        if self.path.startswith("/internal/identity/profiles?"):
            ids = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query).get("ids", [""])[0].split(",")
            return self.reply([{"id": user, "fullName": {base.OWNER: "Trưởng đội", base.OTHER: "Khách hàng", base.MEMBER: "Lập trình viên"}.get(user, "Người xem")} for user in ids])
        if self.path.startswith("/internal/identity/invitation-recipient"):
            return self.reply({"id": base.MEMBER, "email": "member@example.test"})
        super().do_GET()

    def reply(self, body):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(body).encode())


def chat_test_png(rgb):
    def chunk(kind, data):
        payload = kind + data
        return struct.pack('!I', len(data)) + payload + struct.pack('!I', zlib.crc32(payload))

    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('!IIBBBBB', 1, 1, 8, 2, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(b'\0' + rgb)) + chunk(b'IEND', b''))


def send_chat_image(request, room, image, *, token='valid-owner', caption=None,
                    client_id=None, filename='test.png', expected=201):
    boundary = 'tasknest-chat-' + uuid.uuid4().hex
    body = bytearray()

    def part(disposition, data, content_type):
        body.extend(f'--{boundary}\r\nContent-Disposition: form-data; {disposition}\r\n'
                    f'Content-Type: {content_type}\r\n\r\n'.encode())
        body.extend(data)
        body.extend(b'\r\n')

    part('name="clientId"', (client_id or str(uuid.uuid4())).encode(), 'text/plain')
    if caption is not None:
        part('name="body"', caption.encode(), 'text/plain; charset=utf-8')
    part(f'name="file"; filename="{filename}"', image, 'image/png')
    body.extend(f'--{boundary}--\r\n'.encode())
    return request(room + '/messages', token=token, body=bytes(body), method='POST',
                   content_type=f'multipart/form-data; boundary={boundary}', expected=expected)


def check_chat_image(request, path, expected_bytes, token='valid-owner'):
    headers, data = request(path, token=token, raw=True)
    assert headers.get_content_type() == 'image/png'
    assert {'private', 'no-store'} <= {part.strip() for part in headers['Cache-Control'].split(',')}
    assert headers['X-Content-Type-Options'] == 'nosniff'
    assert data == expected_bytes


def check_messaging(request, sql, project, team):
    chat = '/api/work/community/chat'
    png = chat_test_png(b'\x00\x60\x80')
    request(chat, token=None, expected=401)
    request(chat, token='unverified', expected=403)
    request(chat + '?page=-1', expected=400)
    request(chat + '/people?search=x', expected=400)
    assert request(chat + '/people?search=dev')
    for target in (base.OWNER, 'bad', '00000000-0000-4000-8000-000000000099'):
        request(chat, body={'kind': 'DIRECT', 'target': target}, expected=400)
    direct = request(chat, body={'kind': 'DIRECT', 'target': base.MEMBER}, expected=201)
    room = f'{chat}/{direct}'
    assert request(chat, token='valid-member', body={'kind': 'DIRECT', 'target': base.OWNER}, expected=201) == direct
    request(room, token='valid-outsider', expected=404)
    request(room + '/messages', token='valid-outsider', body={'body': 'Không được đọc hoặc gửi.', 'clientId': str(uuid.uuid4())}, expected=404)
    request(room + '/read', token='valid-outsider', body={'messageId': 1}, method='PUT', expected=404)
    message = {'body': 'Chào bạn, cùng trao đổi về dự án nhé! <script>alert(1)</script>', 'clientId': str(uuid.uuid4())}
    first = request(room + '/messages', body=message, expected=201)
    assert request(room + '/messages', body=message, expected=201) == first
    request(room + '/messages', body={**message, 'body': 'Nội dung khác'}, expected=409)
    request(room + '/messages', body={'body': '   ', 'clientId': str(uuid.uuid4())}, expected=400)
    request(room + '/messages', body={'body': 'x' * 4001, 'clientId': str(uuid.uuid4())}, expected=400)
    assert request(chat + '/unread', token='valid-member') == 1
    assert request(chat, token='valid-member')['items'][0]['unread'] == 1
    assert request(chat, token='valid-outsider')['items'] == []
    request(room + '/read', token='valid-member', body={'messageId': first}, method='PUT')
    assert request(chat + '/unread', token='valid-member') == 0
    assert next(p for p in request(room)['participants'] if p['userId'] == base.MEMBER)['readId'] == first
    request(room + '/block', token='valid-member', body={'blocked': True}, method='PUT')
    assert request(room, token='valid-member')['myBlocked'] is True
    assert request(room)['canSend'] is False
    request(room + '/messages', body={'body': 'Không được gửi khi đã chặn.', 'clientId': str(uuid.uuid4())}, expected=409)
    send_chat_image(request, room, png, expected=409)
    assert request(chat, body={'kind': 'DIRECT', 'target': base.MEMBER}, expected=201) == direct
    request(room + '/block', body={'blocked': False}, method='PUT')
    assert request(room)['canSend'] is False  # cannot remove the peer's block
    request(room + '/block', token='valid-member', body={'blocked': False}, method='PUT')
    assert request(room)['canSend'] is True
    duplicate = {'body': 'Chỉ lưu một lần khi gửi lại do mất mạng.', 'clientId': str(uuid.uuid4())}
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        ids = list(pool.map(lambda _: request(room + '/messages', body=duplicate, expected=201), range(3)))
    assert len(set(ids)) == 1
    before_limit = request(room)
    assert before_limit['remainingBeforeFriendship'] == 1 and before_limit['connectionState'] == 'NONE'
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda i: request(room + '/messages', body={'body': f'Mở lời {i}', 'clientId': str(uuid.uuid4())}, expected=(201, 409)), range(2)))
    assert sum(isinstance(result, int) for result in results) == 1
    assert request(room)['remainingBeforeFriendship'] == 0 and not request(room)['canSend']
    assert request(room, token='valid-member')['remainingBeforeFriendship'] == 3
    assert request(room + '/messages', body=duplicate, expected=201) == ids[0]
    send_chat_image(request, room, png, expected=409)
    profile_avatar = f"/api/work/community/members/{base.MEMBER}/avatar"
    request(profile_avatar, token=None, expected=401)
    request(profile_avatar, expected=404)
    connections = '/api/work/community/connections/'
    request(connections + base.MEMBER, body={'action': 'REQUEST'}, method='PUT')
    outgoing = request(room)
    assert not outgoing['canSend'] and outgoing['connectionState'] == 'OUTGOING'
    assert request(room, token='valid-member')['connectionState'] == 'INCOMING'
    request(connections + base.OWNER, token='valid-member', body={'action': 'ACCEPT'}, method='PUT')
    assert request(profile_avatar, raw=True)[1] == png
    request(profile_avatar, token='valid-outsider', expected=404)
    accepted = request(room)
    avatar = f"{chat}/{direct}/participants/{base.MEMBER}/avatar"
    assert request(avatar, raw=True)[1] == png
    request(avatar, token='valid-outsider', expected=404)
    request(avatar, token=None, expected=401)
    assert accepted['remainingBeforeFriendship'] is None and accepted['canSend'] and accepted['connectionState'] == 'ACCEPTED'
    for index in range(41):
        request(room + '/messages', body={'body': f'Tin nhắn lịch sử số {index}', 'clientId': str(uuid.uuid4())}, expected=201)
    history = request(room)
    assert len(history['items']) == 40 and history['nextBefore']
    older = request(room + '?before=' + str(history['nextBefore']))
    assert len(older['items']) == 4 and older['nextBefore'] is None
    assert not set(m['id'] for m in history['items']) & set(m['id'] for m in older['items'])
    request(room + '/read', token='valid-member', body={'messageId': history['items'][-1]['id']}, method='PUT')
    request(room + '/read', token='valid-member', body={'messageId': first}, method='PUT')
    assert request(chat + '/unread', token='valid-member') == 0
    assert not history['items'][-1].get('has_image')
    request(f'{room}/messages/{first}/image', expected=404)
    image_client_id = str(uuid.uuid4())
    direct_image = send_chat_image(request, room, png, token='valid-member', client_id=image_client_id)
    assert send_chat_image(request, room, png, token='valid-member', client_id=image_client_id) == direct_image
    send_chat_image(request, room, chat_test_png(b'\x80\x60\x00'), token='valid-member',
                    client_id=image_client_id, expected=409)
    request(room + '/messages', token='valid-member',
            body={'body': 'Đây là tin nhắn khác.', 'clientId': image_client_id}, expected=409)
    send_chat_image(request, room, b'not an image', token='valid-member', expected=400)
    send_chat_image(request, room, png, token='valid-member', filename='test.gif', expected=400)
    send_chat_image(request, room, b'\0' * (5 * 1024 * 1024 + 1), token='valid-member', expected=413)
    send_chat_image(request, room, png, token='valid-outsider', expected=404)
    image_url = f'{room}/messages/{direct_image}/image'
    check_chat_image(request, image_url, png)
    request(image_url, token=None, expected=401)
    request(image_url, token='valid-outsider', expected=404)
    image_message = request(room)['items'][-1]
    assert image_message['id'] == direct_image and not image_message['body'] and image_message['has_image']
    assert request(chat)['items'][0]['lastMessage'] == image_message
    team_room = request(chat, body={'kind': 'TEAM', 'target': str(team)}, expected=201)
    team_path = f'{chat}/{team_room}'
    request(team_path, token='valid-other', expected=404)
    request(chat, token='valid-other', body={'kind': 'TEAM', 'target': str(team)}, expected=404)
    team_message = request(team_path + '/messages', body={'body': 'Trao đổi nội bộ của đội.', 'clientId': str(uuid.uuid4())}, expected=201)
    request(room + '/read', token='valid-member', body={'messageId': team_message}, method='PUT', expected=400)
    request(team_path + '/block', body={'blocked': True}, method='PUT', expected=400)
    assert request(team_path, token='valid-member')['items'][-1]['id'] == team_message
    caption = 'Bản xem trước giao diện'
    team_image = send_chat_image(request, team_path, png, caption=caption)
    assert request(team_path, token='valid-member')['items'][-1]['body'] == caption
    team_image_url = f'{team_path}/messages/{team_image}/image'
    check_chat_image(request, team_image_url, png, token='valid-member')
    request(f'{team_path}/messages/{direct_image}/image', expected=404)
    sql(f"DELETE FROM dev_team_members WHERE team_id={team} AND user_id='{base.MEMBER}';")
    request(team_path, token='valid-member', expected=404)
    request(team_image_url, token='valid-member', expected=404)
    request(team_path + '/messages', token='valid-member', body={'body': 'Đã rời đội', 'clientId': str(uuid.uuid4())}, expected=404)
    assert all(c['id'] != team_room for c in request(chat, token='valid-member')['items'])
    project_room = request(chat, body={'kind': 'PROJECT', 'target': str(project)}, expected=201)
    project_path = f'{chat}/{project_room}'
    assert request(project_path, token='valid-other')['canSend'] is True  # confirmed customer retains collaboration access
    request(project_path, token='valid-outsider', expected=404)
    request(project_path + '/messages', token='valid-other', body={'body': 'Khách hàng trao đổi với đội triển khai.', 'clientId': str(uuid.uuid4())}, expected=201)
    project_image = send_chat_image(request, project_path, png, token='valid-other')
    project_image_url = f'{project_path}/messages/{project_image}/image'
    check_chat_image(request, project_image_url, png, token='valid-member')
    sql(f"UPDATE project_memberships SET status='REMOVED',removed_at=UTC_TIMESTAMP(6),removed_by='{base.OWNER}' WHERE project_id={project} AND user_id='{base.MEMBER}';")
    request(project_path, token='valid-member', expected=404)
    request(project_image_url, token='valid-member', expected=404)
    assert all(p['id'] != project for p in request(chat + '/spaces', token='valid-member')['projects'])
    assert any(p['id'] == project for p in request(chat + '/spaces', token='valid-other')['projects'])
    sql(f"UPDATE projects SET status='ARCHIVED',archived_at=UTC_TIMESTAMP(6),archived_by='{base.OWNER}' WHERE id={project};")
    assert request(project_path)['canSend'] is False
    request(project_path + '/messages', body={'body': 'Dự án lưu trữ', 'clientId': str(uuid.uuid4())}, expected=409)
    send_chat_image(request, project_path, png, token='valid-other', expected=409)
    check_chat_image(request, project_image_url, png, token='valid-other')
    assert sql('SELECT COUNT(*) FROM chat_message_images;') == '3'  # rejected or duplicate sends leave no files
    events = json.loads(bytes.fromhex(sql("SELECT HEX(JSON_ARRAYAGG(payload)) FROM outbox_events WHERE payload->>'$.type'='discovery.chat.message';")).decode('utf-8'))
    assert events and all(e['resourceType'] == 'CONVERSATION' and e['resourceId'].isdigit() and '<script>' not in e['body'] and 'Chào bạn' not in e['body'] and not e['email'] and e['userId'] != e['actorId'] for e in events)
    assert all(e.get('directMessage') == (e['resourceId'] == str(direct)) for e in events)
    print('PASS messaging: private direct/team/project chat, current access, customer collaboration, retries, block/unblock, unread/read receipts, history pagination and transactional private notifications.')
    print('PASS chat images: multipart captions, private binary retrieval, type and size validation, idempotent retries, and access revocation.')


def main():
    container = "tasknest-community-test-" + uuid.uuid4().hex[:8]
    password = secrets.token_hex(24)
    env = {**os.environ, "MYSQL_ROOT_PASSWORD": password, "MYSQL_DATABASE": "tasknest_work",
           "DB_HOST": "127.0.0.1", "DB_USERNAME": "root", "DB_PASSWORD": password, "DB_NAME": "tasknest_work",
           "CONFIG_USERNAME": "unused", "CONFIG_PASSWORD": password, "SCAFFOLD_SECURITY_PASSWORD": password,
           "RABBITMQ_USERNAME": "unused", "RABBITMQ_PASSWORD": password, "EUREKA_URL": "http://127.0.0.1:1/eureka/"}
    processes = []
    logs = []
    fake = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Identity)
    threading.Thread(target=fake.serve_forever, daemon=True).start()
    work, gateway = base.free_port(), base.free_port()

    def sql(query):
        return base.command(["docker", "exec", "-i", container, "sh", "-c",
                             'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --default-character-set=utf8mb4 -uroot -N -B tasknest_work'], input=query)

    def request(path, token="valid-owner", body=None, method=None, expected=200,
                content_type="application/json", raw=False):
        headers = {"Content-Type": content_type}
        if token:
            headers["Authorization"] = "Bearer " + token
        data = body if isinstance(body, bytes) else json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(f"http://127.0.0.1:{gateway}{path}", headers=headers, data=data, method=method)
        try:
            with urllib.request.urlopen(req, timeout=15) as response:
                code = response.status
                result = (response.headers, response.read()) if raw else json.load(response)
        except urllib.error.HTTPError as error:
            code, result = error.code, json.loads(error.read() or b"{}")
        assert code in (expected if isinstance(expected, tuple) else (expected,)), (path, expected, code, result)
        return result if raw else result.get("data")

    with tempfile.TemporaryDirectory(prefix="tasknest-community-") as temporary:
        try:
            base.command(["docker", "run", "-d", "--name", container, "--tmpfs", "/var/lib/mysql",
                          "-p", "127.0.0.1::3306", "-e", "MYSQL_ROOT_PASSWORD", "-e", "MYSQL_DATABASE", "mysql:8.4"], env=env)
            for _ in range(90):
                try:
                    sql("SELECT 1;")
                    break
                except subprocess.CalledProcessError:
                    time.sleep(1)
            else:
                raise AssertionError("MySQL startup timeout")
            env["DB_PORT"] = base.command(["docker", "port", container, "3306/tcp"]).rsplit(":", 1)[1]
            for service, port in [("work-service", work), ("api-gateway", gateway)]:
                parent = "services" if service == "work-service" else "platform"
                java = str(Path(env["JAVA_HOME"]) / "bin/java") if env.get("JAVA_HOME") else "java"
                log = open(Path(temporary) / (service + ".log"), "w+")
                logs.append(log)
                args = [java, "-XX:ActiveProcessorCount=2", "-jar", str(ROOT / parent / service / "target" / (service + "-0.1.0-SNAPSHOT.jar")),
                        "--spring.config.import=", "--spring.cloud.config.enabled=false", "--spring.cloud.config.import-check.enabled=false",
                        "--spring.config.location=" + (ROOT / "infra/config-repo" / (service + ".yml")).as_uri(),
                        "--spring.application.name=" + service, "--server.address=127.0.0.1", "--server.port=" + str(port),
                        "--management.server.port=0", "--management.health.rabbit.enabled=false",
                        "--tasknest.events.publish-enabled=false", "--spring.rabbitmq.listener.simple.auto-startup=false",
                        "--tasknest.files.root=" + temporary + "/files"]
                if service == "work-service":
                    args += ["--eureka.client.enabled=true", "--eureka.client.service-url.defaultZone=http://127.0.0.1:" + str(fake.server_port) + "/eureka/"]
                else:
                    args += ["--eureka.client.enabled=false",
                             f"--spring.cloud.discovery.client.simple.instances.identity-service[0].uri=http://127.0.0.1:{fake.server_port}",
                             f"--spring.cloud.discovery.client.simple.instances.work-service[0].uri=http://127.0.0.1:{work}"]
                process = subprocess.Popen(args, env=env, stdout=log, stderr=subprocess.STDOUT)
                processes.append(process)
                health = "/api/work/status" if service == "work-service" else "/api/status"
                for _ in range(100):
                    if process.poll() is not None:
                        raise AssertionError(service + " exited")
                    try:
                        urllib.request.urlopen(f"http://127.0.0.1:{port}{health}", timeout=2).close()
                        break
                    except OSError:
                        time.sleep(.4)
                else:
                    raise AssertionError(service + " startup timeout")

            public = "/api/work/community"
            request(public + "/teams", token=None)
            request(public + "/me", token=None, expected=401)
            professional = public + "/profile"
            outsider_profile = public + "/members/" + base.OUTSIDER
            request(professional, token=None, expected=401)
            assert request(professional, token="valid-outsider")["configured"] is False
            request(outsider_profile, token=None, expected=404)
            assert request(outsider_profile)["connectionOnly"]
            connections = public + "/connections"
            owner_peer = connections + "/" + base.OUTSIDER
            outsider_peer = connections + "/" + base.OWNER
            request(connections, token=None, expected=401)
            assert request(owner_peer) == "NONE"
            assert request(owner_peer, body={"action":"REQUEST"}, method="PUT") == "OUTGOING"
            assert request(owner_peer, body={"action":"REQUEST"}, method="PUT") == "OUTGOING"
            assert request(outsider_peer, token="valid-outsider") == "INCOMING"
            assert request(connections, token="valid-outsider")["items"][0]["state"] == "INCOMING"
            request(owner_peer, body={"action":"ACCEPT"}, method="PUT", expected=409)
            assert request(outsider_peer, token="valid-outsider", body={"action":"DECLINE"}, method="PUT") == "NONE"
            assert request(owner_peer, body={"action":"REQUEST"}, method="PUT") == "OUTGOING"
            assert request(outsider_peer, token="valid-outsider", body={"action":"ACCEPT"}, method="PUT") == "ACCEPTED"
            assert request(owner_peer) == "ACCEPTED"
            assert request(connections)["items"][0]["userId"] == base.OUTSIDER
            assert request(owner_peer, body={"action":"REMOVE"}, method="PUT") == "NONE"
            assert not request(connections, token="valid-outsider")["items"]

            profile_body = {
                "headline": "Full-stack Developer · React & Java",
                "about": "Phát triển ứng dụng web và hỗ trợ đội triển khai sản phẩm.",
                "location": "Hà Nội · Từ xa", "experienceYears": 2,
                "skills": ["React", "Java", "MySQL"], "desiredRoles": ["Full-stack Developer"],
                "collaborationModes": ["PROJECT", "PART_TIME"], "availability": "LOOKING_FOR_TEAM",
                "weeklyHours": 20, "githubUrl": "https://github.com/example", "linkedinUrl": None,
                "websiteUrl": None, "contactEmail": "dev-contact@example.test", "socialUrl": "https://example.test/portfolio", "portfolioItems": [{"title": "Website quản lý lịch hẹn", "role": "Phát triển API",
                    "description": "Thiết kế cơ sở dữ liệu và API cho sản phẩm.", "url": "https://example.test/product"}],
                "isPublic": False,
            }
            private = request(professional, token="valid-outsider", body=profile_body, method="PUT")
            assert private["version"] == 0 and private["configured"] is True
            request(outsider_profile, token=None, expected=404)
            public_body = {**profile_body, "isPublic": True, "version": 0, "userId": base.OWNER}
            request(professional, token="valid-outsider", body=public_body, method="PUT")
            shared = request(outsider_profile, token=None)
            assert shared["professional"]["headline"] == profile_body["headline"]
            assert shared["teams"] == [] and "email" not in shared and "email" not in shared["professional"]
            assert shared["professional"]["contact_email"] == "dev-contact@example.test"
            assert shared["professional"]["social_url"] == "https://example.test/portfolio"
            request(public + "/likes/MEMBER/" + base.OUTSIDER, token="valid-other", body={"value": True}, method="PUT")
            assert request(outsider_profile, token=None)["likes"] == 1
            request(professional, token="valid-outsider", body={**profile_body, "githubUrl": "javascript:alert(1)", "version": 1}, method="PUT", expected=400)
            request(professional, token="valid-outsider", body={**profile_body, "headline": " ", "isPublic": True, "version": 1}, method="PUT", expected=400)
            request(professional, token="valid-outsider", body={**profile_body, "version": 0}, method="PUT", expected=409)
            request(professional, token="valid-outsider", body={**profile_body, "version": 1}, method="PUT")
            request(outsider_profile, token=None, expected=404)
            def save_profile(_):
                return request(professional, token="valid-outsider", body={**profile_body, "isPublic": True, "version": 2}, method="PUT", expected=(200,409))
            with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
                saves = list(pool.map(save_profile, range(2)))
            assert sum(result is not None for result in saves) == 1
            assert request(professional, token="valid-outsider")["version"] == 3
            team = request(public + "/teams", body={"name": "Đội phát triển TaskNest", "description": "Xây dựng ứng dụng theo yêu cầu khách hàng.", "skills": "Java, React", "acceptingWork": True}, expected=201)
            profile = public + "/teams/" + str(team)
            assert request(profile, token=None)["members"][0]["display_name"] == "Trưởng đội"
            request(profile, body={"name": "Giả mạo", "description": "Không có quyền sửa hồ sơ đội.", "skills": "", "acceptingWork": True, "version": 0}, method="PUT", token="valid-outsider", expected=403)
            cover = profile + "/cover"
            request(cover, token=None, expected=404)
            def upload_cover(image, token="valid-owner", expected=200):
                boundary = "tasknest-cover-" + uuid.uuid4().hex
                body = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="cover.png"\r\n'
                        'Content-Type: image/png\r\n\r\n').encode() + image + f'\r\n--{boundary}--\r\n'.encode()
                return request(cover, token=token, body=body, method="POST",
                               content_type=f"multipart/form-data; boundary={boundary}", expected=expected)

            png_cover = chat_test_png(b"\x20\x40\x60")
            upload_cover(png_cover, token=None, expected=401)
            upload_cover(png_cover, token="valid-outsider", expected=403)
            upload_cover(b"invalid", expected=400)
            upload_cover(png_cover)
            headers, image = request(cover, token=None, raw=True)
            assert image == png_cover and headers.get_content_type() == "image/png"
            assert headers["X-Content-Type-Options"] == "nosniff"
            replacement = chat_test_png(b"\x80\x60\x20")
            upload_cover(replacement)
            assert request(cover, token=None, raw=True)[1] == replacement
            request(cover, token="valid-outsider", method="DELETE", expected=403)
            request(cover, method="DELETE")
            request(cover, token=None, expected=404)
            print("PASS team covers: public read, owner-only upload/replace/remove, and image validation.")
            request(profile + "/people?search=dev", token=None, expected=401)
            request(profile + "/people?search=dev", token="valid-outsider", expected=403)
            assert len(request(profile + "/people?search=dev")) == 2
            request(profile + "/invitations/by-user", body={"userId": base.MEMBER}, token="valid-outsider", expected=403)
            request(profile + "/invitations/by-user", body={"userId": "00000000-0000-4000-8000-000000000099"}, expected=400)
            request(profile + "/invitations", body={"email": "member@example.test"})
            request(profile + "/invitations/by-user", body={"userId": base.MEMBER})
            assert len(request(profile + "/invitations")) == 1
            assert sql("SELECT COUNT(*) FROM outbox_events WHERE payload->>'$.type'='team.invitation.created';") == '1'
            assert len(request(profile, token=None)["members"]) == 1

            request(profile + "/invitation", token="valid-member", body={"value": True}, method="PUT")
            avatar = f"{profile}/members/{base.MEMBER}/avatar"
            assert request(avatar, raw=True)[1] == chat_test_png(b"\x00\x60\x80")
            request(avatar, token="valid-outsider", expected=404)
            request(avatar, token=None, expected=401)
            request(profile + "/invitation", token="valid-member", body={"value": True}, method="PUT")
            assert len(request(profile, token=None)["members"]) == 2

            def can_message(token, peer):
                members = request(profile, token=token)["members"]
                return next(member["can_message"] for member in members if member["user_id"] == peer)
            assert not can_message("valid-owner", base.MEMBER)
            assert not can_message(None, base.MEMBER)
            request(connections + "/" + base.MEMBER, body={"action": "REQUEST"}, method="PUT")
            assert not can_message("valid-owner", base.MEMBER)
            request(connections + "/" + base.OWNER, token="valid-member", body={"action": "ACCEPT"}, method="PUT")
            assert can_message("valid-owner", base.MEMBER)
            assert can_message("valid-member", base.OWNER)
            request(connections + "/" + base.MEMBER, body={"action": "REMOVE"}, method="PUT")

            def like(_):
                request(public + "/likes/TEAM/" + str(team), token="valid-outsider", body={"value": True}, method="PUT")
            with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
                list(pool.map(like, range(6)))
            assert request(profile, token=None)["likes"] == 1
            request(public + "/likes/TEAM/" + str(team), token="valid-outsider", body={"value": False}, method="PUT")
            assert request(profile, token=None)["likes"] == 0
            request(public + "/likes/MEMBER/" + base.MEMBER, token="valid-other", body={"value": True}, method="PUT")
            assert request(public + "/members/" + base.MEMBER, token=None)["likes"] == 1

            today = datetime.now(timezone(timedelta(hours=7))).date()
            # Tomorrow also remains valid if the run crosses Vietnamese midnight.
            fixture_day = today + timedelta(days=1)
            project = request("/api/work/projects", body={"name": "Dự án khách hàng riêng tư", "description": "Bàn giao website quản lý lịch hẹn cho khách hàng.", "startsOn": str(fixture_day), "endsOn": str(fixture_day + timedelta(days=60))}, expected=201)["id"]
            sql(f"INSERT INTO project_memberships(project_id,user_id,status,joined_at,added_by) VALUES({project},'{base.OTHER}','ACTIVE',UTC_TIMESTAMP(6),'{base.OWNER}'),({project},'{base.MEMBER}','ACTIVE',UTC_TIMESTAMP(6),'{base.OWNER}');")
            reputation = f"/api/work/projects/{project}/reputation"
            request(reputation, body={"teamId": team, "customerId": base.MEMBER}, method="PUT", expected=409)
            request(reputation, body={"teamId": team, "customerId": base.OTHER}, method="PUT")
            request(reputation + "/decline", token="valid-other", body={}, method="PUT")
            assert request(reputation)["configured"] is False
            request(reputation, body={"teamId": team, "customerId": base.OTHER}, method="PUT")
            review = {"quality": 5, "schedule": 4, "communication": 5, "support": 4, "comment": "Đội bàn giao đầy đủ và phối hợp tốt.", "wouldRehire": True}
            request(reputation + "/review", token="valid-other", body=review, method="PUT", expected=409)
            request(reputation + "/accept", token="valid-outsider", body={}, method="PUT", expected=404)
            request(reputation + "/accept", token="valid-other", body={}, method="PUT")
            assert request(profile + "/projects")[0]["id"] == project
            request(profile + "/projects", token="valid-member", expected=403)
            assignment = profile + f"/projects/{project}/members"
            request(assignment, body={"userIds": [base.OUTSIDER]}, expected=409)
            request(profile + "/invitations/by-user", body={"userId": base.OTHER}, expected=409)
            request(profile + "/invitations/by-user", body={"userId": base.OUTSIDER})
            sql(f"UPDATE dev_team_invitations SET created_at=DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 8 DAY) WHERE team_id={team} AND user_id='{base.OUTSIDER}';")
            request(profile + "/invitation", token="valid-outsider", body={"value": True}, method="PUT", expected=409)
            request(profile + "/invitations/by-user", body={"userId": base.OUTSIDER})
            request(profile + "/invitation", token="valid-outsider", body={"value": False}, method="PUT")
            request(profile + "/invitations/by-user", body={"userId": base.OUTSIDER})
            request(profile + "/invitation", token="valid-outsider", body={"value": True}, method="PUT")
            request(assignment, token="valid-member", body={"userIds": [base.OUTSIDER]}, expected=403)
            request(assignment, body={"userIds": [base.OUTSIDER]})
            request(assignment, body={"userIds": [base.OUTSIDER]})
            assert sql(f"SELECT COUNT(*) FROM project_memberships WHERE project_id={project} AND user_id='{base.OUTSIDER}' AND status='ACTIVE';") == '1'
            assert sql(f"SELECT COUNT(*) FROM activity_logs WHERE project_id={project} AND action='TEAM_MEMBER_ASSIGNED';") == '1'
            assert any(item["user_id"] == base.OUTSIDER for item in request(profile)["members"])
            # Team removal and leaving do not revoke project access.
            member_path = profile + "/members/" + base.OUTSIDER
            request(member_path, token="valid-member", method="DELETE", expected=403)
            request(profile + "/members/" + base.OWNER, method="DELETE", expected=409)
            request(member_path, method="DELETE")
            request(member_path, method="DELETE")
            assert not any(item["user_id"] == base.OUTSIDER for item in request(profile)["members"])
            request(f"/api/work/projects/{project}", token="valid-outsider")
            request(profile + "/invitations/by-user", body={"userId": base.OUTSIDER})
            cancel_path = profile + "/invitations/" + base.OUTSIDER
            request(cancel_path, token="valid-member", method="DELETE", expected=403)
            request(cancel_path, method="DELETE")
            request(profile + "/invitations/by-user", body={"userId": base.OUTSIDER})
            request(profile + "/invitation", token="valid-outsider", body={"value": True}, method="PUT")
            request(profile + "/membership", token="valid-outsider", method="DELETE")
            request(f"/api/work/projects/{project}", token="valid-outsider")
            # Restore the outsider fixture after verifying team/project membership transitions.
            sql(f"UPDATE project_memberships SET status='REMOVED',removed_at=UTC_TIMESTAMP(6),removed_by='{base.OWNER}' WHERE project_id={project} AND user_id='{base.OUTSIDER}'; DELETE FROM dev_team_members WHERE team_id={team} AND user_id='{base.OUTSIDER}';")
            request(reputation + "/complete", token="valid-other", body={"publishProject": False}, method="PUT", expected=409)
            tasks = f"/api/work/projects/{project}/tasks"
            task = request(tasks, body={"title": "Bàn giao website lịch hẹn", "description": "Hoàn thiện và kiểm thử sản phẩm.", "assigneeId": base.MEMBER, "priority": "HIGH", "startsOn": str(fixture_day), "deadlineOn": str(fixture_day + timedelta(days=14)), "estimatedSeconds": 3600}, expected=201)
            assert sql(f"SELECT COUNT(*) FROM outbox_events WHERE payload->>'$.type'='work.task.assigned' AND payload->>'$.taskId'='{task}' AND payload->>'$.userId'='{base.MEMBER}'") == "1"
            # Milestone plans, deliveries and customer acceptance use the same project permissions.
            milestones = f"/api/work/projects/{project}/milestones"
            plan = {"title": "Bàn giao website lịch hẹn", "criteria": ["Đặt lịch và tra cứu lịch hẹn hoạt động", "Có hướng dẫn sử dụng và bàn giao mã nguồn"],
                    "dueOn": str(fixture_day + timedelta(days=14)), "taskIds": [task], "requestId": str(uuid.uuid4())}
            request(milestones, token=None, expected=401)
            request(milestones, token="valid-outsider", expected=404)
            request(milestones, token="valid-other", body=plan, expected=403)
            request(milestones, token="valid-member", body=plan, expected=403)
            request(milestones, body={**plan, "requestId": str(uuid.uuid4()), "taskIds": [999999]}, expected=400)
            request(milestones, body={**plan, "requestId": "-" * 36}, expected=400)
            milestone = request(milestones, body=plan, expected=201)
            assert request(milestones, body=plan, expected=201) == milestone
            milestone_path = milestones + "/" + str(milestone)
            cancelled = request(milestones, body={**plan, "title": "Kế hoạch thử cần hủy", "requestId": str(uuid.uuid4()), "taskIds": []}, expected=201)
            request(milestones + "/" + str(cancelled) + "/cancel", body={"version": 0, "reason": "Gộp nội dung vào mốc bàn giao chính."}, method="PUT")
            request(milestone_path + "/approve-plan", body={"version": 0}, method="PUT", expected=403)
            request(milestone_path + "/approve-plan", token="valid-other", body={"version": 9}, method="PUT", expected=409)
            request(milestone_path + "/approve-plan", token="valid-other", body={"version": 0}, method="PUT")
            request(milestone_path, body={**plan, "version": 1}, method="PUT", expected=409)
            delivery = {"note": "Kết quả bàn giao và hướng dẫn kiểm tra các chức năng.", "resultUrl": "https://example.test/milestone",
                        "requestId": str(uuid.uuid4()), "version": 1}
            request(milestone_path + "/submissions", body=delivery, expected=409)
            request(f"{tasks}/{task}/start", token="valid-member", body={"version": 0}, method="PUT")
            request(f"{tasks}/{task}/status", token="valid-member", body={"version": 1, "status": "REVIEW", "confirmed": False, "note": "Đã kiểm thử và bàn giao.", "resultUrl": "https://example.test/product"}, method="PUT")
            request(f"{tasks}/{task}/status", body={"version": 2, "status": "DONE", "confirmed": True}, method="PUT")
            request(reputation + "/complete", token="valid-other", body={"publishProject": False}, method="PUT", expected=409)
            submitted = request(milestone_path + "/submissions", body=delivery, expected=201)
            assert request(milestone_path + "/submissions", body=delivery, expected=201) == submitted
            assert sql(f"SELECT COUNT(*) FROM milestone_submissions WHERE milestone_id={milestone};") == "1"
            request(milestone_path + "/submissions", token="valid-other", body=delivery, expected=403)
            review_path = milestone_path + "/submissions/" + str(submitted) + "/review"
            accept_milestone = {"accepted": True, "feedback": "Đã kiểm tra đầy đủ.", "checkedCriteria": [0, 1], "version": 2}
            request(review_path, body=accept_milestone, method="PUT", expected=403)
            request(review_path, token="valid-outsider", body=accept_milestone, method="PUT", expected=404)
            request(review_path, token="valid-other", body={**accept_milestone, "checkedCriteria": []}, method="PUT", expected=400)
            request(review_path, token="valid-other", body={"accepted": False, "feedback": "Bổ sung hướng dẫn sử dụng chi tiết.", "checkedCriteria": [0], "version": 2}, method="PUT")
            changed = request(milestone_path)
            assert changed["status"] == "CHANGES_REQUESTED"
            attention = request(public + f"/overview/teams?teamId={team}")["attention"]
            assert any(item["kind"] == "REWORK" and item["item_id"] == milestone and item["target_id"] == project for item in attention)
            assert all(item["team_id"] == team for item in attention)
            assert not request(public + f"/overview/teams?teamId={team}", token="valid-member")["attention"]
            assert changed["submissions"][0]["feedback"] == "Bổ sung hướng dẫn sử dụng chi tiết."
            assert request(milestone_path + "/submissions", body=delivery, expected=201) == submitted
            revised = request(milestone_path + "/submissions", body={**delivery, "note": "Đã bổ sung hướng dẫn sử dụng chi tiết.", "requestId": str(uuid.uuid4()), "version": 3}, expected=201)
            request(review_path, token="valid-other", body={**accept_milestone, "version": 4}, method="PUT", expected=409)
            revised_review = milestone_path + "/submissions/" + str(revised) + "/review"
            previous_submission=sql(f"SELECT accepted_submission_id FROM tasks WHERE id={task}")
            sql(f"UPDATE tasks SET status='IN_PROGRESS',completed_at=NULL,accepted_submission_id=NULL WHERE id={task};")
            request(revised_review, token="valid-other", body={**accept_milestone, "version": 4}, method="PUT", expected=409)
            sql(f"UPDATE tasks SET status='DONE',completed_at=UTC_TIMESTAMP(6),accepted_submission_id={previous_submission} WHERE id={task};")
            request(revised_review, token="valid-other", body={**accept_milestone, "version": 4}, method="PUT")
            request(revised_review, token="valid-other", body={**accept_milestone, "version": 4}, method="PUT")
            request(revised_review, token="valid-other", body={**accept_milestone,"version":4,"checkedCriteria":[]},method="PUT",expected=400)
            accepted = request(milestone_path, token="valid-other")
            assert accepted["status"] == "ACCEPTED" and accepted["submissionCount"] == 2
            assert accepted["tasks"] == []
            assert request(milestone_path)["tasks"][0]["id"] == task
            assert accepted["submissions"][1]["decision"] == "CHANGES_REQUESTED"
            assert accepted["submissions"][0]["decision"] == "ACCEPTED"
            request(milestone_path + "/cancel", token="valid-other", body={"version": 5, "reason": "Không được thay đổi mốc đã chấp nhận."}, method="PUT", expected=409)
            counts = request(milestones)["counts"]
            assert counts["total"] == 2 and counts["accepted"] == 1
            request(reputation + "/complete", body={"publishProject": True}, method="PUT", expected=403)
            # Reassign a completed task and remove the original worker from today's roster.
            # Their accepted submission still proves their contribution at acceptance.
            sql(f"UPDATE tasks SET assignee_user_id='{base.OWNER}' WHERE id={task}; DELETE FROM dev_team_members WHERE team_id={team} AND user_id='{base.MEMBER}'; UPDATE project_memberships SET status='REMOVED',removed_at=UTC_TIMESTAMP(6),removed_by='{base.OWNER}' WHERE project_id={project} AND user_id='{base.MEMBER}';")
            project_path = f"/api/work/projects/{project}"
            resource_id = request(project_path + "/resources", body={
                "requestId": str(uuid.uuid4()), "title": "Tài liệu dự án", "url": "https://example.test/resource"
            }, expected=201)
            chat = public + "/chat"
            closed_chat = request(chat, body={"kind": "PROJECT", "target": str(project)}, expected=201)
            request(reputation + "/complete", token="valid-other", body={"publishProject": False}, method="PUT")
            request(project_path + "/resources", token="valid-other", expected=403)
            request(project_path + "/members", token="valid-other", expected=403)
            request(project_path + "/analytics", token="valid-other", expected=403)
            request(f"{tasks}/{task}/submissions", token="valid-other", expected=403)
            request(f"{tasks}/{task}/history", token="valid-other", expected=403)
            assert request(project_path + "/resources")["readOnly"] is True
            request(f"{project_path}/resources/{resource_id}/delete", body={"version": 0}, method="PUT", expected=409)
            request(f"{project_path}/members/{base.MEMBER}/remove", method="PUT", expected=409)
            assert request(f"{chat}/{closed_chat}")["readOnly"] is True
            request(f"{chat}/{closed_chat}/messages", body={"body": "Dự án đã khóa", "clientId": str(uuid.uuid4())}, expected=409)
            assert request(reputation, token="valid-other")["contributors"] == []
            contributors = request(reputation)["contributors"]
            assert any(row["user_id"] == base.MEMBER and row["completed_tasks"] >= 1 for row in contributors)
            former = request(public + "/members/" + base.MEMBER, token=None)
            assert former["completedProjects"] == 1
            # Restore the working fixture; the acceptance snapshot itself must stay unchanged.
            sql(f"UPDATE tasks SET assignee_user_id='{base.MEMBER}' WHERE id={task}; INSERT INTO dev_team_members(team_id,user_id,display_name) VALUES({team},'{base.MEMBER}','Lập trình viên'); UPDATE project_memberships SET status='ACTIVE',removed_at=NULL,removed_by=NULL WHERE project_id={project} AND user_id='{base.MEMBER}';")
            request(reputation + "/review", body=review, method="PUT", expected=403)
            request(reputation + "/review", token="valid-other", body=review, method="PUT")
            request(reputation + "/review", token="valid-other", body=review, method="PUT", expected=409)
            request(reputation + "/reply", body={"comment": "Cảm ơn khách hàng đã tin tưởng.", "version": 0}, method="PUT", expected=409)
            request(reputation + "/review", token="valid-other", body={**review, "version": 0}, method="PUT", expected=409)
            recognition = {"userId": base.MEMBER, "comment": "Chủ động xử lý vấn đề và hỗ trợ tận tình.", "strengths": ["PROBLEM_SOLVING", "SUPPORT"]}
            request(reputation + "/recognitions", token="valid-other", body=recognition, method="PUT", expected=409)

            reopen_path = reputation + "/reopen"
            request(reopen_path, token="valid-other", body={"action": "REQUEST"}, method="PUT")
            pending = request(reputation, token="valid-other")["reopenRequest"]
            approve = {"action": "APPROVE", "requestId": pending["id"]}
            request(reopen_path, token="valid-other", body=approve, method="PUT", expected=403)
            request(f"{project_path}/resources/{resource_id}/delete", body={"version": 0}, method="PUT", expected=409)
            request(reopen_path, body=approve, method="PUT")
            assert request(project_path + "/resources")["readOnly"] is False
            request(f"{project_path}/resources/{resource_id}/delete", body={"version": 0}, method="PUT")
            request(reputation + "/reply", body={"comment": "Cảm ơn khách hàng đã tin tưởng.", "version": 0}, method="PUT")
            request(reputation + "/recognitions", token="valid-other", body=recognition, method="PUT")
            request(reputation + "/complete", token="valid-other", body={"publishProject": False}, method="PUT")
            final = request(profile, token=None)
            assert float(final["rating"]) == 4.5 and final["review_count"] == 1 and final["completed_projects"] == 1, final
            assert final["reviews"][0]["project_public_name"] is None
            assert "Dự án khách hàng riêng tư" not in json.dumps(final, ensure_ascii=False)
            member = request(public + "/members/" + base.MEMBER, token=None)
            assert member["recognitionCount"] == 1 and member["recognitions"][0]["project_public_name"] is None
            assert len(request(reputation + "/history")) == 2
            request(reputation + "/history", token="valid-outsider", expected=404)
            # Customer requests and team proposals become a real project atomically.
            market = public + "/requests"
            request_body = {
                "title": "Xây dựng website đặt lịch theo yêu cầu",
                "description": "Khách hàng cần website đặt lịch, quản lý khách hàng và thống kê hoạt động.",
                "skills": "Java, React", "budgetMin": 1000000, "budgetMax": 20000000,
                "desiredDelivery": str(today + timedelta(days=30)), "referenceUrl": "https://example.test/brief",
                "publish": False, "requestId": str(uuid.uuid4()),
            }
            post_png = chat_test_png(b'\x45\x67\xc0')
            second_png = chat_test_png(b'\x45\x67\xa0')
            request_body["images"] = [base64.b64encode(img).decode() for img in (post_png, second_png, post_png, second_png)]
            request(market, token="valid-other", body={**request_body,"images":["PHN2Zz4="]}, expected=400)
            request(market, token="valid-other", body={**request_body,"images":request_body["images"]+[request_body["images"][0]]}, expected=400)
            posted = request(market, token="valid-other", body=request_body, expected=201)
            post_image = f"{public}/post-images/REQUEST/{posted}/1"
            request(post_image, token=None, expected=404)
            _, draft_bytes = request(post_image, token="valid-other", raw=True)
            assert draft_bytes == post_png
            assert request(f"{public}/post-images/REQUEST/{posted}/2", token="valid-other", raw=True)[1] == second_png
            request(f"{public}/post-images/REQUEST/{posted}/2", token="valid-member", expected=404)
            assert request(market, token="valid-other", body=request_body, expected=201) == posted
            request(market, token="valid-other", body={**request_body, "title": "Nội dung khác"}, expected=409)
            request(market + "/" + str(posted), token=None, expected=404)
            request(public + "/my-requests", token=None, expected=401)
            assert request(public + "/my-requests", token="valid-other")["total"] == 1
            detail = market + "/" + str(posted)
            request(detail + "/status", token="valid-other", body={"status": "CLOSED", "version": 0}, method="PUT", expected=400)
            request(detail, token=None, expected=404)
            assert request(public + "/feed?kind=REQUEST", token=None)["total"] == 0

            request(detail + "/status", token="valid-other", body={"status": "OPEN", "version": 0}, method="PUT")
            assert request(detail, token=None)["status"] == "OPEN"
            requests_in_feed = request(public + "/feed?kind=REQUEST", token=None)["items"]
            feed_post = next(item for item in requests_in_feed if item["id"] == posted and item["kind"] == "REQUEST")
            assert feed_post["image_count"] == 4 and feed_post["reference_url"] == request_body["referenceUrl"]
            headers, published_bytes = request(post_image, token=None, raw=True)
            assert headers.get_content_type() == "image/png" and published_bytes == post_png

            assert request(market, token=None)["total"] == 1
            request(detail, token="valid-outsider", body={**request_body, "version": 1}, method="PUT", expected=403)
            second_team = request(public + "/teams", token="valid-outsider", body={"name": "Đội phát triển độc lập", "description": "Nhận phát triển phần mềm theo yêu cầu.", "skills": "React", "acceptingWork": True}, expected=201)
            proposal_body = {
                "teamId": team, "requestVersion": 1, "plan": "Phân tích yêu cầu, thiết kế giao diện, triển khai API và kiểm thử trước bàn giao.",
                "amount": 12000000, "startsOn": str(today + timedelta(days=1)), "endsOn": str(today + timedelta(days=20)),
            }
            offers = detail + "/proposals"
            request(offers, token="valid-other", body=proposal_body, method="PUT", expected=403)
            request(offers, body=proposal_body, method="PUT")
            request(offers, token="valid-outsider", body={**proposal_body, "teamId": second_team, "amount": 15000000}, method="PUT")
            request(offers, token=None, expected=401)
            assert request(offers, token="valid-member")["total"] == 0
            assert request(offers + "?teamId=" + str(second_team))["total"] == 0
            assert request(offers)["total"] == 1
            customer_offers = request(offers, token="valid-other")["items"]
            assert len(customer_offers) == 2
            first_offer = next(item for item in customer_offers if item["team_id"] == team)["id"]
            second_offer = next(item for item in customer_offers if item["team_id"] == second_team)["id"]
            # Proposal discussions are scoped to the customer and the owning team's representative.
            discussion = offers + "/" + str(first_offer) + "/messages"
            other_discussion = offers + "/" + str(second_offer) + "/messages"
            request(discussion, token=None, expected=401)
            request(discussion, token="valid-member", expected=404)
            request(discussion, token="valid-outsider", expected=404)
            assert request(discussion, token="valid-other")["items"] == []
            message_body = {"body": "Đội có thể làm rõ cách bàn giao và thời gian bảo hành không?", "clientId": str(uuid.uuid4())}
            sent = request(discussion, body=message_body, expected=201)
            assert request(discussion, body=message_body, expected=201) == sent
            request(discussion, body={**message_body, "body": "Nội dung khác"}, expected=409)
            request(discussion, body={"body": " ", "clientId": str(uuid.uuid4())}, expected=400)
            request(discussion, token="valid-member", body=message_body, expected=404)
            request(market + "/" + str(posted + 99999) + "/proposals/" + str(first_offer) + "/messages", token="valid-other", expected=404)
            assert next(row for row in request(offers, token="valid-other")["items"] if row["id"] == first_offer)["unread_messages"] == 1
            assert request(offers)["items"][0]["unread_messages"] == 0
            other_message = request(other_discussion, token="valid-outsider", body={"body": "Đội thứ hai muốn trao đổi riêng với khách hàng.", "clientId": str(uuid.uuid4())}, expected=201)
            request(discussion + "/read", token="valid-other", body={"messageId": other_message}, method="PUT", expected=400)
            request(discussion + "/read", token="valid-other", body={"messageId": sent}, method="PUT")
            assert request(discussion)["otherReadId"] == sent
            reply_message = request(discussion, token="valid-other", body={"body": "Khách hàng mong muốn được hỗ trợ sau bàn giao.", "clientId": str(uuid.uuid4())}, expected=201)
            assert request(offers)["items"][0]["unread_messages"] == 1
            # More than one page: keyset pagination must preserve ordering with no duplicates.
            for index in range(33):
                sql(f"INSERT INTO proposal_messages(proposal_id,sender_user_id,sender_name,body,client_message_id) VALUES({first_offer},'{base.OTHER}','Khách hàng','Nội dung trao đổi số {index}','{uuid.uuid4()}');")
            latest_messages = request(discussion)
            assert len(latest_messages["items"]) == 30 and latest_messages["nextBefore"]
            older_messages = request(discussion + "?before=" + str(latest_messages["nextBefore"]))
            all_messages = older_messages["items"] + latest_messages["items"]
            ids = [row["id"] for row in all_messages]
            assert len(ids) == 35 and ids == sorted(set(ids))
            newest = latest_messages["items"][-1]["id"]
            request(discussion + "/read", body={"messageId": newest}, method="PUT")
            request(discussion + "/read", body={"messageId": reply_message}, method="PUT")
            assert request(discussion)["myReadId"] == newest
            assert request(offers)["items"][0]["unread_messages"] == 0
            request(detail, token="valid-other", body={**request_body, "version": 1, "publish": True,
                "images": [request_body["images"][0]], "keepImages": [2,4]}, method="PUT")
            assert request(detail, token=None)["image_count"] == 3
            assert request(post_image, token=None, raw=True)[1] == second_png
            assert request(f"{public}/post-images/REQUEST/{posted}/3", token=None, raw=True)[1] == post_png
            request(f"{public}/post-images/REQUEST/{posted}/4", token=None, expected=404)
            request(offers + "/" + str(first_offer) + "/accept", token="valid-other", body={"version": 0}, method="PUT", expected=409)
            request(offers, body={**proposal_body, "requestVersion": 2, "version": 0}, method="PUT")
            request(offers, token="valid-outsider", body={**proposal_body, "teamId": second_team, "requestVersion": 2, "version": 0}, method="PUT")
            request(offers + "/" + str(first_offer) + "/withdraw", body={"version": 1}, method="PUT")
            assert not request(discussion)["canSend"]
            request(discussion, body={"body": "Không được gửi sau khi rút.", "clientId": str(uuid.uuid4())}, expected=409)
            request(offers + "/" + str(first_offer) + "/accept", token="valid-other", body={"version": 2}, method="PUT", expected=409)
            request(offers, body={**proposal_body, "requestVersion": 2, "version": 2}, method="PUT")
            before_projects = int(sql("SELECT COUNT(*) FROM projects;"))
            def accept_offer(_):
                return request(offers + "/" + str(first_offer) + "/accept", token="valid-other", body={"version": 3}, method="PUT")
            with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
                awarded = list(pool.map(accept_offer, range(2)))
            assert awarded[0] == awarded[1]
            awarded_project = awarded[0]
            assert not request(discussion)["canSend"]
            assert not request(other_discussion, token="valid-outsider")["canSend"]
            assert len(request(discussion)["items"]) == 30
            request(discussion, body={"body": "Tiếp tục sau khi chọn đội.", "clientId": str(uuid.uuid4())}, expected=409)
            assert request(discussion, body=message_body, expected=201) == sent
            assert int(sql("SELECT COUNT(*) FROM projects;")) == before_projects + 1
            request(offers + "/" + str(second_offer) + "/accept", token="valid-other", body={"version": 1}, method="PUT", expected=409)
            assert request(f"/api/work/projects/{awarded_project}")["role"] == "OWNER"
            assert request(f"/api/work/projects/{awarded_project}", token="valid-other")["role"] == "CUSTOMER"
            task_input={"title":"Công việc thử quyền khách hàng","description":"Xác minh quyền theo quan hệ hợp tác dự án.","assigneeId":base.OTHER,"priority":"MEDIUM","startsOn":str(fixture_day),"deadlineOn":str(fixture_day+timedelta(days=3)),"estimatedSeconds":3600}
            request(f"/api/work/projects/{awarded_project}/tasks",token="valid-other",body=task_input,expected=403)
            request(f"/api/work/projects/{awarded_project}/tasks",body=task_input,expected=409)
            request(f"/api/work/projects/{awarded_project}/members/{base.OTHER}/remove",method="PUT",body={},expected=409)
            request(f"/api/work/projects/{awarded_project}/members/{base.OTHER}/role",method="PUT",body={"role":"Manager"},expected=409)
            assert request(f"/api/work/projects?role=CUSTOMER",token="valid-other")["content"][0]["role"] == "CUSTOMER"

            # Award grants no implicit access to the whole dev team. Kickoff is explicit.
            agreement = f"/api/work/projects/{awarded_project}/agreement"
            request(f"/api/work/projects/{awarded_project}", token="valid-member", expected=404)
            pending = request(agreement)
            assert pending["canKickoff"] and pending["kickoffAt"] is None
            assert any(item["kind"] == "KICKOFF" and item["target_id"] == awarded_project
                       for item in request(public + "/overview/teams")["attention"])
            assert any(item["id"] == awarded_project and item["kickoff_pending"]
                       for item in request(public + "/overview/customer", token="valid-other")["projects"])
            assert request(f"/api/work/projects/{awarded_project}")["developmentState"] == "PENDING_KICKOFF"
            request(agreement + "/kickoff", body={"userIds": [base.MEMBER]}, method="PUT", expected=400)
            assert pending["snapshot"]["plan"] == proposal_body["plan"]
            request(agreement + "/kickoff", token="valid-other", body={"version": 0, "userIds": [base.MEMBER]}, method="PUT", expected=403)
            request(agreement + "/kickoff", body={"version": 1, "userIds": [base.MEMBER]}, method="PUT", expected=409)
            request(agreement + "/kickoff", body={"version": 0, "userIds": [base.OTHER]}, method="PUT", expected=409)
            request(agreement + "/kickoff", body={"version": 0, "userIds": [base.MEMBER]}, method="PUT")
            request(agreement + "/kickoff", body={"version": 0, "userIds": [base.MEMBER]}, method="PUT")
            assert sql(f"SELECT COUNT(*) FROM activity_logs WHERE project_id={awarded_project} AND action='PROJECT_KICKOFF'") == '1'
            request(agreement + "/kickoff", body={"version": 0, "userIds": [base.OUTSIDER]}, method="PUT", expected=409)
            staff_agreement = request(agreement, token="valid-member")
            assert staff_agreement["kickoffAt"] and not staff_agreement["canViewPrivateDiscussion"]
            assert request(f"/api/work/projects/{awarded_project}")["developmentState"] == "ACTIVE"
            assert "amount" not in staff_agreement["snapshot"] and not staff_agreement["candidates"]
            request(detail + "/history?proposal=" + str(first_offer), token="valid-member", expected=404)
            request(detail + "/history?proposal=" + str(first_offer), token="valid-outsider", expected=404)
            revisions = request(detail + "/history?proposal=" + str(first_offer), token="valid-other")
            assert revisions[0]["snapshot"]["status"] == "ACCEPTED"
            assert len(revisions) >= 4 and revisions[-1]["snapshot"]["amount"] == proposal_body["amount"]
            history = request(detail + "/history", token="valid-other")
            assert history[0]["snapshot"]["status"] == "AWARDED"
            assert len(history) >= 3
            assert all(row["snapshot"]["status"] != "DRAFT" for row in request(detail + "/history"))
            long_plan="Phân tích, triển khai và kiểm thử toàn bộ phạm vi yêu cầu. " * 35
            sql(f"UPDATE project_agreements SET snapshot=JSON_SET(snapshot,'$.plan','{long_plan}') WHERE project_id={awarded_project};")
            milestones_draft = {"dueOn": proposal_body["endsOn"], "requestId": str(uuid.uuid4())}
            request(agreement + "/milestone", token="valid-other", body=milestones_draft, expected=403)
            milestone_draft = request(agreement + "/milestone", body=milestones_draft)
            assert request(agreement + "/milestone", body=milestones_draft) == milestone_draft
            assert sql(f"SELECT status FROM project_milestones WHERE id={milestone_draft}") == "DRAFT"
            draft_criteria=json.loads(sql(f"SELECT criteria FROM project_milestones WHERE id={milestone_draft}"))
            assert ''.join(''.join(draft_criteria).split()) == ''.join(long_plan.split())
            assert all(len(part)<=300 for part in draft_criteria) and len(draft_criteria)<=20
            overview = public + "/overview"
            request(overview + "/teams", token=None, expected=401)
            customer_data = request(overview + "/customer", token="valid-other")
            assert any(item["id"] == awarded_project and not item["kickoff_pending"] for item in customer_data["projects"])
            assert any(item["id"] == project and item["status"] == "COMPLETED" and item["accepted"] >= 1 for item in customer_data["projects"])
            assert any(item["id"] == milestone_draft for item in customer_data["milestones"])
            assert not any(item["id"] == awarded_project for item in request(overview + "/customer", token="valid-outsider")["projects"])
            owned = request(overview + "/teams")
            assert any(row["id"] == team and row["active_projects"] >= 1 for row in owned["teams"])
            assert not any(row["kind"] == "KICKOFF" and row["target_id"] == awarded_project for row in owned["attention"])
            assert any(row["team_id"] == team and row["user_id"] == base.MEMBER for row in owned["workload"])
            assert not any(row["id"] == team for row in request(overview + "/teams", token="valid-member")["teams"])
            print("PASS separate customer and team overviews, scoped to each account.")
            hub = public + "/cooperations"
            assert any(row["project_id"] == awarded_project for row in request(hub)["items"])
            assert any(row["project_id"] == awarded_project for row in request(hub, token="valid-member")["items"])
            assert not any(row["project_id"] == awarded_project for row in request(hub, token="valid-outsider")["items"])
            assert any(row["id"] == posted for row in request(hub + "?view=requests", token="valid-other")["items"])
            assert all(row["project_id"] is None for row in request(hub + "?view=proposals", token="valid-outsider")["items"])
            print("PASS cooperation: explicit kickoff roster, private agreement/history, safe proposal links, milestone draft and private hub.")
            request(f"/api/work/projects/{awarded_project}", token="valid-member")
            request(f"/api/work/projects/{awarded_project}", token="valid-outsider", expected=404)
            partnership = request(f"/api/work/projects/{awarded_project}/reputation", token="valid-other")
            assert partnership["status"] == "ACTIVE" and partnership["isCustomer"]
            assert not request(detail, token=None)["canAccessProject"]
            assert request(detail, token="valid-other")["canAccessProject"]
            request(offers, body={**proposal_body, "requestVersion": 2, "version": 4}, method="PUT", expected=409)
            # A failure after project insertion rolls back the project, memberships and acceptance.
            retry_body = {**request_body, "title": "Website quản lý phòng khám", "publish": True, "requestId": str(uuid.uuid4())}
            retry_request = request(market, token="valid-other", body=retry_body, expected=201)
            retry_offers = market + "/" + str(retry_request) + "/proposals"
            request(retry_offers, body={**proposal_body, "requestVersion": 0}, method="PUT")
            retry_offer = request(retry_offers)["items"][0]["id"]
            sql("CREATE TRIGGER reject_market_storage BEFORE INSERT ON project_storage_usage FOR EACH ROW SIGNAL SQLSTATE '23000' SET MESSAGE_TEXT='intentional storage failure';")
            request(retry_offers + "/" + str(retry_offer) + "/accept", token="valid-other", body={"version": 0}, method="PUT", expected=409)
            assert int(sql("SELECT COUNT(*) FROM projects;")) == before_projects + 1
            assert request(market + "/" + str(retry_request), token="valid-other")["status"] == "OPEN"
            assert request(retry_offers)["items"][0]["status"] == "SUBMITTED"
            sql("DROP TRIGGER reject_market_storage;")
            request(retry_offers + "/" + str(retry_offer) + "/accept", token="valid-other", body={"version": 0}, method="PUT")
            # Recruitment is private, capacity-limited and joins the team without project access.
            hiring_team = request(public + "/teams", body={"name": "Đội sản phẩm tuyển dụng", "description": "Xây dựng sản phẩm web và tuyển thành viên hợp tác dài hạn.", "skills": "React, Java", "acceptingWork": True}, expected=201)
            openings = public + "/teams/" + str(hiring_team) + "/openings"
            recommendations = public + f"/teams/{hiring_team}/recommendations"
            request(recommendations, token=None, expected=401)
            request(recommendations, token="valid-outsider", expected=403)
            fallback = request(recommendations)
            assert [(item["userId"], item["matchedCount"], item["requiredCount"], item["openingTitle"]) for item in fallback] == [(base.OUTSIDER, 2, 2, None)]

            opening_body = {"title": "Lập trình viên React", "description": "Phát triển giao diện sản phẩm và phối hợp kiểm thử cùng đội.", "skills": "React, TypeScript", "workMode": "REMOTE", "weeklyHours": 20, "slots": 1,
                            "closesOn": str(today + timedelta(days=30)), "requestId": str(uuid.uuid4())}
            opening_body["referenceUrl"] = "https://example.test/requirements"
            opening_body["images"] = request_body["images"][:2]
            request(openings, body=opening_body, token=None, expected=401)
            request(openings, body=opening_body, token="valid-outsider", expected=403)
            request(openings, body={**opening_body, "slots": 0}, expected=400)
            request(openings, body={**opening_body, "closesOn": "2020-01-01"}, expected=400)
            opening = request(openings, body=opening_body, expected=201)
            matching = request(recommendations)
            assert [(item["userId"], item["matchedSkills"], item["matchedCount"], item["requiredCount"], item["openingTitle"]) for item in matching] == [
                (base.OUTSIDER, "react", 1, 2, opening_body["title"])
            ]

            assert request(openings, body=opening_body, expected=201) == opening
            assert request(public + f"/post-images/OPENING/{opening}/2", token=None, raw=True)[1] == second_png
            feed = public + "/feed"
            react_posts = request(feed + "?skill=react", token=None)["items"]
            assert any(item["kind"] == "OPENING" and item["id"] == opening for item in react_posts)
            assert not any(item["kind"] == "REQUEST" and item["id"] == posted for item in react_posts)
            assert request(feed + "?kind=OPENING&skill=Reac", token=None)["total"] == 0
            request(feed + "?kind=DRAFT", token=None, expected=400)
            post = react_posts[0]
            saved_path = f"{feed}/saved/{post['kind']}/{post['id']}"
            request(saved_path, token=None, body={"selected": True}, method="PUT", expected=401)
            request(saved_path, body={"selected": True}, method="PUT")
            request(saved_path, body={"selected": True}, method="PUT")
            request(feed + "/skills", body={"skill": " React ", "selected": True}, method="PUT")
            assert request(feed + "/preferences") == {"saved": [post["kind"] + str(post["id"])], "skills": ["react"]}
            assert request(feed + "/saved")["total"] == 1
            assert request(feed + "/saved", token="valid-member")["total"] == 0
            request(saved_path, body={"selected": False}, method="PUT")
            request(feed + "/skills", body={"skill": "React", "selected": False}, method="PUT")
            assert request(feed + "/preferences") == {"saved": [], "skills": []}
            print("PASS private saved posts and followed hashtags.")

            opening_path = openings + "/" + str(opening)
            public_opening = next(row for row in request(public + "/openings", token=None)["items"] if row["id"] == opening)
            assert "request_hash" not in public_opening and "applications" not in public_opening
            application_body = {"introduction": "Tôi có kinh nghiệm React và có thể tham gia xây dựng sản phẩm cùng đội.", "skills": "React, Java", "weeklyHours": 20, "consent": True}
            request(opening_path + "/applications", body=application_body, expected=409)
            request(opening_path + "/applications", body={**application_body, "consent": False}, token="valid-member", expected=400)
            candidate = request(opening_path + "/applications", body=application_body, token="valid-member", expected=201)
            assert request(opening_path + "/applications", body=application_body, token="valid-member", expected=201) == candidate
            other_candidate = request(opening_path + "/applications", body=application_body, token="valid-outsider", expected=201)
            request(opening_path + "/applications", token=None, expected=401)
            request(opening_path + "/applications", token="valid-member", expected=403)
            assert request(opening_path + "/applications")["total"] == 2
            inbox_attention = request(public + f"/overview/teams?teamId={hiring_team}")["attention"]
            assert {item["item_id"] for item in inbox_attention if item["kind"] == "APPLICATION" and item["target_id"] == opening} == {candidate, other_candidate}
            assert request(public + "/applications/mine", token="valid-other")["total"] == 0
            assert request(public + "/applications/mine", token="valid-member")["items"][0]["id"] == candidate
            role_result = request(public + "/openings?roles=react&sort=MATCH", token=None)
            assert role_result["items"][0]["role_match"] == 1
            assert "React" in role_result["items"][0]["title"]
            candidate_path = opening_path + "/applications/" + str(candidate)
            request(candidate_path + "/withdraw", body={"version": 0}, token="valid-outsider", method="PUT", expected=404)
            request(candidate_path + "/review", body={"accepted": True, "version": 0}, token="valid-member", method="PUT", expected=403)
            request(opening_path + "/status", body={"status": "PAUSED", "version": 9}, method="PUT", expected=409)
            request(opening_path + "/status", body={"status": "PAUSED", "version": 0}, method="PUT")
            assert request(openings, token=None)["total"] == 0
            request(candidate_path + "/review", body={"accepted": True, "version": 0}, method="PUT", expected=409)
            request(opening_path + "/status", body={"status": "OPEN", "version": 1}, method="PUT")
            sql(f"INSERT INTO dev_team_invitations(team_id,user_id) VALUES({hiring_team},'{base.MEMBER}'),({hiring_team},'{base.OUTSIDER}');")
            assert not request(recommendations)
            print("PASS recommendations: owner-only, public matching, open position precedence, and pending invite exclusion.")
            memberships_before = sql("SELECT COUNT(*) FROM project_memberships;")
            # Both candidates compete for one seat; exactly one transaction may add a member.
            def hire(application):
                request(opening_path + "/applications/" + str(application) + "/review", body={"accepted": True, "feedback": "Chào mừng bạn tham gia đội.", "version": 0}, method="PUT", expected=(200, 409))
            with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
                list(pool.map(hire, [candidate, other_candidate]))
            decisions = request(opening_path + "/applications")["items"]
            assert len([row for row in decisions if row["status"] == "ACCEPTED"]) == 1
            assert sql(f"SELECT COUNT(*) FROM dev_team_members WHERE team_id={hiring_team};") == "2"
            assert request(openings, token=None)["total"] == 0
            winner = next(row for row in decisions if row["status"] == "ACCEPTED")
            loser = next(row for row in decisions if row["status"] == "PENDING")
            hire(winner["id"])
            assert sql(f"SELECT status FROM dev_team_invitations WHERE team_id={hiring_team} AND user_id='{winner['user_id']}';") == "ACCEPTED"
            request(opening_path + "/applications/" + str(winner["id"]) + "/withdraw", body={"version": 1}, token="valid-member" if winner["id"] == candidate else "valid-outsider", method="PUT", expected=409)
            loser_path = opening_path + "/applications/" + str(loser["id"])
            request(loser_path + "/review", body={"accepted": False, "feedback": "", "version": 0}, method="PUT", expected=400)
            request(loser_path + "/review", body={"accepted": False, "feedback": "Đội đã tuyển đủ vị trí ở đợt này.", "version": 0}, method="PUT")
            assert sql("SELECT COUNT(*) FROM project_memberships;") == memberships_before
            # Withdrawal is final and cannot later be accepted by the owner.
            extra = request(openings, body={**opening_body, "requestId": str(uuid.uuid4()), "title": "Kiểm thử phần mềm"}, expected=201)
            extra_path = openings + "/" + str(extra)
            extra_application = request(extra_path + "/applications", body=application_body, token="valid-other", expected=201)
            withdrawn = extra_path + "/applications/" + str(extra_application)
            request(withdrawn + "/withdraw", body={"version": 0}, token="valid-other", method="PUT")
            request(withdrawn + "/withdraw", body={"version": 0}, token="valid-other", method="PUT")
            request(withdrawn + "/review", body={"accepted": True, "version": 1}, method="PUT", expected=409)
            request(extra_path + "/status", body={"status": "CLOSED", "version": 0}, method="PUT")
            request(extra_path + "/status", body={"status": "OPEN", "version": 1}, method="PUT", expected=409)
            # Existing customer accounts may not become members of their delivery team.
            existing_team_openings = public + "/teams/" + str(team) + "/openings"
            blocked = request(existing_team_openings, body={**opening_body, "requestId": str(uuid.uuid4())}, expected=201)
            request(existing_team_openings + "/" + str(blocked) + "/applications", body=application_body, token="valid-other", expected=409)
            # Shared organization is visible across accounts and fails closed for customers/stale saves.
            assert request(f"/api/work/projects/{project}")["developmentState"] == "COMPLETED"
            assert request(f"/api/work/projects/{project}/tasks/{task}/organization")["canEdit"] is False
            request(f"/api/work/projects/{project}/tasks",body={**task_input,"assigneeId":base.OWNER,"title":"Không được giao thêm sau nghiệm thu"},expected=409)
            request(f"/api/work/projects/{project}/tasks/{task}/organization",body={"version":0,"checklist":[],"tags":[]},method="PUT",expected=409)
            organization_task=request(f"/api/work/projects/{awarded_project}/tasks",body={**task_input,"assigneeId":base.MEMBER,"title":"Checklist trong dự án đang triển khai"},expected=201)
            organization = f"/api/work/projects/{awarded_project}/tasks/{organization_task}/organization"
            assert request(organization)["version"] == 0
            step = {"id": str(uuid.uuid4()), "title": "Kiểm thử kết quả bàn giao", "completed": False, "createdAt": "fake-client-time"}
            saved_org = request(organization, body={"version": 0, "checklist": [step], "tags": ["BACKEND"]}, method="PUT")
            assert saved_org["version"] == 1 and saved_org["checklist"][0]["createdAt"] != "fake-client-time"
            assert request(organization, token="valid-member")["tags"] == ["BACKEND"]
            request(organization, token="valid-other", expected=403)
            request(organization, token="valid-outsider", expected=404)
            request(organization, token="valid-other", body={"version":1,"checklist":[step],"tags":[]},method="PUT",expected=403)
            request(organization, body={"version":0,"checklist":[step],"tags":[]},method="PUT",expected=409)
            request(organization, body={"version":1,"checklist":[step],"tags":["INVALID"]},method="PUT",expected=400)
            print("PASS shared task organization: cross-account persistence, permissions, optimistic version and server timestamps.")
            # The commercial relationship retains customer review access independently of roster changes.
            sql(f"UPDATE project_memberships SET status='REMOVED',removed_at=UTC_TIMESTAMP(6),removed_by='{base.OWNER}' WHERE project_id={project} AND user_id='{base.OTHER}';")
            current_review = request(reputation, token="valid-other")["review"]
            request(reputation + "/review", token="valid-other", body={**review,"version":current_review["version"]},method="PUT",expected=409)
            assert request(f"/api/work/projects/{project}",token="valid-other")["role"] == "CUSTOMER"
            assert any(p["id"]==project for p in request("/api/work/projects/index",token="valid-other"))
            workspace_customer=request("/api/work/projects/workspace",token="valid-other")
            assert not any(t["projectId"]==project for t in workspace_customer["tasks"])
            assert not any(m["projectId"]==project for m in workspace_customer["members"])
            assert next(p for p in workspace_customer["customerProgress"] if p["projectId"] == project) == {
                "projectId": project, "total": 1, "done": 1
            }
            print("PASS customer project role: developer writes denied, roster removal/promotion denied, historical cooperation and reviews retained.")
            check_messaging(request, sql, awarded_project, team)
            discovery_events = json.loads(bytes.fromhex(sql("SELECT HEX(COALESCE(JSON_ARRAYAGG(payload),JSON_ARRAY())) FROM outbox_events WHERE payload->>'$.type' LIKE 'discovery.%';")).decode("utf-8"))
            event_types = {event["type"] for event in discovery_events}
            assert {"discovery.application.created", "discovery.application.accepted", "discovery.application.rejected", "discovery.application.withdrawn", "discovery.opening.status", "discovery.proposal.created", "discovery.proposal.updated", "discovery.discussion.message", "discovery.review.created", "discovery.review.replied", "discovery.member.recognized", "discovery.profile.liked"}.issubset(event_types), event_types
            assert all(event["userId"] != event["actorId"] and (event["type"] == "discovery.chat.message" or event["destinationPath"].startswith("/")) and event["projectId"] is None and event["email"] is False for event in discovery_events)
            print("PASS discovery notifications: transactional recipients, idempotent retries, precise destinations and private application filters.")
            # Ranking must consider all candidates, not just the first page of newest posts.
            ranking_team = request(public + "/teams", body={"name": "Đội kiểm tra độ phù hợp", "description": "Kiểm chứng kết quả được chấm trên toàn bộ tin đang mở.", "skills": "Java, React", "acceptingWork": True}, expected=201)
            assert any(row["id"] == ranking_team for row in request(public + "/teams?skill=java", token=None)["items"])
            assert request(public + "/teams?skill=jav", token=None)["total"] == 0
            ranked_ids=[]
            for index in range(15):
                body={**opening_body,"title":f"Vị trí kiểm tra toàn cục {index}","skills":"Java" if index==0 else "JavaScript", "workMode":"REMOTE" if index==0 else "ONSITE", "requestId":str(uuid.uuid4())}
                # Bulk fixtures bypass the write-rate budget, not the search API under test.
                ranked_ids.append(int(sql(f"INSERT INTO team_openings(team_id,title,description,skills,work_mode,weekly_hours,slots,closes_on,request_id,request_hash) VALUES({ranking_team},'{body['title']}','Tin tuyển dụng kiểm chứng toàn cục.','{body['skills']}','{body['workMode']}',20,1,'{body['closesOn']}','{body['requestId']}',UNHEX(SHA2('fixture',256))); SELECT LAST_INSERT_ID();")))
            matching_feed = request(feed + "?kind=OPENING&skill=java", token=None)
            assert any(row["id"] == ranked_ids[0] for row in matching_feed["items"])
            assert not any(row["id"] in ranked_ids[1:] for row in matching_feed["items"])
            ranked=request(public + "/openings?search=" + urllib.parse.quote("kiểm tra toàn cục") + "&skills=Java&hours=20&sort=MATCH",token=None)
            assert ranked["total"]==15 and len(ranked["items"])==12 and ranked["items"][0]["id"]==ranked_ids[0], (ranked_ids,ranked)
            assert ranked["items"][0]["match_score"]==100 and ranked["items"][1]["match_score"]==15
            remainder=request(public + "/openings?search=" + urllib.parse.quote("kiểm tra toàn cục") + "&skills=Java&hours=20&sort=MATCH&page=1",token=None)
            assert len(remainder["items"])==3
            assert not set(row["id"] for row in ranked["items"]) & set(row["id"] for row in remainder["items"])
            filtered=request(public + "/openings?search=" + urllib.parse.quote("kiểm tra toàn cục") + "&skills=Java&sort=MATCH&minScore=75&mode=REMOTE",token=None)
            assert filtered["total"]==1 and filtered["items"][0]["id"]==ranked_ids[0]
            unknown=request(public + "/openings?search=" + urllib.parse.quote("kiểm tra toàn cục") + "&sort=MATCH",token=None)
            assert all(row["match_score"] is None for row in unknown["items"])
            request(public + "/openings?minScore=101",token=None,expected=400)
            # No permanent account-role ban after a cooperation has ended.
            # Isolate any unrelated active fixture engagement for this former customer/team pair.
            sql(f"UPDATE team_engagements SET status='COMPLETED',completed_at=UTC_TIMESTAMP(6) WHERE team_id={team} AND customer_user_id='{base.OTHER}';")
            request(profile + "/invitations/by-user",body={"userId":base.OTHER})
            request(profile + "/invitation",token="valid-other",body={"value":True},method="PUT")
            assert request(f"/api/work/projects/{project}",token="valid-other")["role"]=="CUSTOMER"
            current_review=request(reputation,token="valid-other")["review"]
            request(reputation + "/review",token="valid-other",body={**review,"version":current_review["version"],"comment":"Sau khi hợp tác kết thúc, đánh giá lịch sử vẫn thuộc về khách hàng."},method="PUT",expected=409)
            print("PASS global matching: best result across 15 posts, stable pages, score/filter totals, unknown criteria; historical contribution and completed-customer role transitions.")
            print("PASS real MySQL migrations, profiles, marketplace awards, milestone permissions, task linkage, immutable plans, delivery retries, customer rework, acceptance history, final-project acceptance guards, private recruitment, concurrent hiring capacity application withdrawal, private discussions, read receipts and cursor pagination.")
        except Exception:
            for log in logs:
                log.flush()
                log.seek(0)
                print(log.read()[-30000:])
            raise
        finally:
            for process in processes:
                process.terminate()
            for process in processes:
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()
            for log in logs:
                log.close()
            fake.shutdown()
            subprocess.run(["docker", "rm", "-f", container], capture_output=True)


if __name__ == "__main__":
    main()

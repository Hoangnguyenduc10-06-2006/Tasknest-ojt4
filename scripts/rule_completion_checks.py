"""Acceptance checks against the disposable real Identity/Work/Notification stack."""
import base64
import concurrent.futures
import hashlib
import http.client
import json
import os
import socket
import struct
import time
import uuid
from datetime import datetime, timedelta, timezone
from auth_integration_checks import AuthChecks
from profile_integration_checks import png

class SocketClient:
    def __init__(self,port,origin='http://localhost:3000'):
        self.socket=socket.create_connection(('127.0.0.1',port),timeout=10)
        key=base64.b64encode(os.urandom(16)).decode()
        self.socket.sendall((f'GET /ws/work HTTP/1.1\r\nHost: localhost:{port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: {key}\r\nOrigin: {origin}\r\n\r\n').encode())
        response=b''
        while b'\r\n\r\n' not in response: response+=self.socket.recv(1)
        assert b' 101 ' in response,response.split(b'\r\n')[0]
        expected=base64.b64encode(hashlib.sha1((key+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').encode()).digest())
        assert expected.lower() in response.lower()
    def send(self,payload):
        body=json.dumps(payload).encode();mask=os.urandom(4)
        header=bytes([0x81,0x80|len(body)]) if len(body)<126 else bytes([0x81,0xfe])+struct.pack('!H',len(body))
        self.socket.sendall(header+mask+bytes(value^mask[index%4] for index,value in enumerate(body)))
    def exact(self,count):
        result=b''
        while len(result)<count:
            chunk=self.socket.recv(count-len(result))
            if not chunk: raise AssertionError('WebSocket ended unexpectedly')
            result+=chunk
        return result
    def read(self,timeout=5):
        self.socket.settimeout(timeout);first,second=self.exact(2);length=second&127
        if length==126:length=struct.unpack('!H',self.exact(2))[0]
        if length==127:length=struct.unpack('!Q',self.exact(8))[0]
        body=self.exact(length)
        return first&15,body
    def close(self):self.socket.close()

def run(auth,schema,work_port,notification_port,fake,wait):
    schema.sql('DELETE FROM auth_rate_limit_buckets;','identity')
    def login(email):
        client=AuthChecks(auth.port,schema.sql);client.email=email;client.password=auth.password;client.request('/api/identity/status')
        result=client.expect_status(client.login(),200)[1]['data'];return client,result['accessToken'],result['user']['id']
    owner,owner_token,owner_id=login(auth.email)
    member,member_token,member_id=login('member-0@example.test')
    outsider,outsider_token,outsider_id=login('member-2@example.test')
    api=AuthChecks(work_port,schema.sql)
    def request(path,body=None,token=None,method=None,status=200):
        response=api.request('/api/work/projects'+path,body,access_token=token or owner_token,method=method)
        assert response[0]==status,(path,response[0],response[1]);return response[1].get('data')
    today=datetime.now(timezone(timedelta(hours=7))).date()
    project=request('',{'name':'Rule completion acceptance','description':'Disposable complete rule acceptance checks','startsOn':str(today),'endsOn':str(today+timedelta(days=14))},status=201)['id']
    path='/'+str(project)
    invitation=request(path+'/invitations',{'email':member.email},status=201)
    request(path+'/invitations/'+str(invitation)+'/accept',{},token=member_token,method='PUT')
    task_body={'title':'Complete rules task','description':'Full rule regression task','assigneeId':owner_id,'priority':'MEDIUM','startsOn':str(today),'deadlineOn':str(today+timedelta(days=2)),'estimatedSeconds':3600}
    task=request(path+'/tasks',task_body,status=201);task_path=path+'/tasks/'+str(task)
    def version():return int(schema.sql(f'SELECT version FROM tasks WHERE id={task};','work'))
    request(task_path,{'version':version(),'task':{**task_body,'title':'Updated by outsider'}},token=outsider_token,method='PUT',status=404)
    request(task_path,{'version':version(),'task':{**task_body,'title':'Updated by member'}},token=member_token,method='PUT',status=403)
    request(task_path+'/blocked',{'version':version(),'blocked':True,'reason':'Waiting on dependency'},method='PUT')
    request(task_path+'/blocked',{'version':version(),'blocked':False,'reason':'Resolved'},method='PUT')
    stale=version();request(task_path,{'version':stale,'task':{**task_body,'estimatedSeconds':7200}},method='PUT')
    request(task_path,{'version':stale,'task':task_body},method='PUT',status=409)
    request(task_path+'/status',{'version':version(),'status':'IN_PROGRESS','note':'','confirmed':False},method='PUT')
    timer=request(task_path+'/timer',{},status=201)
    request(task_path,{'version':version(),'task':{**task_body,'assigneeId':member_id}},method='PUT')
    assert schema.sql(f'SELECT ended_at IS NOT NULL FROM time_entries WHERE id={timer};','work')=='1'
    request(task_path+'/blocked',{'version':version(),'blocked':True,'reason':'Assigned member can block'},token=member_token,method='PUT')
    print('PASS: task editing/reassignment/current roles, stale version, blocked flag and reassignment timer closure.',flush=True)

    def upload(name,content,kind='COMMENT_IMAGE',request_id=None,token=owner_token,status=201,endpoint=None,fields=None):
        boundary='TaskNestBoundary'+uuid.uuid4().hex
        values={'kind':kind,'requestId':request_id or str(uuid.uuid4())} if fields is None else fields
        parts=[]
        for key,value in values.items():parts.append((f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n{value}\r\n').encode())
        parts += [(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{name}"\r\nContent-Type: application/octet-stream\r\n\r\n').encode(),content,f'\r\n--{boundary}--\r\n'.encode()]
        connection=http.client.HTTPConnection('127.0.0.1',work_port,timeout=20)
        try:
            connection.request('POST',endpoint or '/api/work/projects'+path+'/files',b''.join(parts),{'Authorization':'Bearer '+token,'Content-Type':'multipart/form-data; boundary='+boundary})
            response=connection.getresponse();raw=response.read();data=json.loads(raw or b'{}');assert response.status==status,(response.status,data);return data.get('data')
        finally:connection.close()
    upload('fake.png',b'Not an image',status=400)
    upload('evil.svg',b'<svg/>',status=400)
    upload('../escape.txt',b'data',kind='PROJECT_DOCUMENT',status=400)
    request_id=str(uuid.uuid4());image=upload('safe.png',png(),request_id=request_id)
    assert upload('safe.png',png(),request_id=request_id)['id']==image['id']
    assert api.request('/api/work/projects'+path+'/files/'+str(image['id']),access_token=outsider_token)[0]==404
    usage=request(path+'/files/usage')['used_bytes']
    schema.sql(f'UPDATE project_storage_usage SET used_bytes=limit_bytes-1 WHERE project_id={project};','work')
    upload('over-quota.png',png(),status=409)
    schema.sql(f'UPDATE project_storage_usage SET used_bytes={usage} WHERE project_id={project};','work')
    comment={'requestId':str(uuid.uuid4()),'version':None,'parentId':None,'body':'Root with image and mention','imageIds':[image['id']],'mentions':[member_id]}
    root=request(task_path+'/comments',comment,status=201)
    assert request(task_path+'/comments',comment,status=201)==root
    assert schema.sql(f'SELECT COUNT(*) FROM task_comments WHERE task_id={task};','work')=='1'
    request(task_path+'/comments',{**comment,'requestId':str(uuid.uuid4()),'imageIds':[],'mentions':[owner_id]},status=409)
    request(task_path+'/comments/'+str(root),{**comment,'version':0,'body':'Forged edit'},token=member_token,method='PUT',status=403)
    assert request(task_path+'/comments')['items'][0]['version']==0
    request(task_path+'/comments/'+str(root),{**comment,'version':0,'mentions':[]},method='PUT')
    request(task_path+'/comments/'+str(root),{**comment,'version':1},method='PUT')
    wait(lambda:schema.sql(f"SELECT COUNT(*) FROM tasknest_notification.notifications WHERE recipient_user_id='{member_id}' AND event_type LIKE 'task.comment.%';",'notification')=='1','one mention notification')
    wait(lambda:any(message['to'][0]['email']==member.email and message['subject']=='Bạn được nhắc trong bình luận' for message in fake.messages),'mention email via current contact')
    reply=request(task_path+'/comments',{'requestId':str(uuid.uuid4()),'parentId':root,'body':'Reply','imageIds':[],'mentions':[owner_id]},token=member_token,status=201)
    request(task_path+'/comments',{'requestId':str(uuid.uuid4()),'parentId':reply,'body':'Nested not allowed','imageIds':[],'mentions':[]},token=member_token,status=409)
    request(task_path+'/comments/'+str(root)+'/delete',{'version':2},method='PUT')
    listed=request(task_path+'/comments')['items'][0]
    assert listed['body'] is None and listed['images']==[] and listed['reply_count']==1
    assert api.request('/api/work/projects'+path+'/files/'+str(image['id']),access_token=owner_token)[0]==404
    assert len(request(task_path+'/comments?parentId='+str(root))['items'])==1
    request(task_path+'/comments',{'requestId':str(uuid.uuid4()),'parentId':root,'body':'Deleted parent','imageIds':[],'mentions':[]},token=member_token,status=409)
    print('PASS: real file validation/quota/idempotency/permission, comment image ownership, one-level replies, soft deletion and durable mention deduplication/email.',flush=True)

    document=upload('notes.txt',b'Project acceptance notes',kind='PROJECT_DOCUMENT')
    resource={'requestId':str(uuid.uuid4()),'title':'Project notes','description':'Test document','fileId':document['id'],'url':None}
    rid=request(path+'/resources',resource,status=201)
    assert request(path+'/resources',resource,status=201)==rid
    request(path+'/resources/'+str(rid),{**resource,'version':0,'title':'Not my document'},token=member_token,method='PUT',status=403)
    request(path+'/resources',{**resource,'requestId':str(uuid.uuid4()),'fileId':None,'url':'javascript:alert(1)'},status=409)
    request(path+'/resources',{**resource,'requestId':str(uuid.uuid4()),'fileId':None,'url':'https://user:pass@example.test'},status=409)
    link=request(path+'/resources',{**resource,'requestId':str(uuid.uuid4()),'fileId':None,'url':'https://example.test/docs'},status=201)
    assert request(path+'/resources?type=LINK&size=10')['total']==1
    request(path+'/resources/'+str(rid)+'/delete',{'version':0},method='PUT')
    assert api.request('/api/work/projects'+path+'/files/'+str(document['id']),access_token=owner_token)[0]==404
    avatar=upload('avatar.png',png(),endpoint='/api/work/projects'+path+'/avatar',fields={'version':request(path)['version']},status=200)
    assert api.request('/api/work/projects'+path+'/avatar',access_token=owner_token)[0]==200
    print('PASS: project files/links CRUD, scheme/userinfo rejection, private download revocation, metadata ownership and project avatar.',flush=True)

    connection=SocketClient(work_port);connection.send({'type':'authenticate','accessToken':owner_token})
    assert json.loads(connection.read()[1])['type']=='authenticated'
    assert json.loads(connection.read()[1])['type']=='sync'
    # Flush any notification delivery invalidations already arriving from earlier checks.
    while True:
        try:connection.read(.3)
        except socket.timeout:break
    started=time.monotonic()
    request(task_path+'/blocked',{'version':version(),'blocked':False,'reason':'Realtime mutation'},token=member_token,method='PUT')
    opcode,frame=connection.read(2)
    assert opcode==1 and json.loads(frame)['type']=='sync' and time.monotonic()-started<2
    owner.expect_status(owner.request('/api/identity/auth/logout',{}),200)
    deadline=time.monotonic()+4
    while time.monotonic()<deadline:
        opcode,frame=connection.read(4)
        if opcode==8:break
    assert opcode==8 and struct.unpack('!H',frame[:2])[0]==4401
    connection.close()
    print('PASS: real authenticated WebSocket invalidation under two seconds and revoked-session connection closure.',flush=True)
    # New owner session after deliberately revoking the socket session.
    owner,owner_token,owner_id=login(auth.email)
    analytics=request(path+'/analytics?group=WEEK')['comparison']
    assert analytics and all('loggedSeconds' in row for row in analytics)
    request(path+'/archive',{'version':request(path)['version']},method='POST')
    request(task_path+'/comments',{'requestId':str(uuid.uuid4()),'parentId':None,'body':'Archived','imageIds':[],'mentions':[]},token=member_token,status=409)
    request(path+'/resources',{**resource,'requestId':str(uuid.uuid4()),'fileId':None,'url':'https://example.test'},status=409)
    assert request(path+'/resources')['total']==1
    print('PASS: analytics data scope and archived project read-only collaboration.',flush=True)

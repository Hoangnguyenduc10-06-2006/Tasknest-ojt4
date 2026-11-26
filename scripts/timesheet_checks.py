"""Manual time and revisions against the isolated MySQL + gateway fixture."""
def run(request, sql, gateway, payload, owner, other):
    from datetime import datetime, timedelta, timezone
    from concurrent.futures import ThreadPoolExecutor
    now = datetime.now(timezone.utc)
    def iso(value): return value.isoformat().replace('+00:00','Z')
    base = now.replace(hour=1, minute=0, second=0, microsecond=0) - timedelta(days=3)
    today=sql('SELECT DATE(DATE_ADD(UTC_TIMESTAMP(),INTERVAL 7 HOUR))')
    def project(name):
        result=request(gateway,body=payload(name)); assert result[0]==201,result
        return result[1]['data']['id']
    p1=project('Timesheet regression A');p2=project('Timesheet regression B')
    def task(pid,name):
        result=request(gateway,body={'title':name,'description':'Integration fixture','assigneeId':owner,'priority':'MEDIUM','startsOn':today,'deadlineOn':today,'estimatedSeconds':3600},path=f'/api/work/projects/{pid}/tasks')
        assert result[0]==201,result
        return result[1]['data']
    t1=task(p1,'Manual time task A');t2=task(p2,'Manual time task B')
    def add(pid,tid,start,end,token='valid-owner',reason='Quên ghi giờ'):
        return request(gateway,token,body={'startedAt':iso(start),'endedAt':iso(end),'reason':reason},path=f'/api/work/projects/{pid}/tasks/{tid}/time-entries')
    first=add(p1,t1,base,base+timedelta(hours=1));assert first[0]==201,first
    entry_id=first[1]['data']
    assert sql(f"SELECT CONCAT(source,':',version,':',duration_microseconds) FROM time_entries WHERE id={entry_id}")=='MANUAL:0:3600000000'
    assert add(p2,t2,base+timedelta(minutes=30),base+timedelta(hours=2))[0]==409
    assert add(p2,t2,base+timedelta(hours=1),base+timedelta(hours=2))[0]==201  # adjacent is valid
    assert add(p1,t1,now,now+timedelta(hours=1))[0]==409
    assert add(p1,t1,base,base)[0]==409
    assert add(p1,t1,base+timedelta(days=1),base+timedelta(days=1,hours=1),reason=' ')[0]==400
    assert add(p2,t1,base,base+timedelta(hours=1))[0]==404
    assert add(p1,t1,base,base+timedelta(hours=1),'valid-other')[0]==404
    sql(f"INSERT INTO project_memberships(project_id,user_id,status,joined_at,added_by) VALUES({p1},'{other}','ACTIVE',UTC_TIMESTAMP(6),'{owner}')")
    sql(f"UPDATE projects SET manager_user_id='{other}' WHERE id={p1}")
    assert add(p1,t1,base+timedelta(days=1),base+timedelta(days=1,hours=1),'valid-other')[0]==403
    def edit(start,end,version=0,token='valid-owner'):
        return request(gateway,token,body={'startedAt':iso(start),'endedAt':iso(end),'reason':'Sửa thời gian thực tế','version':version},path=f'/api/work/projects/{p1}/time-entries/{entry_id}',method='PUT')
    assert edit(base,base+timedelta(minutes=40),token='valid-other')[0]==404  # even Manager cannot edit another user's time
    updated=edit(base+timedelta(minutes=10),base+timedelta(minutes=50));assert updated[0]==200,updated
    assert edit(base,base+timedelta(minutes=50))[0]==409
    assert edit(base,base+timedelta(hours=1,minutes=30),1)[0]==409  # overlaps project B
    assert sql(f"SELECT COUNT(*) FROM time_entry_revisions WHERE time_entry_id={entry_id}")=='1'
    assert sql(f"SELECT CONCAT(version,':',duration_microseconds) FROM time_entries WHERE id={entry_id}")=='1:2400000000'
    revisions=request(gateway,path='/api/work/projects/workspace/time-revisions')
    assert revisions[0]==200,revisions
    own=[row for row in revisions[1]['data'] if row['entryId']==entry_id]
    assert len(own)==1 and own[0]['reason']=='Sửa thời gian thực tế',own
    assert not any(row['entryId']==entry_id for row in request(gateway,'valid-other',path='/api/work/projects/workspace/time-revisions')[1]['data'])
    assert request(gateway,None,path='/api/work/projects/workspace/time-revisions')[0]==401
    # Locked tasks and archived projects reject both inserts and edits.
    prefix=f'/api/work/projects/{p1}/tasks/{t1}'
    def move(status,version,note='',confirmed=False):
        result=request(gateway,body={'status':status,'version':version,'note':note,'confirmed':confirmed,**({'resultUrl':'https://example.com/result'} if status=='REVIEW' else {})},path=prefix+'/status',method='PUT')
        assert result[0]==200,result
    move('IN_PROGRESS',0);move('REVIEW',1,'Kết quả');move('DONE',2,confirmed=True)
    assert add(p1,t1,base+timedelta(days=1),base+timedelta(days=1,hours=1))[0]==409
    assert edit(base,base+timedelta(minutes=30),1)[0]==409
    move('IN_PROGRESS',3,'Mở lại');move('CANCELLED',4,'Hủy công việc')
    assert edit(base,base+timedelta(minutes=30),1)[0]==409
    assert add(p1,t1,base+timedelta(days=1),base+timedelta(days=1,hours=1))[0]==409
    archive=request(gateway,body={'version':0},path=f'/api/work/projects/{p2}/archive',method='POST');assert archive[0]==200,archive
    assert add(p2,t2,base+timedelta(days=1),base+timedelta(days=1,hours=1))[0]==409
    reopen=request(gateway,body={'version':1},path=f'/api/work/projects/{p2}/reopen',method='POST');assert reopen[0]==200,reopen
    # Exactly one of two overlapping concurrent submissions on different projects may commit.
    p3=project('Timesheet regression C');t3=task(p3,'Manual concurrent task')
    start,end=base+timedelta(days=1),base+timedelta(days=1,hours=1)
    deadlocks_before=sql("SHOW GLOBAL STATUS LIKE 'Innodb_deadlocks'")
    with ThreadPoolExecutor(max_workers=2) as pool:
        jobs=[pool.submit(add,pid,tid,start,end) for pid,tid in [(p2,t2),(p3,t3)]]
        responses=[job.result() for job in jobs]
        statuses=[response[0] for response in responses]
    assert sorted(statuses)==[201,409],responses
    assert sql("SHOW GLOBAL STATUS LIKE 'Innodb_deadlocks'")==deadlocks_before
    # A running timer occupies [startedAt, infinity), not only the instant it began.
    prefix2=f'/api/work/projects/{p3}/tasks/{t3}'
    assert request(gateway,body={'version':0},path=prefix2+'/start',method='PUT')[0]==200
    timer=request(gateway,path=prefix2+'/timer',method='POST');assert timer[0]==201,timer
    running_start=sql(f"SELECT DATE_FORMAT(started_at,'%Y-%m-%dT%H:%i:%s.%fZ') FROM time_entries WHERE id={timer[1]['data']}")
    started=datetime.fromisoformat(running_start.replace('Z','+00:00'))
    assert add(p2,t2,started,datetime.now(timezone.utc))[0]==409
    assert request(gateway,body={'startedAt':iso(base),'endedAt':iso(base+timedelta(minutes=10)),'reason':'Sửa phiên đang chạy','version':0},path=f'/api/work/projects/{p3}/time-entries/{timer[1]["data"]}',method='PUT')[0]==409
    assert request(gateway,path=f'/api/work/projects/{p3}/time-entries/{timer[1]["data"]}/stop',method='PUT')[0]==200
    # Two tabs starting timers on different projects still produce one running session.
    assert request(gateway,body={'version':0},path=f'/api/work/projects/{p2}/tasks/{t2}/start',method='PUT')[0]==200
    deadlocks_before=sql("SHOW GLOBAL STATUS LIKE 'Innodb_deadlocks'")
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures=[pool.submit(request,gateway,path=f'/api/work/projects/{pid}/tasks/{tid}/timer',method='POST') for pid,tid in [(p2,t2),(p3,t3)]]
        result=[future.result() for future in futures]
    assert sorted(response[0] for response in result)==[201,409],result
    assert sql("SHOW GLOBAL STATUS LIKE 'Innodb_deadlocks'")==deadlocks_before
    assert sql(f"SELECT COUNT(*) FROM time_entries WHERE user_id='{owner}' AND ended_at IS NULL")=='1'
    # A returned workspace contains the same saved interval after a fresh request.
    saved=[row for row in request(gateway,path='/api/work/projects/workspace')[1]['data']['timeEntries'] if row['id']==entry_id]
    assert len(saved)==1 and saved[0]['version']==1,saved
    print('PASS: manual time persistence, cross-project overlap/concurrency, running timer overlap, future rejection, own-entry permissions, revisions, stale version and terminal/archive guards.',flush=True)

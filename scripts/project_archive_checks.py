"""Archive/reopen regression checks for the isolated gateway + MySQL fixture."""
def run(request, sql, gateway, payload, owner, member):
    result = request(gateway, body=payload('Review reopen fixture'))
    assert result[0] == 201, result
    project = result[1]['data']; pid=project['id']; path=f'/api/work/projects/{pid}'
    def change(action, version, token='valid-owner'):
        return request(gateway, token, body={'version':version}, path=path+'/'+action, method='POST')
    assert request(gateway,body={},path=path+'/archive',method='POST')[0] == 400
    assert change('archive',0,'valid-other')[0] == 404
    sql(f"INSERT INTO project_memberships(project_id,user_id,status,joined_at,added_by) VALUES({pid},'{member}','ACTIVE',UTC_TIMESTAMP(6),'{owner}')")
    assert change('archive',0,'valid-other')[0] == 403
    sql(f"UPDATE projects SET manager_user_id='{member}' WHERE id={pid}")
    assert change('archive',0,'valid-other')[0] == 403
    today=sql('SELECT DATE(DATE_ADD(UTC_TIMESTAMP(),INTERVAL 7 HOUR))')
    created=request(gateway,body={'title':'Review timer archive','description':'Fixture','assigneeId':member,'priority':'MEDIUM','startsOn':today,'deadlineOn':today,'estimatedSeconds':3600},path=path+'/tasks')
    assert created[0] == 201, created
    tid=created[1]['data']; task_path=path+f'/tasks/{tid}'
    assert request(gateway,'valid-other',body={'version':0},path=task_path+'/start',method='PUT')[0] == 200
    timer=request(gateway,'valid-other',path=task_path+'/timer',method='POST')
    assert timer[0] == 201, timer
    denied=change('archive',0)
    assert denied[0] == 409 and denied[1]['code']=='PROJECT_HAS_RUNNING_TIMER', denied
    assert request(gateway,'valid-other',path=path+'/time-entries/'+str(timer[1]['data'])+'/stop',method='PUT')[0] == 200
    archived=change('archive',0)
    assert archived[0] == 200 and archived[1]['data']['status']=='ARCHIVED' and archived[1]['data']['version']==1, archived
    assert sql(f"SELECT COUNT(*) FROM projects WHERE id={pid} AND archived_at IS NOT NULL AND archived_by='{owner}'")=='1'
    assert request(gateway,'valid-other',path=task_path+'/timer',method='POST')[0]==409
    assert change('reopen',1,'valid-other')[0] == 403
    duplicate=request(gateway,body=payload('Review reopen fixture'))
    assert duplicate[0] == 201, duplicate
    denied=change('reopen',1)
    assert denied[0] == 409 and denied[1]['code']=='PROJECT_NAME_EXISTS', denied
    duplicate_id=duplicate[1]['data']['id']
    renamed=request(gateway,body={**payload('Review renamed duplicate'),'version':0},path=f'/api/work/projects/{duplicate_id}',method='PUT')
    assert renamed[0] == 200, renamed
    reopened=change('reopen',1)
    assert reopened[0] == 200 and reopened[1]['data']['status']=='ACTIVE' and reopened[1]['data']['version']==2, reopened
    assert sql(f"SELECT COUNT(*) FROM projects WHERE id={pid} AND archived_at IS NULL AND archived_by IS NULL")=='1'
    assert sql(f"SELECT COUNT(*) FROM activity_logs WHERE project_id={pid} AND action IN ('PROJECT_ARCHIVED','PROJECT_REOPENED')")=='2'
    assert change('archive',1)[0]==409
    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(max_workers=2) as pool:
        archive_future=pool.submit(change,'archive',2)
        timer_future=pool.submit(request,gateway,'valid-other',path=task_path+'/timer',method='POST')
        pair=(archive_future.result()[0],timer_future.result()[0])
    assert pair in ((200,409),(409,201)), pair
    print('PASS: real MySQL archive/reopen, Owner-only, Manager/Member denial, global active timer guard, duplicate active name, cleared archive metadata, audit history, stale version and timer/archive concurrency.', flush=True)

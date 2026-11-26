"""Task workflow checks against the isolated MySQL + gateway integration fixture."""
from uuid import uuid4


def check_workflow(request, sql, gateway, project_path, task_body, owner, member, other_project):
    path = project_path + '/tasks'
    def create(title, assignee=member):
        result = request(gateway, body={**task_body, 'title': title, 'assigneeId': assignee}, path=path)
        assert result[0] == 201, result
        return result[1]['data']
    task_id = create('Kanban workflow fixture')
    prefix = path + '/' + str(task_id)
    def move(status, version, token='valid-owner', note='', confirmed=False, endpoint=prefix, **plan):
        return request(gateway, token, body={'status': status, 'version': version, 'note': note, 'confirmed': confirmed, **({'resultUrl':'https://example.com/result'} if status=='REVIEW' else {}), **plan}, path=endpoint+'/status', method='PUT')
    def state():
        return sql(f"SELECT CONCAT(status,':',version) FROM tasks WHERE id={task_id};")
    def history(endpoint=prefix, token='valid-owner', page=0, size=20):
        return request(gateway, token, path=f'{endpoint}/submissions?page={page}&size={size}')
    empty_history = history()
    assert empty_history[0] == 200 and empty_history[1]['data']['content'] == [], empty_history
    assert history(size=1)[0] == 400
    assert history(token='valid-outsider')[0] == 404
    assert state() == 'TODO:0'
    assert request(gateway,path=prefix+'/submission')[1]['data'] is None
    assert move('DONE', 0, confirmed=True)[0] == 409
    assert move('IN_PROGRESS', 0, 'valid-member')[0] == 404  # not a project member
    assert move('IN_PROGRESS', 0, endpoint=f'/api/work/projects/{other_project}/tasks/{task_id}')[0] == 404
    assert move('IN_PROGRESS', 0)[0] == 403  # only the assignee may start
    assert move('IN_PROGRESS', 0, 'valid-other')[0] == 200
    assert move('REVIEW', 0, 'valid-other', note='Stale version')[0] == 409
    assert move('REVIEW', 1, 'valid-other', note='  ')[0] == 409
    timer = request(gateway, 'valid-other', path=prefix+'/timer', method='POST')
    assert timer[0] == 201, timer
    assert move('REVIEW', 1, 'valid-other', note='Thiếu kết quả', resultUrl=None)[0] == 409
    assert move('REVIEW', 1, 'valid-other', note='Link không an toàn', resultUrl='javascript:alert(1)')[0] == 409
    assert move('REVIEW', 1, 'valid-other', note='Kết quả lần một')[0] == 200
    assert state() == 'IN_REVIEW:2'
    latest = request(gateway,path=prefix+'/submission')[1]['data']
    assert latest['resultUrl'] == 'https://example.com/result' and latest['fileId'] is None
    assert latest['number'] == 1 and latest['resultNote'] == 'Kết quả lần một' and latest['decision'] == 'PENDING', latest
    submitted_history = history()[1]['data']
    assert submitted_history['totalElements'] == 1 and submitted_history['totalPages'] == 1
    first = submitted_history['content'][0]
    assert first['submittedBy']['id'] == member and first['assignee']['id'] == member
    assert first['reviewOutcome'] == 'PENDING' and first['reviewedBy'] is None and first['reviewedAt'] is None
    assert first['file'] is None and first['resultUrl'] == 'https://example.com/result'
    assert request(gateway, path=prefix+'/submissions/'+str(first['id'])+'/file')[0] == 404

    assert request(gateway,'valid-outsider',path=prefix+'/submission')[0] == 404
    assert sql(f"SELECT COUNT(*) FROM time_entries WHERE task_id={task_id} AND ended_at IS NULL") == '0'
    assert move('DONE', 2, 'valid-other', confirmed=True)[0] == 403
    assert move('DONE', 2)[0] == 409
    assert move('IN_PROGRESS', 2, note='Cần sửa API')[0] == 409
    assert state() == 'IN_REVIEW:2'
    assert move('IN_PROGRESS', 2, note='Cần sửa API', deadlineOn='2099-12-31', estimatedSeconds=task_body['estimatedSeconds'] + 1)[0] == 409
    assert move('IN_PROGRESS', 2, note='Cần sửa API', deadlineOn='2099-12-31')[0] == 200
    assert sql(f"SELECT CONCAT(deadline_on,':',estimated_seconds) FROM tasks WHERE id={task_id}") == f"2099-12-31:{task_body['estimatedSeconds']}"
    assert sql(f"SELECT CONCAT(submission_no,':',decision,':',HEX(rejection_reason)) FROM task_submissions WHERE task_id={task_id}") == '1:REJECTED:' + 'Cần sửa API'.encode().hex().upper()
    assert history()[1]['data']['content'][0]['reviewOutcome'] == 'REWORK_REQUESTED'
    assert move('REVIEW', 3, 'valid-other', note='Kết quả lần hai')[0] == 200
    assert move('DONE', 4, confirmed=True)[0] == 200
    assert sql(f"SELECT COUNT(*) FROM tasks t JOIN task_submissions s ON s.id=t.accepted_submission_id WHERE t.id={task_id} AND s.submission_no=2 AND s.decision='ACCEPTED' AND s.reviewed_by='{owner}' AND t.completed_at IS NOT NULL") == '1'
    assert move('IN_PROGRESS', 5, note='Mở lại để bổ sung')[0] == 200
    assert sql(f"SELECT COUNT(*) FROM tasks WHERE id={task_id} AND completed_at IS NULL AND accepted_submission_id IS NULL") == '1'
    assert sql(f"SELECT COUNT(*) FROM task_submissions WHERE task_id={task_id}") == '2'
    assert move('CANCELLED', 6, 'valid-other', note='Không làm nữa')[0] == 403
    assert move('CANCELLED', 6, note='Đổi phạm vi')[0] == 200
    assert move('IN_PROGRESS', 7, note='Thử khôi phục')[0] == 409
    assert state() == 'CANCELLED:7'
    # Cancelling after reopening must not reclassify the earlier review decisions.
    history_rows = history()[1]['data']['content']
    assert [row['number'] for row in history_rows] == [2, 1], history_rows
    assert [row['reviewOutcome'] for row in history_rows] == ['ACCEPTED', 'REWORK_REQUESTED'], history_rows
    assert history_rows[0]['reviewedBy']['id'] == owner
    # Simulate pre-deliverable/legacy data and an unrecognized legacy review event in this isolated fixture only.
    sql(f"UPDATE task_submissions SET result_url=NULL,result_file_id=NULL WHERE task_id={task_id} AND submission_no=1")
    sql(f"UPDATE activity_logs SET action='LEGACY_REVIEW' WHERE task_id={task_id} AND action='TASK_REJECTED'")
    legacy = history()[1]['data']['content'][1]
    assert legacy['reviewOutcome'] == 'REJECTED' and legacy['resultUrl'] is None and legacy['file'] is None

    # Cancellation while under review closes the pending submission, preserving its history.
    reviewed = create('Kanban cancelled review')
    reviewed_path = path + '/' + str(reviewed)
    assert move('IN_PROGRESS', 0, 'valid-other', endpoint=reviewed_path)[0] == 200
    content = b'Task submission acceptance fixture'
    request_id = str(uuid4())
    boundary = 'TaskNestBoundary' + request_id
    multipart = (
        f'--{boundary}\r\nContent-Disposition: form-data; name="kind"\r\n\r\nPROJECT_DOCUMENT\r\n'
        f'--{boundary}\r\nContent-Disposition: form-data; name="requestId"\r\n\r\n{request_id}\r\n'
        f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="result.txt"\r\n'
        'Content-Type: text/plain\r\n\r\n'
    ).encode() + content + f'\r\n--{boundary}--\r\n'.encode()
    uploaded = request(gateway, 'valid-other', body=multipart, path=project_path+'/files', method='POST',
                       content_type='multipart/form-data; boundary='+boundary)
    assert uploaded[0] == 201, uploaded
    file_id = uploaded[1]['data']['id']
    assert move('REVIEW', 1, 'valid-other', note='Đã nộp', endpoint=reviewed_path,
                resultUrl=None, resultFileId=file_id)[0] == 200
    assert move('CANCELLED', 2, note='Hủy yêu cầu', endpoint=reviewed_path)[0] == 200
    assert sql(f"SELECT COUNT(*) FROM task_submissions WHERE task_id={reviewed} AND decision='PENDING'") == '0'
    closed = history(reviewed_path)[1]['data']['content'][0]
    assert closed['decision'] == 'REJECTED' and closed['reviewOutcome'] == 'TASK_CANCELLED', closed
    assert closed['rejectionReason'] == 'Hủy yêu cầu'
    assert closed['file'] == {'id': file_id, 'name': 'result.txt', 'available': True}, closed
    file_path = f"{reviewed_path}/submissions/{closed['id']}/file"
    assert request(gateway, 'valid-other', path=file_path, raw=True) == (200, content)

    # Project archival, revoked membership and stale writes are checked at the server.
    project_id = int(project_path.rsplit('/', 1)[1])
    archived_task = create('Kanban archived fixture')
    sql(f"UPDATE projects SET status='ARCHIVED',archived_at=UTC_TIMESTAMP(6),archived_by='{owner}' WHERE id={project_id}")
    assert move('IN_PROGRESS', 0, endpoint=path+'/'+str(archived_task))[0] == 409
    assert history(reviewed_path, 'valid-other')[0] == 200  # archived history remains readable
    sql(f"UPDATE projects SET status='ACTIVE',archived_at=NULL,archived_by=NULL WHERE id={project_id}")
    invalid = move('IN_PROGRESS', -1, endpoint=path+'/'+str(archived_task))
    assert invalid[0] == 400, invalid
    from concurrent.futures import ThreadPoolExecutor
    concurrent_path = path + '/' + str(archived_task)
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: move('IN_PROGRESS', 0, 'valid-other', endpoint=concurrent_path)[0], range(2)))
    assert sorted(results) == [200, 409], results
    # A removed assignee cannot keep using an already loaded board.
    removed_task = create('Kanban removed assignee')
    sql(f"UPDATE project_memberships SET status='REMOVED',removed_at=UTC_TIMESTAMP(6),removed_by='{owner}' WHERE project_id={project_id} AND user_id='{member}'")
    assert move('IN_PROGRESS', 0, 'valid-other', endpoint=path+'/'+str(removed_task))[0] == 404
    assert history(reviewed_path, 'valid-other')[0] == 404
    assert request(gateway,'valid-other',path=file_path)[0] == 404
    sql(f"UPDATE project_memberships SET status='ACTIVE',removed_at=NULL,removed_by=NULL WHERE project_id={project_id} AND user_id='{member}'")
    # Manager permissions come from the database, including self-approval.
    manager_task = create('Kanban manager approval')
    manager_path = path + '/' + str(manager_task)
    sql(f"UPDATE projects SET manager_user_id='{member}' WHERE id={project_id}")
    assert move('IN_PROGRESS', 0, 'valid-other', endpoint=manager_path)[0] == 200
    assert move('REVIEW', 1, 'valid-other', note='Kết quả của Manager', endpoint=manager_path)[0] == 200
    assert move('DONE', 2, 'valid-other', confirmed=True, endpoint=manager_path)[0] == 200
    assert sql(f"SELECT COUNT(*) FROM task_submissions WHERE task_id={manager_task} AND reviewed_by='{member}' AND decision='ACCEPTED'") == '1'
    sql(f"UPDATE projects SET manager_user_id=NULL WHERE id={project_id}")
    paged_task = create('Submission history pagination fixture')
    rows = ','.join(f"({project_id},{paged_task},{number},'{member}','{member}','Legacy result','2099-12-31',UTC_TIMESTAMP(6),'ACCEPTED','{owner}',UTC_TIMESTAMP(6))" for number in range(1, 12))
    sql("INSERT INTO task_submissions(project_id,task_id,submission_no,submitted_by,assignee_user_id,result_note,deadline_on_snapshot,submitted_at,decision,reviewed_by,reviewed_at) VALUES" + rows)
    paged_path = path + '/' + str(paged_task)
    page0 = history(paged_path, page=0, size=10)[1]['data']
    page1 = history(paged_path, page=1, size=10)[1]['data']
    page2 = history(paged_path, page=2, size=10)[1]['data']
    assert page0['totalElements'] == 11 and page0['totalPages'] == 2
    assert [row['number'] for row in page0['content']] == list(range(11, 1, -1))
    assert [row['number'] for row in page1['content']] == [1]
    assert page2['content'] == [] and page2['totalElements'] == 11
    assert history(f'/api/work/projects/{other_project}/tasks/{paged_task}')[0] == 404

    print('PASS: Kanban workflow permissions, notes, approval, submission history, reopen, cancellation, timer closure, archival and optimistic versions.')

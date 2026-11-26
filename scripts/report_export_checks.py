"""CSV report regressions for the disposable Gateway/Work/MySQL fixture only."""
import csv
import io
import urllib.error
import urllib.request
from urllib.parse import urlencode


def check_report_exports(sql, gateway, project_path, owner, member):
    project = int(project_path.rsplit('/', 1)[1])

    def download(kind, token='valid-owner', start='2026-10-20', end='2026-10-20'):
        query = urlencode({'type': kind, 'from': start, 'to': end})
        req = urllib.request.Request(f'http://127.0.0.1:{gateway}{project_path}/reports/export?{query}')
        if token:
            req.add_header('Authorization', 'Bearer ' + token)
        try:
            with urllib.request.urlopen(req, timeout=15) as response:
                body = response.read()
                assert body.startswith(b'\xef\xbb\xbf'), 'CSV must preserve Vietnamese in Excel'
                assert response.headers.get_content_type() == 'text/csv'
                assert response.headers['Cache-Control'] == 'no-store'
                assert 'attachment;' in response.headers['Content-Disposition']
                return response.status, list(csv.DictReader(io.StringIO(body.decode('utf-8-sig'))))
        except urllib.error.HTTPError as error:
            return error.code, []

    def task(name, user):
        return int(sql(f"INSERT INTO tasks(project_id,name,assignee_user_id,created_by,priority,status,starts_on,deadline_on,estimated_seconds) VALUES({project},'{name}','{user}','{owner}','MEDIUM','TODO','2026-10-19','2026-10-20',7200); SELECT LAST_INSERT_ID();"))

    owner_task = task('Report owner only', owner)
    member_task = task('=SUM(1,2)', member)
    # A cross-midnight session contributes only the two hours after midnight Vietnam time.
    sql(f"INSERT INTO time_entries(project_id,task_id,user_id,source,started_at,ended_at,manual_reason,created_by,updated_by) VALUES({project},{member_task},'{member}','MANUAL','2026-10-19 16:00:00','2026-10-19 19:00:00','Report fixture','{member}','{member}');")
    sql(f"INSERT INTO time_entries(project_id,task_id,user_id,source,started_at,ended_at,manual_reason,created_by,updated_by) VALUES({project},{owner_task},'{owner}','MANUAL','2026-10-20 01:00:00','2026-10-20 02:00:00','Report fixture','{owner}','{owner}');")
    # Another user's historical hours on the member's current task must stay private.
    sql(f"INSERT INTO time_entries(project_id,task_id,user_id,source,started_at,ended_at,manual_reason,created_by,updated_by) VALUES({project},{member_task},'{owner}','MANUAL','2026-10-20 03:00:00','2026-10-20 03:30:00','Report fixture','{owner}','{owner}');")
    assert download('TIME', None)[0] == 401
    assert download('TASKS', 'valid-outsider')[0] == 404
    assert download('TIME', 'unverified')[0] == 403
    assert download('OTHER')[0] == 400
    assert download('TIME', start='2026-10-21', end='2026-10-20')[0] == 400
    status, tasks = download('TASKS', 'valid-other')
    assert status == 200 and {int(row['ID nhiệm vụ']) for row in tasks} == {member_task}, tasks
    assert tasks[0]['Giờ đã ghi trong kỳ'] == '2.0000', tasks
    assert tasks[0]['Nhiệm vụ'] == "'=SUM(1,2)", tasks
    status, entries = download('TIME', 'valid-other')
    assert status == 200 and {row['ID người ghi giờ'] for row in entries} == {member}, entries
    assert entries[0]['Giờ trong kỳ'] == '2.0000', entries
    assert entries[0]['Bắt đầu trong kỳ (giờ Việt Nam)'] == '2026-10-20T00:00+07:00', entries
    status, tasks = download('TASKS')
    assert status == 200 and {int(row['ID nhiệm vụ']) for row in tasks} == {owner_task, member_task}, tasks
    assert next(row for row in tasks if int(row['ID nhiệm vụ']) == member_task)['Giờ đã ghi trong kỳ'] == '2.5000'
    # Management permission is resolved on each request, not taken from a JWT or the UI.
    sql(f"UPDATE projects SET manager_user_id='{member}' WHERE id={project};")
    assert {row['ID người ghi giờ'] for row in download('TIME', 'valid-other')[1]} == {owner, member}
    sql(f"UPDATE projects SET manager_user_id=NULL WHERE id={project};")
    sql(f"UPDATE tasks SET assignee_user_id='{owner}' WHERE id={member_task};")
    assert download('TASKS', 'valid-other')[1] == []
    assert {row['ID người ghi giờ'] for row in download('TIME', 'valid-other')[1]} == {member}
    assert download('TASKS', start='2020-01-01', end='2020-01-01') == (200, [])
    sql(f"UPDATE projects SET status='ARCHIVED',archived_at=UTC_TIMESTAMP(6),archived_by='{owner}' WHERE id={project};")
    assert download('TIME', 'valid-other')[0] == 200
    sql(f"UPDATE projects SET status='ACTIVE',archived_at=NULL,archived_by=NULL WHERE id={project};")
    sql(f"UPDATE project_memberships SET status='REMOVED',removed_at=UTC_TIMESTAMP(6),removed_by='{owner}' WHERE project_id={project} AND user_id='{member}';")
    assert download('TIME', 'valid-other')[0] == 404
    sql(f"UPDATE project_memberships SET status='ACTIVE',removed_at=NULL,removed_by=NULL WHERE project_id={project} AND user_id='{member}';")
    print('PASS: CSV report scoping, timezone clipping, formula escaping, reassignment, current roles, archival and revoked membership.')

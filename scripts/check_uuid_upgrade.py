"""UUID upgrade regression. Called only with test-schema.py's disposable database connection."""
import hashlib
import re
import uuid


def legacy_uuid(value):
    return str(uuid.UUID(bytes=hashlib.md5(f'tasknest:user:{value}'.encode()).digest(), version=3))


def migration_version(path):
    return tuple(int(part) for part in re.split(r'[._]', path.name.split('__', 1)[0][1:]))


def check_uuid_upgrade(root, query):
    databases = {s: f'tasknest_uuid_upgrade_{s}' for s in ('identity', 'work', 'notification')}
    for service, db in databases.items():
        query(f'CREATE DATABASE {db};')
        folder = root / f'services/{service}-service/src/main/resources/db/migration'
        uuid_migration, = folder.glob('*__use_uuid_account_ids.sql')
        for migration in sorted(folder.glob('V*.sql'), key=migration_version):
            if migration_version(migration) < migration_version(uuid_migration):
                query(migration.read_text(), db)
    query('''
        INSERT INTO users(id,full_name,email,password_hash) VALUES (6,'Legacy User','legacy@example.test','fixture');
        INSERT INTO auth_sessions(id,user_id,created_at,expires_at,last_seen_at)
          VALUES ('legacy-session',6,'2026-10-20','2026-10-27','2026-10-20');
        INSERT INTO refresh_tokens(id,session_id,token_hash,created_at)
          VALUES ('legacy-refresh','legacy-session',UNHEX(SHA2('legacy-refresh',256)),'2026-10-20');
        INSERT INTO account_tokens(user_id,purpose,token_hash,created_at,expires_at)
          VALUES (6,'EMAIL_VERIFICATION',UNHEX(SHA2('verify',256)),'2026-10-20','2026-10-21');
        INSERT INTO outbox_events(event_id,aggregate_type,aggregate_id,aggregate_version,event_type,occurred_at,payload)
          VALUES ('legacy-event','User','6',0,'identity.email-verification.requested','2026-10-20',JSON_OBJECT('userId',6));
    ''', databases['identity'])
    query('''
        INSERT INTO projects(id,owner_user_id,name,description,starts_on,ends_on)
          VALUES (1,6,'Legacy project','Existing project data','2026-10-19','2026-11-15');
        INSERT INTO project_memberships(project_id,user_id,joined_at,added_by) VALUES (1,6,'2026-10-19',6);
        INSERT INTO tasks(id,project_id,name,assignee_user_id,created_by,starts_on,deadline_on,estimated_seconds)
          VALUES (1,1,'Legacy task',6,6,'2026-10-19','2026-11-01',3600);
        INSERT INTO task_comments(id,project_id,task_id,author_user_id,body,created_at) VALUES (1,1,1,6,'Legacy comment','2026-10-26');
        INSERT INTO task_comments(id,project_id,task_id,author_user_id,body,created_at,deleted_at) VALUES (2,1,1,6,NULL,'2026-10-26','2026-10-27');
        INSERT INTO time_entries(project_id,task_id,user_id,source,started_at,created_by,updated_by)
          VALUES (1,1,6,'TIMER','2026-10-26',6,6);
    ''', databases['work'])
    query('''
        INSERT INTO notifications(id,recipient_user_id,event_id,event_type,resource_type,resource_id,title,body)
          VALUES (1,6,'legacy-event','test','Task','1','Existing notification','Existing body');
        INSERT INTO email_jobs(event_id,recipient_user_id,recipient_email,event_type,purpose,notification_id,template_key,template_data)
          VALUES ('legacy-event',6,'legacy@example.test','test','PROJECT_EVENT',1,'test','{}');
    ''', databases['notification'])
    for service, db in databases.items():
        folder = root / f'services/{service}-service/src/main/resources/db/migration'
        migration, = folder.glob('*__use_uuid_account_ids.sql')
        query(migration.read_text(), db)
        for later in sorted(folder.glob('V*.sql'), key=migration_version):
            if migration_version(later) > migration_version(migration):
                query(later.read_text(), db)
    expected = legacy_uuid(6)
    assert query("SELECT body FROM task_comments WHERE id=1;", databases['work']) == 'Legacy comment'
    assert query("SELECT deleted_by FROM task_comments WHERE id=2;", databases['work']) == expected
    assert query("SELECT COUNT(*) FROM project_storage_usage WHERE project_id=1;", databases['work']) == '1'
    assert query('SELECT id FROM users;', databases['identity']) == expected
    assert query('SELECT user_id FROM auth_sessions;', databases['identity']) == expected
    assert query('SELECT user_id FROM account_tokens;', databases['identity']) == expected
    assert query('SELECT COUNT(*) FROM auth_sessions WHERE revoked_at IS NOT NULL;', databases['identity']) == '1'
    assert query('SELECT COUNT(*) FROM refresh_tokens WHERE revoked_at IS NOT NULL;', databases['identity']) == '1'
    assert query("SELECT CONCAT(aggregate_id,'|',JSON_UNQUOTE(payload->'$.userId'),'|',schema_version) FROM outbox_events;", databases['identity']) == f'{expected}|{expected}|2'
    assert query('SELECT owner_user_id FROM projects;', databases['work']) == expected
    assert query('SELECT user_id FROM project_memberships;', databases['work']) == expected
    assert query('SELECT assignee_user_id FROM tasks;', databases['work']) == expected
    assert query('SELECT running_user_id FROM time_entries;', databases['work']) == expected
    assert query('SELECT recipient_user_id FROM notifications;', databases['notification']) == expected
    assert query('SELECT recipient_user_id FROM email_jobs;', databases['notification']) == expected
    query("UPDATE account_tokens SET user_id='missing-user';", databases['identity'], rejects=1452)
    query("UPDATE tasks SET assignee_user_id='missing-user';", databases['work'], rejects=1452)
    query("UPDATE email_jobs SET recipient_user_id='missing-user';", databases['notification'], rejects=1452)
    for db in databases.values():
        query(f'DROP DATABASE {db};')
    print('PASS: existing user 6 -> identical UUID across all services; sessions revoked, data/FKs preserved', flush=True)

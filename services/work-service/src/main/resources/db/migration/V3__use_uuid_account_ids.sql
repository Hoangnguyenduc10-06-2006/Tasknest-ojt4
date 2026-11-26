-- Direct account ID migration: BIGINT -> UUID strings, no public_id column.

-- Stop ALL application writers/consumers and back up all three databases before upgrade.

-- MySQL DDL auto-commits: restore the backup if a migration fails; do not blindly repair Flyway.

-- Existing accounts use deterministic name-based UUIDs; new accounts use random UUID v4.

CREATE TEMPORARY TABLE uuid_user_id_map (legacy_id VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY, uuid_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE);

INSERT INTO uuid_user_id_map(legacy_id, uuid_id)
SELECT legacy_id, LOWER(CONCAT(SUBSTRING(MD5(CONCAT('tasknest:user:', legacy_id)),1,8),'-',SUBSTRING(MD5(CONCAT('tasknest:user:', legacy_id)),9,4),'-3',SUBSTRING(MD5(CONCAT('tasknest:user:', legacy_id)),14,3),'-',HEX((CONV(SUBSTRING(MD5(CONCAT('tasknest:user:', legacy_id)),17,1),16,10) & 3) | 8),SUBSTRING(MD5(CONCAT('tasknest:user:', legacy_id)),18,3),'-',SUBSTRING(MD5(CONCAT('tasknest:user:', legacy_id)),21,12)))
FROM (
  SELECT CAST(owner_user_id AS CHAR) AS legacy_id FROM projects WHERE owner_user_id IS NOT NULL
  UNION
  SELECT CAST(manager_user_id AS CHAR) AS legacy_id FROM projects WHERE manager_user_id IS NOT NULL
  UNION
  SELECT CAST(archived_by AS CHAR) AS legacy_id FROM projects WHERE archived_by IS NOT NULL
  UNION
  SELECT CAST(user_id AS CHAR) AS legacy_id FROM project_memberships WHERE user_id IS NOT NULL
  UNION
  SELECT CAST(added_by AS CHAR) AS legacy_id FROM project_memberships WHERE added_by IS NOT NULL
  UNION
  SELECT CAST(removed_by AS CHAR) AS legacy_id FROM project_memberships WHERE removed_by IS NOT NULL
  UNION
  SELECT CAST(created_by AS CHAR) AS legacy_id FROM project_invitation_links WHERE created_by IS NOT NULL
  UNION
  SELECT CAST(invitee_user_id AS CHAR) AS legacy_id FROM project_invitations WHERE invitee_user_id IS NOT NULL
  UNION
  SELECT CAST(invited_by AS CHAR) AS legacy_id FROM project_invitations WHERE invited_by IS NOT NULL
  UNION
  SELECT CAST(resolved_by AS CHAR) AS legacy_id FROM project_invitations WHERE resolved_by IS NOT NULL
  UNION
  SELECT CAST(user_id AS CHAR) AS legacy_id FROM project_join_requests WHERE user_id IS NOT NULL
  UNION
  SELECT CAST(resolved_by AS CHAR) AS legacy_id FROM project_join_requests WHERE resolved_by IS NOT NULL
  UNION
  SELECT CAST(assignee_user_id AS CHAR) AS legacy_id FROM tasks WHERE assignee_user_id IS NOT NULL
  UNION
  SELECT CAST(created_by AS CHAR) AS legacy_id FROM tasks WHERE created_by IS NOT NULL
  UNION
  SELECT CAST(submitted_by AS CHAR) AS legacy_id FROM task_submissions WHERE submitted_by IS NOT NULL
  UNION
  SELECT CAST(assignee_user_id AS CHAR) AS legacy_id FROM task_submissions WHERE assignee_user_id IS NOT NULL
  UNION
  SELECT CAST(reviewed_by AS CHAR) AS legacy_id FROM task_submissions WHERE reviewed_by IS NOT NULL
  UNION
  SELECT CAST(user_id AS CHAR) AS legacy_id FROM time_entry_locks WHERE user_id IS NOT NULL
  UNION
  SELECT CAST(user_id AS CHAR) AS legacy_id FROM time_entries WHERE user_id IS NOT NULL
  UNION
  SELECT CAST(created_by AS CHAR) AS legacy_id FROM time_entries WHERE created_by IS NOT NULL
  UNION
  SELECT CAST(updated_by AS CHAR) AS legacy_id FROM time_entries WHERE updated_by IS NOT NULL
  UNION
  SELECT CAST(revised_by AS CHAR) AS legacy_id FROM time_entry_revisions WHERE revised_by IS NOT NULL
  UNION
  SELECT CAST(author_user_id AS CHAR) AS legacy_id FROM task_comments WHERE author_user_id IS NOT NULL
  UNION
  SELECT CAST(actor_user_id AS CHAR) AS legacy_id FROM activity_logs WHERE actor_user_id IS NOT NULL
) legacy;

ALTER TABLE project_memberships DROP FOREIGN KEY fk_member_project;

ALTER TABLE project_invitation_links DROP FOREIGN KEY fk_join_link_project;

ALTER TABLE project_invitations DROP FOREIGN KEY fk_invitation_project;

ALTER TABLE project_join_requests DROP FOREIGN KEY fk_join_request_link;

ALTER TABLE tasks DROP FOREIGN KEY fk_task_project;

ALTER TABLE tasks DROP FOREIGN KEY fk_task_assignee;

ALTER TABLE tasks DROP FOREIGN KEY fk_task_creator;

ALTER TABLE task_submissions DROP FOREIGN KEY fk_submission_task;

ALTER TABLE time_entries DROP FOREIGN KEY fk_time_task;

ALTER TABLE time_entries DROP FOREIGN KEY fk_time_member;

ALTER TABLE time_entry_revisions DROP FOREIGN KEY fk_time_revision;

ALTER TABLE task_comments DROP FOREIGN KEY fk_comment_task;

ALTER TABLE task_comments DROP FOREIGN KEY fk_comment_author;

ALTER TABLE activity_logs DROP FOREIGN KEY fk_activity_project;

ALTER TABLE activity_logs DROP FOREIGN KEY fk_activity_task;

ALTER TABLE task_alerts DROP FOREIGN KEY fk_alert_task;

ALTER TABLE task_alerts DROP FOREIGN KEY fk_alert_submission;

ALTER TABLE tasks DROP FOREIGN KEY fk_task_latest_submission;

ALTER TABLE tasks DROP FOREIGN KEY fk_task_accepted_submission;

ALTER TABLE projects DROP CHECK ck_project_manager;

ALTER TABLE projects DROP CHECK ck_project_archive;

ALTER TABLE project_memberships DROP CHECK ck_member_removed;

ALTER TABLE task_submissions DROP CHECK ck_submission_review;

ALTER TABLE time_entries DROP CHECK ck_time_manual;

ALTER TABLE project_invitations DROP INDEX uq_invitation_pending;

ALTER TABLE project_join_requests DROP INDEX uq_join_request_pending;

ALTER TABLE time_entries DROP INDEX uq_time_running_user;

ALTER TABLE project_join_requests DROP COLUMN pending_user_id;

ALTER TABLE time_entries DROP COLUMN running_user_id;

ALTER TABLE project_invitations DROP COLUMN pending_invitee_id;

ALTER TABLE projects
  MODIFY COLUMN owner_user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  MODIFY COLUMN manager_user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  MODIFY COLUMN archived_by CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL;

ALTER TABLE project_memberships
  MODIFY COLUMN user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  MODIFY COLUMN added_by CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  MODIFY COLUMN removed_by CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL;

ALTER TABLE project_invitation_links
  MODIFY COLUMN created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL;

ALTER TABLE project_invitations
  MODIFY COLUMN invitee_user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  MODIFY COLUMN invited_by CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  MODIFY COLUMN resolved_by CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL;

ALTER TABLE project_join_requests
  MODIFY COLUMN user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  MODIFY COLUMN resolved_by CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL;

ALTER TABLE tasks
  MODIFY COLUMN assignee_user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  MODIFY COLUMN created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL;

ALTER TABLE task_submissions
  MODIFY COLUMN submitted_by CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  MODIFY COLUMN assignee_user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  MODIFY COLUMN reviewed_by CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL;

ALTER TABLE time_entry_locks
  MODIFY COLUMN user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL;

ALTER TABLE time_entries
  MODIFY COLUMN user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  MODIFY COLUMN created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  MODIFY COLUMN updated_by CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL;

ALTER TABLE time_entry_revisions
  MODIFY COLUMN revised_by CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL;

ALTER TABLE task_comments
  MODIFY COLUMN author_user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL;

ALTER TABLE activity_logs
  MODIFY COLUMN actor_user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL;

UPDATE projects t JOIN uuid_user_id_map m ON t.owner_user_id=m.legacy_id SET t.owner_user_id=m.uuid_id;

UPDATE projects t JOIN uuid_user_id_map m ON t.manager_user_id=m.legacy_id SET t.manager_user_id=m.uuid_id;

UPDATE projects t JOIN uuid_user_id_map m ON t.archived_by=m.legacy_id SET t.archived_by=m.uuid_id;

UPDATE project_memberships t JOIN uuid_user_id_map m ON t.user_id=m.legacy_id SET t.user_id=m.uuid_id;

UPDATE project_memberships t JOIN uuid_user_id_map m ON t.added_by=m.legacy_id SET t.added_by=m.uuid_id;

UPDATE project_memberships t JOIN uuid_user_id_map m ON t.removed_by=m.legacy_id SET t.removed_by=m.uuid_id;

UPDATE project_invitation_links t JOIN uuid_user_id_map m ON t.created_by=m.legacy_id SET t.created_by=m.uuid_id;

UPDATE project_invitations t JOIN uuid_user_id_map m ON t.invitee_user_id=m.legacy_id SET t.invitee_user_id=m.uuid_id;

UPDATE project_invitations t JOIN uuid_user_id_map m ON t.invited_by=m.legacy_id SET t.invited_by=m.uuid_id;

UPDATE project_invitations t JOIN uuid_user_id_map m ON t.resolved_by=m.legacy_id SET t.resolved_by=m.uuid_id;

UPDATE project_join_requests t JOIN uuid_user_id_map m ON t.user_id=m.legacy_id SET t.user_id=m.uuid_id;

UPDATE project_join_requests t JOIN uuid_user_id_map m ON t.resolved_by=m.legacy_id SET t.resolved_by=m.uuid_id;

UPDATE tasks t JOIN uuid_user_id_map m ON t.assignee_user_id=m.legacy_id SET t.assignee_user_id=m.uuid_id;

UPDATE tasks t JOIN uuid_user_id_map m ON t.created_by=m.legacy_id SET t.created_by=m.uuid_id;

UPDATE task_submissions t JOIN uuid_user_id_map m ON t.submitted_by=m.legacy_id SET t.submitted_by=m.uuid_id;

UPDATE task_submissions t JOIN uuid_user_id_map m ON t.assignee_user_id=m.legacy_id SET t.assignee_user_id=m.uuid_id;

UPDATE task_submissions t JOIN uuid_user_id_map m ON t.reviewed_by=m.legacy_id SET t.reviewed_by=m.uuid_id;

UPDATE time_entry_locks t JOIN uuid_user_id_map m ON t.user_id=m.legacy_id SET t.user_id=m.uuid_id;

UPDATE time_entries t JOIN uuid_user_id_map m ON t.user_id=m.legacy_id SET t.user_id=m.uuid_id;

UPDATE time_entries t JOIN uuid_user_id_map m ON t.created_by=m.legacy_id SET t.created_by=m.uuid_id;

UPDATE time_entries t JOIN uuid_user_id_map m ON t.updated_by=m.legacy_id SET t.updated_by=m.uuid_id;

UPDATE time_entry_revisions t JOIN uuid_user_id_map m ON t.revised_by=m.legacy_id SET t.revised_by=m.uuid_id;

UPDATE task_comments t JOIN uuid_user_id_map m ON t.author_user_id=m.legacy_id SET t.author_user_id=m.uuid_id;

UPDATE activity_logs t JOIN uuid_user_id_map m ON t.actor_user_id=m.legacy_id SET t.actor_user_id=m.uuid_id;

ALTER TABLE project_join_requests ADD COLUMN pending_user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin GENERATED ALWAYS AS (CASE WHEN status = 'PENDING' THEN user_id ELSE NULL END) STORED;

ALTER TABLE time_entries ADD COLUMN running_user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin GENERATED ALWAYS AS (CASE WHEN ended_at IS NULL THEN user_id ELSE NULL END) STORED;

ALTER TABLE project_invitations ADD COLUMN pending_invitee_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin GENERATED ALWAYS AS (CASE WHEN status = 'PENDING' THEN invitee_user_id ELSE NULL END) STORED;

ALTER TABLE project_invitations ADD UNIQUE KEY uq_invitation_pending (project_id, pending_invitee_id);

ALTER TABLE project_join_requests ADD UNIQUE KEY uq_join_request_pending (project_id, pending_user_id);

ALTER TABLE time_entries ADD UNIQUE KEY uq_time_running_user (running_user_id);

ALTER TABLE projects ADD CONSTRAINT ck_project_manager CHECK (manager_user_id IS NULL OR manager_user_id <> owner_user_id);

ALTER TABLE projects ADD CONSTRAINT ck_project_archive CHECK ((status = 'ARCHIVED') = (archived_at IS NOT NULL) AND (archived_at IS NULL) = (archived_by IS NULL));

ALTER TABLE project_memberships ADD CONSTRAINT ck_member_removed CHECK ((status = 'REMOVED') = (removed_at IS NOT NULL) AND (removed_at IS NULL) = (removed_by IS NULL));

ALTER TABLE task_submissions ADD CONSTRAINT ck_submission_review CHECK ((decision = 'PENDING') = (reviewed_at IS NULL) AND (reviewed_at IS NULL) = (reviewed_by IS NULL) AND (reviewed_at IS NULL OR reviewed_at >= submitted_at));

ALTER TABLE time_entries ADD CONSTRAINT ck_time_manual CHECK (source <> 'MANUAL' OR (ended_at IS NOT NULL AND created_by = user_id AND manual_reason IS NOT NULL AND CHAR_LENGTH(TRIM(manual_reason)) > 0));

ALTER TABLE project_memberships ADD CONSTRAINT fk_member_project FOREIGN KEY (project_id) REFERENCES projects(id);

ALTER TABLE project_invitation_links ADD CONSTRAINT fk_join_link_project FOREIGN KEY (project_id) REFERENCES projects(id);

ALTER TABLE project_invitations ADD CONSTRAINT fk_invitation_project FOREIGN KEY (project_id) REFERENCES projects(id);

ALTER TABLE project_join_requests ADD CONSTRAINT fk_join_request_link FOREIGN KEY (project_id, invitation_link_id) REFERENCES project_invitation_links(project_id, id);

ALTER TABLE tasks ADD CONSTRAINT fk_task_project FOREIGN KEY (project_id) REFERENCES projects(id);

ALTER TABLE tasks ADD CONSTRAINT fk_task_assignee FOREIGN KEY (project_id, assignee_user_id) REFERENCES project_memberships(project_id, user_id);

ALTER TABLE tasks ADD CONSTRAINT fk_task_creator FOREIGN KEY (project_id, created_by) REFERENCES project_memberships(project_id, user_id);

ALTER TABLE task_submissions ADD CONSTRAINT fk_submission_task FOREIGN KEY (project_id, task_id) REFERENCES tasks(project_id, id);

ALTER TABLE time_entries ADD CONSTRAINT fk_time_task FOREIGN KEY (project_id, task_id) REFERENCES tasks(project_id, id);

ALTER TABLE time_entries ADD CONSTRAINT fk_time_member FOREIGN KEY (project_id, user_id) REFERENCES project_memberships(project_id, user_id);

ALTER TABLE time_entry_revisions ADD CONSTRAINT fk_time_revision FOREIGN KEY (time_entry_id) REFERENCES time_entries(id);

ALTER TABLE task_comments ADD CONSTRAINT fk_comment_task FOREIGN KEY (project_id, task_id) REFERENCES tasks(project_id, id);

ALTER TABLE task_comments ADD CONSTRAINT fk_comment_author FOREIGN KEY (project_id, author_user_id) REFERENCES project_memberships(project_id, user_id);

ALTER TABLE activity_logs ADD CONSTRAINT fk_activity_project FOREIGN KEY (project_id) REFERENCES projects(id);

ALTER TABLE activity_logs ADD CONSTRAINT fk_activity_task FOREIGN KEY (project_id, task_id) REFERENCES tasks(project_id, id);

ALTER TABLE task_alerts ADD CONSTRAINT fk_alert_task FOREIGN KEY (project_id, task_id) REFERENCES tasks(project_id, id);

ALTER TABLE task_alerts ADD CONSTRAINT fk_alert_submission FOREIGN KEY (task_id, submission_id) REFERENCES task_submissions(task_id, id);

ALTER TABLE tasks ADD CONSTRAINT fk_task_latest_submission FOREIGN KEY (id, latest_submission_id) REFERENCES task_submissions(task_id, id);

ALTER TABLE tasks ADD CONSTRAINT fk_task_accepted_submission FOREIGN KEY (id, accepted_submission_id) REFERENCES task_submissions(task_id, id);

UPDATE outbox_events e JOIN uuid_user_id_map m ON JSON_UNQUOTE(JSON_EXTRACT(e.payload,'$.userId'))=m.legacy_id SET e.payload=JSON_SET(e.payload,'$.userId',m.uuid_id);

UPDATE outbox_events e JOIN uuid_user_id_map m ON JSON_UNQUOTE(JSON_EXTRACT(e.payload,'$.ownerUserId'))=m.legacy_id SET e.payload=JSON_SET(e.payload,'$.ownerUserId',m.uuid_id);

UPDATE outbox_events e JOIN uuid_user_id_map m ON JSON_UNQUOTE(JSON_EXTRACT(e.payload,'$.managerUserId'))=m.legacy_id SET e.payload=JSON_SET(e.payload,'$.managerUserId',m.uuid_id);

UPDATE outbox_events e JOIN uuid_user_id_map m ON JSON_UNQUOTE(JSON_EXTRACT(e.payload,'$.assigneeUserId'))=m.legacy_id SET e.payload=JSON_SET(e.payload,'$.assigneeUserId',m.uuid_id);

UPDATE outbox_events e JOIN uuid_user_id_map m ON JSON_UNQUOTE(JSON_EXTRACT(e.payload,'$.recipientUserId'))=m.legacy_id SET e.payload=JSON_SET(e.payload,'$.recipientUserId',m.uuid_id);

UPDATE outbox_events e JOIN uuid_user_id_map m ON JSON_UNQUOTE(JSON_EXTRACT(e.payload,'$.actorUserId'))=m.legacy_id SET e.payload=JSON_SET(e.payload,'$.actorUserId',m.uuid_id);

DROP TEMPORARY TABLE uuid_user_id_map;

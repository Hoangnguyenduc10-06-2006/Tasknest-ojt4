-- Direct account ID migration: BIGINT -> UUID strings, no public_id column.

-- Stop ALL application writers/consumers and back up all three databases before upgrade.

-- MySQL DDL auto-commits: restore the backup if a migration fails; do not blindly repair Flyway.

-- Existing accounts use deterministic name-based UUIDs; new accounts use random UUID v4.

CREATE TEMPORARY TABLE uuid_user_id_map (legacy_id VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY, uuid_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE);

INSERT INTO uuid_user_id_map(legacy_id, uuid_id)
SELECT legacy_id, LOWER(CONCAT(SUBSTRING(MD5(CONCAT('tasknest:user:', legacy_id)),1,8),'-',SUBSTRING(MD5(CONCAT('tasknest:user:', legacy_id)),9,4),'-3',SUBSTRING(MD5(CONCAT('tasknest:user:', legacy_id)),14,3),'-',HEX((CONV(SUBSTRING(MD5(CONCAT('tasknest:user:', legacy_id)),17,1),16,10) & 3) | 8),SUBSTRING(MD5(CONCAT('tasknest:user:', legacy_id)),18,3),'-',SUBSTRING(MD5(CONCAT('tasknest:user:', legacy_id)),21,12)))
FROM (
  SELECT CAST(user_id AS CHAR) AS legacy_id FROM recipient_contacts WHERE user_id IS NOT NULL
  UNION
  SELECT CAST(recipient_user_id AS CHAR) AS legacy_id FROM notifications WHERE recipient_user_id IS NOT NULL
  UNION
  SELECT CAST(actor_user_id AS CHAR) AS legacy_id FROM notifications WHERE actor_user_id IS NOT NULL
  UNION
  SELECT CAST(recipient_user_id AS CHAR) AS legacy_id FROM email_jobs WHERE recipient_user_id IS NOT NULL
) legacy;

ALTER TABLE email_jobs DROP FOREIGN KEY fk_email_notification;

ALTER TABLE email_delivery_attempts DROP FOREIGN KEY fk_email_attempt_job;

ALTER TABLE email_provider_events DROP FOREIGN KEY fk_provider_event_job;

ALTER TABLE recipient_contacts
  MODIFY COLUMN user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL;

ALTER TABLE notifications
  MODIFY COLUMN recipient_user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  MODIFY COLUMN actor_user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL;

ALTER TABLE email_jobs
  MODIFY COLUMN recipient_user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL;

UPDATE recipient_contacts t JOIN uuid_user_id_map m ON t.user_id=m.legacy_id SET t.user_id=m.uuid_id;

UPDATE notifications t JOIN uuid_user_id_map m ON t.recipient_user_id=m.legacy_id SET t.recipient_user_id=m.uuid_id;

UPDATE notifications t JOIN uuid_user_id_map m ON t.actor_user_id=m.legacy_id SET t.actor_user_id=m.uuid_id;

UPDATE email_jobs t JOIN uuid_user_id_map m ON t.recipient_user_id=m.legacy_id SET t.recipient_user_id=m.uuid_id;

ALTER TABLE email_jobs ADD CONSTRAINT fk_email_notification FOREIGN KEY (notification_id, recipient_user_id, event_id) REFERENCES notifications(id, recipient_user_id, event_id);

ALTER TABLE email_delivery_attempts ADD CONSTRAINT fk_email_attempt_job FOREIGN KEY (email_job_id) REFERENCES email_jobs(id);

ALTER TABLE email_provider_events ADD CONSTRAINT fk_provider_event_job FOREIGN KEY (email_job_id) REFERENCES email_jobs(id);

UPDATE outbox_events e JOIN uuid_user_id_map m ON JSON_UNQUOTE(JSON_EXTRACT(e.payload,'$.userId'))=m.legacy_id SET e.payload=JSON_SET(e.payload,'$.userId',m.uuid_id);

UPDATE outbox_events e JOIN uuid_user_id_map m ON JSON_UNQUOTE(JSON_EXTRACT(e.payload,'$.ownerUserId'))=m.legacy_id SET e.payload=JSON_SET(e.payload,'$.ownerUserId',m.uuid_id);

UPDATE outbox_events e JOIN uuid_user_id_map m ON JSON_UNQUOTE(JSON_EXTRACT(e.payload,'$.managerUserId'))=m.legacy_id SET e.payload=JSON_SET(e.payload,'$.managerUserId',m.uuid_id);

UPDATE outbox_events e JOIN uuid_user_id_map m ON JSON_UNQUOTE(JSON_EXTRACT(e.payload,'$.assigneeUserId'))=m.legacy_id SET e.payload=JSON_SET(e.payload,'$.assigneeUserId',m.uuid_id);

UPDATE outbox_events e JOIN uuid_user_id_map m ON JSON_UNQUOTE(JSON_EXTRACT(e.payload,'$.recipientUserId'))=m.legacy_id SET e.payload=JSON_SET(e.payload,'$.recipientUserId',m.uuid_id);

UPDATE outbox_events e JOIN uuid_user_id_map m ON JSON_UNQUOTE(JSON_EXTRACT(e.payload,'$.actorUserId'))=m.legacy_id SET e.payload=JSON_SET(e.payload,'$.actorUserId',m.uuid_id);

DROP TEMPORARY TABLE uuid_user_id_map;

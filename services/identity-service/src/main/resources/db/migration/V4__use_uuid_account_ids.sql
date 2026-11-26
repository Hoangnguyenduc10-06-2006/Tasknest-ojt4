-- Direct account ID migration: BIGINT -> UUID strings, no public_id column.

-- Stop ALL application writers/consumers and back up all three databases before upgrade.

-- MySQL DDL auto-commits: restore the backup if a migration fails; do not blindly repair Flyway.

-- Existing accounts use deterministic name-based UUIDs; new accounts use random UUID v4.

CREATE TEMPORARY TABLE uuid_user_id_map (legacy_id VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY, uuid_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE);

INSERT INTO uuid_user_id_map(legacy_id, uuid_id)
SELECT legacy_id, LOWER(CONCAT(SUBSTRING(MD5(CONCAT('tasknest:user:', legacy_id)),1,8),'-',SUBSTRING(MD5(CONCAT('tasknest:user:', legacy_id)),9,4),'-3',SUBSTRING(MD5(CONCAT('tasknest:user:', legacy_id)),14,3),'-',HEX((CONV(SUBSTRING(MD5(CONCAT('tasknest:user:', legacy_id)),17,1),16,10) & 3) | 8),SUBSTRING(MD5(CONCAT('tasknest:user:', legacy_id)),18,3),'-',SUBSTRING(MD5(CONCAT('tasknest:user:', legacy_id)),21,12)))
FROM (
  SELECT CAST(id AS CHAR) AS legacy_id FROM users WHERE id IS NOT NULL
  UNION
  SELECT CAST(user_id AS CHAR) AS legacy_id FROM auth_sessions WHERE user_id IS NOT NULL
  UNION
  SELECT CAST(user_id AS CHAR) AS legacy_id FROM account_tokens WHERE user_id IS NOT NULL
) legacy;

ALTER TABLE auth_sessions DROP FOREIGN KEY fk_session_user;

ALTER TABLE refresh_tokens DROP FOREIGN KEY fk_refresh_session;

ALTER TABLE refresh_tokens DROP FOREIGN KEY fk_refresh_replacement;

ALTER TABLE account_tokens DROP FOREIGN KEY fk_account_token_user;

ALTER TABLE account_tokens DROP INDEX uq_account_token_current;

ALTER TABLE account_tokens DROP COLUMN active_user_id;

ALTER TABLE users
  MODIFY COLUMN id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL;

ALTER TABLE auth_sessions
  MODIFY COLUMN user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL;

ALTER TABLE account_tokens
  MODIFY COLUMN user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL;

UPDATE users t JOIN uuid_user_id_map m ON t.id=m.legacy_id SET t.id=m.uuid_id;

UPDATE auth_sessions t JOIN uuid_user_id_map m ON t.user_id=m.legacy_id SET t.user_id=m.uuid_id;

UPDATE account_tokens t JOIN uuid_user_id_map m ON t.user_id=m.legacy_id SET t.user_id=m.uuid_id;

ALTER TABLE account_tokens ADD COLUMN active_user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin GENERATED ALWAYS AS (CASE WHEN used_at IS NULL AND revoked_at IS NULL THEN user_id ELSE NULL END) STORED;

ALTER TABLE account_tokens ADD UNIQUE KEY uq_account_token_current (purpose, active_user_id);

ALTER TABLE auth_sessions ADD CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES users(id);

ALTER TABLE refresh_tokens ADD CONSTRAINT fk_refresh_session FOREIGN KEY (session_id) REFERENCES auth_sessions(id);

ALTER TABLE refresh_tokens ADD CONSTRAINT fk_refresh_replacement FOREIGN KEY (session_id, replaced_by_id) REFERENCES refresh_tokens(session_id, id);

ALTER TABLE account_tokens ADD CONSTRAINT fk_account_token_user FOREIGN KEY (user_id) REFERENCES users(id);

UPDATE auth_sessions SET revoked_at=GREATEST(UTC_TIMESTAMP(6),created_at), revocation_reason='USER_ID_MIGRATION' WHERE revoked_at IS NULL;

UPDATE refresh_tokens SET revoked_at=GREATEST(UTC_TIMESTAMP(6),created_at) WHERE revoked_at IS NULL;

UPDATE outbox_events e JOIN uuid_user_id_map m ON e.aggregate_id=m.legacy_id SET e.aggregate_id=m.uuid_id WHERE e.aggregate_type='User';

UPDATE outbox_events e JOIN uuid_user_id_map m ON JSON_UNQUOTE(JSON_EXTRACT(e.payload,'$.userId'))=m.legacy_id SET e.payload=JSON_SET(e.payload,'$.userId',m.uuid_id);

UPDATE outbox_events e JOIN uuid_user_id_map m ON JSON_UNQUOTE(JSON_EXTRACT(e.payload,'$.ownerUserId'))=m.legacy_id SET e.payload=JSON_SET(e.payload,'$.ownerUserId',m.uuid_id);

UPDATE outbox_events e JOIN uuid_user_id_map m ON JSON_UNQUOTE(JSON_EXTRACT(e.payload,'$.managerUserId'))=m.legacy_id SET e.payload=JSON_SET(e.payload,'$.managerUserId',m.uuid_id);

UPDATE outbox_events e JOIN uuid_user_id_map m ON JSON_UNQUOTE(JSON_EXTRACT(e.payload,'$.assigneeUserId'))=m.legacy_id SET e.payload=JSON_SET(e.payload,'$.assigneeUserId',m.uuid_id);

UPDATE outbox_events e JOIN uuid_user_id_map m ON JSON_UNQUOTE(JSON_EXTRACT(e.payload,'$.recipientUserId'))=m.legacy_id SET e.payload=JSON_SET(e.payload,'$.recipientUserId',m.uuid_id);

UPDATE outbox_events e JOIN uuid_user_id_map m ON JSON_UNQUOTE(JSON_EXTRACT(e.payload,'$.actorUserId'))=m.legacy_id SET e.payload=JSON_SET(e.payload,'$.actorUserId',m.uuid_id);

UPDATE outbox_events SET schema_version=2 WHERE event_type='identity.email-verification.requested';

DROP TEMPORARY TABLE uuid_user_id_map;

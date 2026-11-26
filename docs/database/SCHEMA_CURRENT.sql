-- TaskNest current physical schema; generated from all Flyway migrations.
-- REFERENCE ONLY: use service Flyway migrations to deploy; do not import this snapshot.
-- No application records, credentials, or Flyway history are exported.

-- identity: V1, V2, V3, V4, V5
USE `tasknest_identity`;

CREATE TABLE `account_tokens` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `purpose` varchar(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `token_hash` binary(32) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `expires_at` datetime(6) NOT NULL,
  `used_at` datetime(6) DEFAULT NULL,
  `revoked_at` datetime(6) DEFAULT NULL,
  `issue_source` varchar(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'OTHER',
  `active_user_id` char(36) CHARACTER SET ascii COLLATE ascii_bin GENERATED ALWAYS AS ((case when ((`used_at` is null) and (`revoked_at` is null)) then `user_id` else NULL end)) STORED,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_account_token_hash` (`token_hash`),
  UNIQUE KEY `uq_account_token_current` (`purpose`,`active_user_id`),
  KEY `ix_account_token_expiry` (`expires_at`),
  KEY `ix_account_token_resends` (`user_id`,`purpose`,`issue_source`,`created_at`),
  CONSTRAINT `fk_account_token_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `ck_account_token_expiry` CHECK (((`expires_at` > `created_at`) and ((`purpose` <> _ascii'EMAIL_VERIFICATION') or (`expires_at` <= (`created_at` + interval 24 hour))))),
  CONSTRAINT `ck_account_token_issue_source` CHECK ((`issue_source` in (_ascii'REGISTER',_ascii'RESEND',_ascii'OTHER'))),
  CONSTRAINT `ck_account_token_purpose` CHECK ((`purpose` in (_ascii'EMAIL_VERIFICATION',_ascii'PASSWORD_RESET')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `auth_rate_limit_buckets` (
  `action` varchar(50) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `scope` varchar(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `subject_hash` binary(32) NOT NULL,
  `window_start` datetime(6) NOT NULL,
  `window_end` datetime(6) NOT NULL,
  `request_count` int NOT NULL DEFAULT '1',
  PRIMARY KEY (`action`,`scope`,`subject_hash`,`window_start`),
  KEY `ix_rate_expiry` (`window_end`),
  CONSTRAINT `ck_rate_window` CHECK (((`window_end` > `window_start`) and (`request_count` >= 0)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `auth_sessions` (
  `id` char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `user_id` char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `device_label` varchar(255) COLLATE utf8mb4_0900_as_ci DEFAULT NULL,
  `user_agent` text COLLATE utf8mb4_0900_as_ci,
  `created_at` datetime(6) NOT NULL,
  `expires_at` datetime(6) NOT NULL,
  `last_seen_at` datetime(6) NOT NULL,
  `revoked_at` datetime(6) DEFAULT NULL,
  `revocation_reason` varchar(100) COLLATE utf8mb4_0900_as_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_sessions_user` (`user_id`,`revoked_at`,`expires_at`),
  KEY `ix_sessions_expiry` (`expires_at`),
  CONSTRAINT `fk_session_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `ck_session_expiry` CHECK (((`expires_at` > `created_at`) and (`expires_at` <= (`created_at` + interval 7 day)))),
  CONSTRAINT `ck_session_revocation` CHECK (((`revoked_at` is null) = (`revocation_reason` is null)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `outbox_events` (
  `event_id` char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `aggregate_type` varchar(80) COLLATE utf8mb4_0900_as_ci NOT NULL,
  `aggregate_id` varchar(64) COLLATE utf8mb4_0900_as_ci NOT NULL,
  `aggregate_version` bigint NOT NULL,
  `event_type` varchar(120) COLLATE utf8mb4_0900_as_ci NOT NULL,
  `schema_version` int NOT NULL DEFAULT '1',
  `occurred_at` datetime(6) NOT NULL,
  `payload` json NOT NULL,
  `sensitive_payload` mediumblob,
  `encryption_key_id` varchar(100) COLLATE utf8mb4_0900_as_ci DEFAULT NULL,
  `correlation_id` char(36) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `status` varchar(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'PENDING',
  `available_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `attempts` int NOT NULL DEFAULT '0',
  `locked_by` varchar(100) COLLATE utf8mb4_0900_as_ci DEFAULT NULL,
  `locked_until` datetime(6) DEFAULT NULL,
  `published_at` datetime(6) DEFAULT NULL,
  `last_error_safe` varchar(500) COLLATE utf8mb4_0900_as_ci DEFAULT NULL,
  PRIMARY KEY (`event_id`),
  KEY `ix_outbox_dispatch` (`status`,`available_at`,`occurred_at`),
  KEY `ix_outbox_lease` (`status`,`locked_until`),
  CONSTRAINT `ck_outbox_encryption` CHECK (((`sensitive_payload` is null) = (`encryption_key_id` is null))),
  CONSTRAINT `ck_outbox_lease` CHECK (((`locked_by` is null) = (`locked_until` is null))),
  CONSTRAINT `ck_outbox_numbers` CHECK (((`aggregate_version` >= 0) and (`schema_version` > 0) and (`attempts` >= 0))),
  CONSTRAINT `ck_outbox_status` CHECK ((`status` in (_utf8mb4'PENDING',_utf8mb4'PROCESSING',_utf8mb4'PUBLISHED',_utf8mb4'DEAD')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `processed_events` (
  `consumer_name` varchar(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `event_id` char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `event_type` varchar(120) COLLATE utf8mb4_0900_as_ci NOT NULL,
  `processed_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`consumer_name`,`event_id`),
  KEY `ix_processed_retention` (`processed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `refresh_tokens` (
  `id` char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `session_id` char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `token_hash` binary(32) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `consumed_at` datetime(6) DEFAULT NULL,
  `revoked_at` datetime(6) DEFAULT NULL,
  `replaced_by_id` char(36) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `active_session_id` char(36) CHARACTER SET ascii COLLATE ascii_bin GENERATED ALWAYS AS ((case when ((`consumed_at` is null) and (`revoked_at` is null)) then `session_id` else NULL end)) STORED,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_refresh_hash` (`token_hash`),
  UNIQUE KEY `uq_refresh_session_id` (`session_id`,`id`),
  UNIQUE KEY `uq_refresh_current` (`active_session_id`),
  KEY `fk_refresh_replacement` (`session_id`,`replaced_by_id`),
  CONSTRAINT `fk_refresh_replacement` FOREIGN KEY (`session_id`, `replaced_by_id`) REFERENCES `refresh_tokens` (`session_id`, `id`),
  CONSTRAINT `fk_refresh_session` FOREIGN KEY (`session_id`) REFERENCES `auth_sessions` (`id`),
  CONSTRAINT `ck_refresh_replacement` CHECK (((`replaced_by_id` is null) or ((`consumed_at` is not null) and (`replaced_by_id` <> `id`)))),
  CONSTRAINT `ck_refresh_time` CHECK ((((`consumed_at` is null) or (`consumed_at` >= `created_at`)) and ((`revoked_at` is null) or (`revoked_at` >= `created_at`))))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `service_metadata` (
  `service_name` varchar(64) NOT NULL,
  `initialized_at` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`service_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `user_avatars` (
  `user_id` char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `image_data` mediumblob NOT NULL,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_avatar_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ck_avatar_size` CHECK ((length(`image_data`) between 1 and 5242880))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `users` (
  `id` char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `full_name` varchar(100) COLLATE utf8mb4_0900_as_ci NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_0900_as_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_0900_as_ci NOT NULL,
  `is_email_verified` tinyint(1) NOT NULL DEFAULT '0',
  `email_verified_at` datetime(6) DEFAULT NULL,
  `avatar_storage_key` varchar(500) COLLATE utf8mb4_0900_as_ci DEFAULT NULL,
  `avatar_mime_type` varchar(100) COLLATE utf8mb4_0900_as_ci DEFAULT NULL,
  `avatar_size_bytes` bigint DEFAULT NULL,
  `version` bigint NOT NULL DEFAULT '0',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `job_title` varchar(100) COLLATE utf8mb4_0900_as_ci NOT NULL DEFAULT '',
  `bio` varchar(500) COLLATE utf8mb4_0900_as_ci NOT NULL DEFAULT '',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`),
  CONSTRAINT `ck_user_avatar` CHECK (((`avatar_size_bytes` is null) or (`avatar_size_bytes` > 0))),
  CONSTRAINT `ck_user_email` CHECK (((cast(`email` as char charset binary) = cast(lower(trim(`email`)) as char charset binary)) and (char_length(`email`) > 3))),
  CONSTRAINT `ck_user_name` CHECK ((char_length(trim(`full_name`)) between 2 and 100)),
  CONSTRAINT `ck_user_verified` CHECK (((`is_email_verified` in (0,1)) and ((`is_email_verified` = 1) = (`email_verified_at` is not null)))),
  CONSTRAINT `ck_user_version` CHECK ((`version` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

-- work: V1, V2, V3, V4
USE `tasknest_work`;

CREATE TABLE `activity_logs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `project_id` bigint NOT NULL,
  `task_id` bigint DEFAULT NULL,
  `actor_user_id` char(36) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `action` varchar(100) COLLATE utf8mb4_0900_as_ci NOT NULL,
  `entity_type` varchar(60) COLLATE utf8mb4_0900_as_ci NOT NULL,
  `entity_id` varchar(64) COLLATE utf8mb4_0900_as_ci NOT NULL,
  `entity_version` bigint DEFAULT NULL,
  `before_data` json DEFAULT NULL,
  `after_data` json DEFAULT NULL,
  `reason` text COLLATE utf8mb4_0900_as_ci,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `ix_activity_project` (`project_id`,`created_at`,`id`),
  KEY `ix_activity_task` (`task_id`,`created_at`,`id`),
  KEY `fk_activity_task` (`project_id`,`task_id`),
  CONSTRAINT `fk_activity_project` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `fk_activity_task` FOREIGN KEY (`project_id`, `task_id`) REFERENCES `tasks` (`project_id`, `id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `comment_attachments` (
  `project_id` bigint NOT NULL,
  `task_id` bigint NOT NULL,
  `comment_id` bigint NOT NULL,
  `slot_no` tinyint NOT NULL,
  `stored_file_id` bigint NOT NULL,
  `file_kind` varchar(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'COMMENT_IMAGE',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`comment_id`,`slot_no`),
  UNIQUE KEY `uq_comment_attachment_file` (`stored_file_id`),
  KEY `fk_attachment_comment` (`project_id`,`task_id`,`comment_id`),
  KEY `fk_attachment_file` (`project_id`,`stored_file_id`,`file_kind`),
  CONSTRAINT `fk_attachment_comment` FOREIGN KEY (`project_id`, `task_id`, `comment_id`) REFERENCES `task_comments` (`project_id`, `task_id`, `id`),
  CONSTRAINT `fk_attachment_file` FOREIGN KEY (`project_id`, `stored_file_id`, `file_kind`) REFERENCES `stored_files` (`project_id`, `id`, `file_kind`),
  CONSTRAINT `ck_attachment_kind` CHECK ((`file_kind` = _utf8mb4'COMMENT_IMAGE')),
  CONSTRAINT `ck_attachment_slot` CHECK ((`slot_no` between 1 and 5))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `comment_mentions` (
  `project_id` bigint NOT NULL,
  `task_id` bigint NOT NULL,
  `comment_id` bigint NOT NULL,
  `mentioned_user_id` char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `slot_no` tinyint NOT NULL,
  `active_slot` tinyint GENERATED ALWAYS AS ((case when (`removed_at` is null) then `slot_no` else NULL end)) STORED,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `removed_at` datetime(6) DEFAULT NULL,
  `first_notified_at` datetime(6) DEFAULT NULL,
  `first_notification_event_id` char(36) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  PRIMARY KEY (`comment_id`,`mentioned_user_id`),
  UNIQUE KEY `uq_mention_active_slot` (`comment_id`,`active_slot`),
  KEY `fk_mention_comment` (`project_id`,`task_id`,`comment_id`),
  KEY `fk_mention_member` (`project_id`,`mentioned_user_id`),
  KEY `ix_mention_user` (`mentioned_user_id`,`removed_at`,`created_at`),
  CONSTRAINT `fk_mention_comment` FOREIGN KEY (`project_id`, `task_id`, `comment_id`) REFERENCES `task_comments` (`project_id`, `task_id`, `id`),
  CONSTRAINT `fk_mention_member` FOREIGN KEY (`project_id`, `mentioned_user_id`) REFERENCES `project_memberships` (`project_id`, `user_id`),
  CONSTRAINT `ck_mention_notified` CHECK (((`first_notified_at` is null) = (`first_notification_event_id` is null))),
  CONSTRAINT `ck_mention_slot` CHECK ((`slot_no` between 1 and 10))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `outbox_events` (
  `event_id` char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `aggregate_type` varchar(80) COLLATE utf8mb4_0900_as_ci NOT NULL,
  `aggregate_id` varchar(64) COLLATE utf8mb4_0900_as_ci NOT NULL,
  `aggregate_version` bigint NOT NULL,
  `event_type` varchar(120) COLLATE utf8mb4_0900_as_ci NOT NULL,
  `schema_version` int NOT NULL DEFAULT '1',
  `occurred_at` datetime(6) NOT NULL,
  `payload` json NOT NULL,
  `sensitive_payload` mediumblob,
  `encryption_key_id` varchar(100) COLLATE utf8mb4_0900_as_ci DEFAULT NULL,
  `correlation_id` char(36) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `status` varchar(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'PENDING',
  `available_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `attempts` int NOT NULL DEFAULT '0',
  `locked_by` varchar(100) COLLATE utf8mb4_0900_as_ci DEFAULT NULL,
  `locked_until` datetime(6) DEFAULT NULL,
  `published_at` datetime(6) DEFAULT NULL,
  `last_error_safe` varchar(500) COLLATE utf8mb4_0900_as_ci DEFAULT NULL,
  PRIMARY KEY (`event_id`),
  KEY `ix_outbox_dispatch` (`status`,`available_at`,`occurred_at`),
  KEY `ix_outbox_lease` (`status`,`locked_until`),
  CONSTRAINT `ck_outbox_encryption` CHECK (((`sensitive_payload` is null) = (`encryption_key_id` is null))),
  CONSTRAINT `ck_outbox_lease` CHECK (((`locked_by` is null) = (`locked_until` is null))),
  CONSTRAINT `ck_outbox_numbers` CHECK (((`aggregate_version` >= 0) and (`schema_version` > 0) and (`attempts` >= 0))),
  CONSTRAINT `ck_outbox_status` CHECK ((`status` in (_utf8mb4'PENDING',_utf8mb4'PROCESSING',_utf8mb4'PUBLISHED',_utf8mb4'DEAD')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `processed_events` (
  `consumer_name` varchar(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `event_id` char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `event_type` varchar(120) COLLATE utf8mb4_0900_as_ci NOT NULL,
  `processed_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`consumer_name`,`event_id`),
  KEY `ix_processed_retention` (`processed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `project_invitation_links` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `project_id` bigint NOT NULL,
  `public_code` char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `status` varchar(10) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'ACTIVE',
  `created_by` char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `revoked_at` datetime(6) DEFAULT NULL,
  `revocation_reason` varchar(100) COLLATE utf8mb4_0900_as_ci DEFAULT NULL,
  `active_project_id` bigint GENERATED ALWAYS AS ((case when (`status` = _ascii'ACTIVE') then `project_id` else NULL end)) STORED,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_join_link_code` (`public_code`),
  UNIQUE KEY `uq_join_link_project` (`project_id`,`id`),
  UNIQUE KEY `uq_join_link_active` (`active_project_id`),
  CONSTRAINT `fk_join_link_project` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `ck_join_link_revocation` CHECK ((((`status` = _ascii'REVOKED') = (`revoked_at` is not null)) and ((`revoked_at` is null) = (`revocation_reason` is null)))),
  CONSTRAINT `ck_join_link_status` CHECK ((`status` in (_ascii'ACTIVE',_ascii'REVOKED')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `project_invitations` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `project_id` bigint NOT NULL,
  `invitee_user_id` char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `invited_by` char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `status` varchar(12) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'PENDING',
  `created_at` datetime(6) NOT NULL,
  `expires_at` datetime(6) NOT NULL,
  `resolved_at` datetime(6) DEFAULT NULL,
  `resolved_by` char(36) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `pending_invitee_id` char(36) CHARACTER SET ascii COLLATE ascii_bin GENERATED ALWAYS AS ((case when (`status` = _ascii'PENDING') then `invitee_user_id` else NULL end)) STORED,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_invitation_pending` (`project_id`,`pending_invitee_id`),
  KEY `ix_invitation_recipient` (`invitee_user_id`,`status`,`created_at`),
  KEY `ix_invitation_expiry` (`status`,`expires_at`),
  CONSTRAINT `fk_invitation_project` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `ck_invitation_expiry` CHECK ((`expires_at` = (`created_at` + interval 7 day))),
  CONSTRAINT `ck_invitation_resolved` CHECK (((`status` = _ascii'PENDING') = (`resolved_at` is null))),
  CONSTRAINT `ck_invitation_status` CHECK ((`status` in (_ascii'PENDING',_ascii'ACCEPTED',_ascii'REJECTED',_ascii'CANCELLED',_ascii'EXPIRED')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `project_join_requests` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `project_id` bigint NOT NULL,
  `user_id` char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `invitation_link_id` bigint NOT NULL,
  `reason` varchar(500) COLLATE utf8mb4_0900_as_ci DEFAULT NULL,
  `status` varchar(12) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'PENDING',
  `created_at` datetime(6) NOT NULL,
  `resolved_at` datetime(6) DEFAULT NULL,
  `resolved_by` char(36) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `close_reason` varchar(100) COLLATE utf8mb4_0900_as_ci DEFAULT NULL,
  `pending_user_id` char(36) CHARACTER SET ascii COLLATE ascii_bin GENERATED ALWAYS AS ((case when (`status` = _ascii'PENDING') then `user_id` else NULL end)) STORED,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_join_request_pending` (`project_id`,`pending_user_id`),
  KEY `ix_join_request_inbox` (`project_id`,`status`,`created_at`),
  KEY `ix_join_request_cooldown` (`project_id`,`user_id`,`status`,`resolved_at`),
  KEY `ix_join_request_user` (`user_id`,`status`,`created_at`),
  KEY `fk_join_request_link` (`project_id`,`invitation_link_id`),
  CONSTRAINT `fk_join_request_link` FOREIGN KEY (`project_id`, `invitation_link_id`) REFERENCES `project_invitation_links` (`project_id`, `id`),
  CONSTRAINT `ck_join_request_closed` CHECK (((`status` <> _ascii'CLOSED') or ((`close_reason` is not null) and (char_length(trim(`close_reason`)) > 0)))),
  CONSTRAINT `ck_join_request_resolved` CHECK (((`status` = _ascii'PENDING') = (`resolved_at` is null))),
  CONSTRAINT `ck_join_request_status` CHECK ((`status` in (_ascii'PENDING',_ascii'ACCEPTED',_ascii'REJECTED',_ascii'CANCELLED',_ascii'CLOSED')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `project_memberships` (
  `project_id` bigint NOT NULL,
  `user_id` char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `specialty` varchar(100) COLLATE utf8mb4_0900_as_ci DEFAULT NULL,
  `status` varchar(10) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'ACTIVE',
  `joined_at` datetime(6) NOT NULL,
  `added_by` char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `removed_at` datetime(6) DEFAULT NULL,
  `removed_by` char(36) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  PRIMARY KEY (`project_id`,`user_id`),
  KEY `ix_membership_user` (`user_id`,`status`,`project_id`),
  CONSTRAINT `fk_member_project` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `ck_member_removed` CHECK ((((`status` = _ascii'REMOVED') = (`removed_at` is not null)) and ((`removed_at` is null) = (`removed_by` is null)))),
  CONSTRAINT `ck_member_status` CHECK ((`status` in (_ascii'ACTIVE',_ascii'REMOVED')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `project_resources` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `project_id` bigint NOT NULL,
  `resource_type` varchar(8) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `title` varchar(150) COLLATE utf8mb4_0900_as_ci NOT NULL,
  `description` varchar(500) COLLATE utf8mb4_0900_as_ci DEFAULT NULL,
  `stored_file_id` bigint DEFAULT NULL,
  `file_kind` varchar(20) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `link_url` varchar(2048) COLLATE utf8mb4_0900_as_ci DEFAULT NULL,
  `created_by` char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `creation_request_id` char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `request_hash` binary(32) NOT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `deleted_at` datetime(6) DEFAULT NULL,
  `deleted_by` char(36) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `version` bigint NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_resource_request` (`project_id`,`created_by`,`creation_request_id`),
  UNIQUE KEY `uq_resource_file` (`stored_file_id`),
  KEY `fk_resource_file` (`project_id`,`stored_file_id`,`file_kind`),
  KEY `fk_resource_deleter` (`project_id`,`deleted_by`),
  KEY `ix_resource_project` (`project_id`,`deleted_at`,`created_at`,`id`),
  KEY `ix_resource_type` (`project_id`,`resource_type`,`deleted_at`,`id`),
  CONSTRAINT `fk_resource_creator` FOREIGN KEY (`project_id`, `created_by`) REFERENCES `project_memberships` (`project_id`, `user_id`),
  CONSTRAINT `fk_resource_deleter` FOREIGN KEY (`project_id`, `deleted_by`) REFERENCES `project_memberships` (`project_id`, `user_id`),
  CONSTRAINT `fk_resource_file` FOREIGN KEY (`project_id`, `stored_file_id`, `file_kind`) REFERENCES `stored_files` (`project_id`, `id`, `file_kind`),
  CONSTRAINT `fk_resource_project` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `ck_resource_deleted` CHECK (((`deleted_at` is null) = (`deleted_by` is null))),
  CONSTRAINT `ck_resource_kind` CHECK ((((`resource_type` = _utf8mb4'FILE') and (`stored_file_id` is not null) and (`file_kind` is not null) and (`file_kind` = _utf8mb4'PROJECT_DOCUMENT') and (`link_url` is null)) or ((`resource_type` = _utf8mb4'LINK') and (`stored_file_id` is null) and (`file_kind` is null) and (`link_url` is not null)))),
  CONSTRAINT `ck_resource_link` CHECK (((`link_url` is null) or (regexp_like(`link_url`,_utf8mb4'^https?://[^/?#[:space:]]+',_utf8mb4'i') and (not(regexp_like(`link_url`,_utf8mb4'^https?://[^/?#]*@',_utf8mb4'i'))) and (not(regexp_like(`link_url`,_utf8mb4'[[:space:]]')))))),
  CONSTRAINT `ck_resource_title` CHECK ((char_length(trim(`title`)) between 1 and 150)),
  CONSTRAINT `ck_resource_version` CHECK ((`version` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `project_storage_usage` (
  `project_id` bigint NOT NULL,
  `limit_bytes` bigint NOT NULL DEFAULT '524288000',
  `used_bytes` bigint NOT NULL DEFAULT '0',
  `reserved_bytes` bigint NOT NULL DEFAULT '0',
  `version` bigint NOT NULL DEFAULT '0',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`project_id`),
  CONSTRAINT `fk_storage_project` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `ck_storage_quota` CHECK (((`limit_bytes` = 524288000) and (`used_bytes` >= 0) and (`reserved_bytes` >= 0) and ((`used_bytes` + `reserved_bytes`) <= `limit_bytes`))),
  CONSTRAINT `ck_storage_version` CHECK ((`version` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `projects` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `owner_user_id` char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `manager_user_id` char(36) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `name` varchar(100) COLLATE utf8mb4_0900_as_ci NOT NULL,
  `description` varchar(500) COLLATE utf8mb4_0900_as_ci NOT NULL,
  `avatar_storage_key` varchar(500) COLLATE utf8mb4_0900_as_ci DEFAULT NULL,
  `avatar_mime_type` varchar(100) COLLATE utf8mb4_0900_as_ci DEFAULT NULL,
  `avatar_size_bytes` bigint DEFAULT NULL,
  `starts_on` date NOT NULL,
  `ends_on` date NOT NULL,
  `status` varchar(12) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'ACTIVE',
  `archived_at` datetime(6) DEFAULT NULL,
  `archived_by` char(36) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `version` bigint NOT NULL DEFAULT '0',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `active_name` varchar(100) COLLATE utf8mb4_0900_as_ci GENERATED ALWAYS AS ((case when (`status` = _ascii'ACTIVE') then trim(`name`) else NULL end)) STORED,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_project_active_name` (`owner_user_id`,`active_name`),
  KEY `ix_project_manager` (`manager_user_id`,`status`),
  CONSTRAINT `ck_project_archive` CHECK ((((`status` = _utf8mb4'ARCHIVED') = (`archived_at` is not null)) and ((`archived_at` is null) = (`archived_by` is null)))),
  CONSTRAINT `ck_project_avatar` CHECK (((`avatar_size_bytes` is null) or (`avatar_size_bytes` > 0))),
  CONSTRAINT `ck_project_dates` CHECK ((`ends_on` >= `starts_on`)),
  CONSTRAINT `ck_project_description` CHECK ((char_length(trim(`description`)) between 10 and 500)),
  CONSTRAINT `ck_project_manager` CHECK (((`manager_user_id` is null) or (`manager_user_id` <> `owner_user_id`))),
  CONSTRAINT `ck_project_name` CHECK ((char_length(trim(`name`)) between 3 and 100)),
  CONSTRAINT `ck_project_status` CHECK ((`status` in (_ascii'ACTIVE',_ascii'ARCHIVED'))),
  CONSTRAINT `ck_project_version` CHECK ((`version` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `service_metadata` (
  `service_name` varchar(64) NOT NULL,
  `initialized_at` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`service_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `stored_files` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `project_id` bigint NOT NULL,
  `uploaded_by` char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `upload_request_id` char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `request_hash` binary(32) NOT NULL,
  `storage_key` varchar(500) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `original_name` varchar(255) COLLATE utf8mb4_0900_as_ci NOT NULL,
  `file_kind` varchar(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `mime_type` varchar(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `size_bytes` bigint NOT NULL,
  `content_sha256` binary(32) DEFAULT NULL,
  `status` varchar(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'UPLOADING',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `temporary_expires_at` datetime(6) NOT NULL,
  `ready_at` datetime(6) DEFAULT NULL,
  `attached_at` datetime(6) DEFAULT NULL,
  `deleted_at` datetime(6) DEFAULT NULL,
  `deleted_by` char(36) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `purge_after` datetime(6) DEFAULT NULL,
  `purged_at` datetime(6) DEFAULT NULL,
  `version` bigint NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_file_storage` (`storage_key`),
  UNIQUE KEY `uq_file_upload_request` (`project_id`,`uploaded_by`,`upload_request_id`),
  UNIQUE KEY `uq_file_project_kind` (`project_id`,`id`,`file_kind`),
  KEY `fk_file_deleted_by` (`project_id`,`deleted_by`),
  KEY `ix_file_cleanup` (`status`,`temporary_expires_at`,`id`),
  KEY `ix_file_purge` (`status`,`purge_after`,`id`),
  KEY `ix_file_project` (`project_id`,`status`,`id`),
  CONSTRAINT `fk_file_deleted_by` FOREIGN KEY (`project_id`, `deleted_by`) REFERENCES `project_memberships` (`project_id`, `user_id`),
  CONSTRAINT `fk_file_project` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `fk_file_uploader` FOREIGN KEY (`project_id`, `uploaded_by`) REFERENCES `project_memberships` (`project_id`, `user_id`),
  CONSTRAINT `ck_file_attached` CHECK (((`attached_at` is null) or (`ready_at` is not null))),
  CONSTRAINT `ck_file_deleted` CHECK ((((`status` in (_utf8mb4'DELETE_PENDING',_utf8mb4'DELETED')) = (`deleted_at` is not null)) and ((`deleted_at` is null) = (`purge_after` is null)) and ((`deleted_at` is not null) or (`deleted_by` is null)))),
  CONSTRAINT `ck_file_kind` CHECK ((`file_kind` in (_utf8mb4'COMMENT_IMAGE',_utf8mb4'PROJECT_DOCUMENT'))),
  CONSTRAINT `ck_file_mime` CHECK (((`mime_type` in (_utf8mb4'image/png',_utf8mb4'image/jpeg',_utf8mb4'application/pdf',_utf8mb4'application/vnd.openxmlformats-officedocument.wordprocessingml.document',_utf8mb4'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',_utf8mb4'application/vnd.openxmlformats-officedocument.presentationml.presentation',_utf8mb4'text/plain',_utf8mb4'text/csv',_utf8mb4'application/zip')) and ((`file_kind` <> _utf8mb4'COMMENT_IMAGE') or (`mime_type` in (_utf8mb4'image/png',_utf8mb4'image/jpeg'))))),
  CONSTRAINT `ck_file_name` CHECK (((char_length(trim(`original_name`)) between 1 and 255) and (char_length(`storage_key`) > 0))),
  CONSTRAINT `ck_file_purge` CHECK (((`purge_after` is null) or (`purge_after` = (`deleted_at` + interval 24 hour)))),
  CONSTRAINT `ck_file_purged` CHECK (((`status` = _utf8mb4'DELETED') = (`purged_at` is not null))),
  CONSTRAINT `ck_file_ready` CHECK (((`status` <> _utf8mb4'READY') or ((`ready_at` is not null) and (`content_sha256` is not null)))),
  CONSTRAINT `ck_file_size` CHECK (((`size_bytes` > 0) and (((`file_kind` = _utf8mb4'COMMENT_IMAGE') and (`size_bytes` <= 5242880)) or ((`file_kind` = _utf8mb4'PROJECT_DOCUMENT') and (`size_bytes` <= 20971520))))),
  CONSTRAINT `ck_file_status` CHECK ((`status` in (_utf8mb4'UPLOADING',_utf8mb4'READY',_utf8mb4'FAILED',_utf8mb4'DELETE_PENDING',_utf8mb4'DELETED'))),
  CONSTRAINT `ck_file_temp_expiry` CHECK ((`temporary_expires_at` = (`created_at` + interval 24 hour))),
  CONSTRAINT `ck_file_version` CHECK ((`version` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `task_alerts` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `project_id` bigint NOT NULL,
  `task_id` bigint NOT NULL,
  `alert_type` varchar(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `submission_id` bigint DEFAULT NULL,
  `dedupe_scope` bigint GENERATED ALWAYS AS (coalesce(`submission_id`,0)) STORED,
  `observed_microseconds` bigint DEFAULT NULL,
  `estimated_seconds_snapshot` bigint DEFAULT NULL,
  `deadline_on_snapshot` date DEFAULT NULL,
  `raised_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_task_alert` (`task_id`,`alert_type`,`dedupe_scope`),
  KEY `ix_alert_project` (`project_id`,`raised_at`),
  KEY `fk_alert_task` (`project_id`,`task_id`),
  KEY `fk_alert_submission` (`task_id`,`submission_id`),
  CONSTRAINT `fk_alert_submission` FOREIGN KEY (`task_id`, `submission_id`) REFERENCES `task_submissions` (`task_id`, `id`),
  CONSTRAINT `fk_alert_task` FOREIGN KEY (`project_id`, `task_id`) REFERENCES `tasks` (`project_id`, `id`),
  CONSTRAINT `ck_alert_numbers` CHECK ((((`observed_microseconds` is null) or (`observed_microseconds` >= 0)) and ((`estimated_seconds_snapshot` is null) or (`estimated_seconds_snapshot` > 0)))),
  CONSTRAINT `ck_alert_scope` CHECK (((`alert_type` = _ascii'REVIEW_OVERDUE') = (`submission_id` is not null))),
  CONSTRAINT `ck_alert_type` CHECK ((`alert_type` in (_ascii'RISK',_ascii'OVERRUN',_ascii'OVERDUE',_ascii'REVIEW_OVERDUE')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `task_comments` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `project_id` bigint NOT NULL,
  `task_id` bigint NOT NULL,
  `author_user_id` char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `body` text COLLATE utf8mb4_0900_as_ci,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `edited_at` datetime(6) DEFAULT NULL,
  `deleted_at` datetime(6) DEFAULT NULL,
  `version` bigint NOT NULL DEFAULT '0',
  `parent_comment_id` bigint DEFAULT NULL,
  `thread_level` tinyint NOT NULL DEFAULT '0',
  `parent_thread_level` tinyint DEFAULT NULL,
  `image_count` tinyint NOT NULL DEFAULT '0',
  `deleted_by` char(36) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `creation_request_id` char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `request_hash` binary(32) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_comment_project_task` (`project_id`,`task_id`,`id`),
  UNIQUE KEY `uq_comment_thread` (`project_id`,`task_id`,`id`,`thread_level`),
  UNIQUE KEY `uq_comment_request` (`project_id`,`author_user_id`,`creation_request_id`),
  KEY `ix_comment_task` (`task_id`,`created_at`,`id`),
  KEY `fk_comment_parent` (`project_id`,`task_id`,`parent_comment_id`,`parent_thread_level`),
  KEY `fk_comment_deleter` (`project_id`,`deleted_by`),
  KEY `ix_comment_replies` (`task_id`,`parent_comment_id`,`created_at`,`id`),
  CONSTRAINT `fk_comment_author` FOREIGN KEY (`project_id`, `author_user_id`) REFERENCES `project_memberships` (`project_id`, `user_id`),
  CONSTRAINT `fk_comment_deleter` FOREIGN KEY (`project_id`, `deleted_by`) REFERENCES `project_memberships` (`project_id`, `user_id`),
  CONSTRAINT `fk_comment_parent` FOREIGN KEY (`project_id`, `task_id`, `parent_comment_id`, `parent_thread_level`) REFERENCES `task_comments` (`project_id`, `task_id`, `id`, `thread_level`),
  CONSTRAINT `fk_comment_task` FOREIGN KEY (`project_id`, `task_id`) REFERENCES `tasks` (`project_id`, `id`),
  CONSTRAINT `ck_comment_body` CHECK ((((`deleted_at` is not null) and (`body` is null) and (`image_count` = 0)) or ((`deleted_at` is null) and (((`body` is not null) and (char_length(trim(`body`)) between 1 and 2000)) or ((`body` is null) and (`image_count` > 0)))))),
  CONSTRAINT `ck_comment_deleted` CHECK (((`deleted_at` is null) = (`deleted_by` is null))),
  CONSTRAINT `ck_comment_images` CHECK ((`image_count` between 0 and 5)),
  CONSTRAINT `ck_comment_thread` CHECK ((((`parent_comment_id` is null) and (`thread_level` = 0) and (`parent_thread_level` is null)) or ((`parent_comment_id` is not null) and (`thread_level` = 1) and (`parent_thread_level` is not null) and (`parent_thread_level` = 0)))),
  CONSTRAINT `ck_comment_version` CHECK ((`version` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `task_submissions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `project_id` bigint NOT NULL,
  `task_id` bigint NOT NULL,
  `submission_no` int NOT NULL,
  `submitted_by` char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `assignee_user_id` char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `result_note` text COLLATE utf8mb4_0900_as_ci NOT NULL,
  `deadline_on_snapshot` date NOT NULL,
  `submitted_at` datetime(6) NOT NULL,
  `decision` varchar(10) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'PENDING',
  `reviewed_by` char(36) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `reviewed_at` datetime(6) DEFAULT NULL,
  `rejection_reason` text COLLATE utf8mb4_0900_as_ci,
  `pending_task_id` bigint GENERATED ALWAYS AS ((case when (`decision` = _ascii'PENDING') then `task_id` else NULL end)) STORED,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_submission_number` (`task_id`,`submission_no`),
  UNIQUE KEY `uq_submission_task_id` (`task_id`,`id`),
  UNIQUE KEY `uq_submission_pending` (`pending_task_id`),
  KEY `ix_submission_completions` (`project_id`,`decision`,`reviewed_at`,`task_id`),
  KEY `fk_submission_task` (`project_id`,`task_id`),
  CONSTRAINT `fk_submission_task` FOREIGN KEY (`project_id`, `task_id`) REFERENCES `tasks` (`project_id`, `id`),
  CONSTRAINT `ck_submission_decision` CHECK ((`decision` in (_ascii'PENDING',_ascii'ACCEPTED',_ascii'REJECTED'))),
  CONSTRAINT `ck_submission_note` CHECK ((char_length(trim(`result_note`)) > 0)),
  CONSTRAINT `ck_submission_number` CHECK ((`submission_no` > 0)),
  CONSTRAINT `ck_submission_rejection` CHECK (((`decision` <> _ascii'REJECTED') or ((`rejection_reason` is not null) and (char_length(trim(`rejection_reason`)) > 0)))),
  CONSTRAINT `ck_submission_review` CHECK ((((`decision` = _ascii'PENDING') = (`reviewed_at` is null)) and ((`reviewed_at` is null) = (`reviewed_by` is null)) and ((`reviewed_at` is null) or (`reviewed_at` >= `submitted_at`))))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `tasks` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `project_id` bigint NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_0900_as_ci NOT NULL,
  `normalized_name` varchar(100) COLLATE utf8mb4_0900_as_ci GENERATED ALWAYS AS (trim(`name`)) STORED,
  `description` text COLLATE utf8mb4_0900_as_ci,
  `assignee_user_id` char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `created_by` char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `priority` varchar(8) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'MEDIUM',
  `status` varchar(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'TODO',
  `starts_on` date NOT NULL,
  `deadline_on` date NOT NULL,
  `estimated_seconds` bigint NOT NULL,
  `is_blocked` tinyint(1) NOT NULL DEFAULT '0',
  `blocked_reason` text COLLATE utf8mb4_0900_as_ci,
  `latest_submission_id` bigint DEFAULT NULL,
  `accepted_submission_id` bigint DEFAULT NULL,
  `completed_at` datetime(6) DEFAULT NULL,
  `cancelled_at` datetime(6) DEFAULT NULL,
  `cancellation_reason` text COLLATE utf8mb4_0900_as_ci,
  `version` bigint NOT NULL DEFAULT '0',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_task_project_id` (`project_id`,`id`),
  UNIQUE KEY `uq_task_name` (`project_id`,`normalized_name`),
  KEY `ix_task_board` (`project_id`,`status`,`deadline_on`,`id`),
  KEY `ix_task_personal` (`assignee_user_id`,`status`,`deadline_on`,`id`),
  KEY `ix_task_priority` (`project_id`,`priority`,`id`),
  KEY `ix_task_created` (`project_id`,`created_at`,`id`),
  KEY `ix_task_deadline` (`status`,`deadline_on`),
  KEY `fk_task_assignee` (`project_id`,`assignee_user_id`),
  KEY `fk_task_creator` (`project_id`,`created_by`),
  KEY `fk_task_latest_submission` (`id`,`latest_submission_id`),
  KEY `fk_task_accepted_submission` (`id`,`accepted_submission_id`),
  CONSTRAINT `fk_task_accepted_submission` FOREIGN KEY (`id`, `accepted_submission_id`) REFERENCES `task_submissions` (`task_id`, `id`),
  CONSTRAINT `fk_task_assignee` FOREIGN KEY (`project_id`, `assignee_user_id`) REFERENCES `project_memberships` (`project_id`, `user_id`),
  CONSTRAINT `fk_task_creator` FOREIGN KEY (`project_id`, `created_by`) REFERENCES `project_memberships` (`project_id`, `user_id`),
  CONSTRAINT `fk_task_latest_submission` FOREIGN KEY (`id`, `latest_submission_id`) REFERENCES `task_submissions` (`task_id`, `id`),
  CONSTRAINT `fk_task_project` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `ck_task_blocked` CHECK (((`is_blocked` in (0,1)) and ((`is_blocked` = 0) or ((`blocked_reason` is not null) and (char_length(trim(`blocked_reason`)) > 0))))),
  CONSTRAINT `ck_task_cancelled` CHECK ((((`status` = _ascii'CANCELLED') = (`cancelled_at` is not null)) and ((`status` <> _ascii'CANCELLED') or ((`cancellation_reason` is not null) and (char_length(trim(`cancellation_reason`)) > 0))))),
  CONSTRAINT `ck_task_completed` CHECK ((((`status` = _ascii'DONE') = (`completed_at` is not null)) and ((`status` = _ascii'DONE') = (`accepted_submission_id` is not null)))),
  CONSTRAINT `ck_task_dates` CHECK ((`deadline_on` >= `starts_on`)),
  CONSTRAINT `ck_task_estimate` CHECK ((`estimated_seconds` > 0)),
  CONSTRAINT `ck_task_name` CHECK ((char_length(trim(`name`)) between 3 and 100)),
  CONSTRAINT `ck_task_priority` CHECK ((`priority` in (_ascii'LOW',_ascii'MEDIUM',_ascii'HIGH'))),
  CONSTRAINT `ck_task_review` CHECK (((`status` <> _ascii'IN_REVIEW') or (`latest_submission_id` is not null))),
  CONSTRAINT `ck_task_status` CHECK ((`status` in (_ascii'TODO',_ascii'IN_PROGRESS',_ascii'IN_REVIEW',_ascii'DONE',_ascii'CANCELLED'))),
  CONSTRAINT `ck_task_version` CHECK ((`version` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `time_entries` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `project_id` bigint NOT NULL,
  `task_id` bigint NOT NULL,
  `user_id` char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `source` varchar(8) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `started_at` datetime(6) NOT NULL,
  `ended_at` datetime(6) DEFAULT NULL,
  `manual_reason` text COLLATE utf8mb4_0900_as_ci,
  `created_by` char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `updated_by` char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `version` bigint NOT NULL DEFAULT '0',
  `duration_microseconds` bigint GENERATED ALWAYS AS (timestampdiff(MICROSECOND,`started_at`,`ended_at`)) STORED,
  `running_user_id` char(36) CHARACTER SET ascii COLLATE ascii_bin GENERATED ALWAYS AS ((case when (`ended_at` is null) then `user_id` else NULL end)) STORED,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_time_running_user` (`running_user_id`),
  KEY `ix_time_user_interval` (`user_id`,`started_at`,`ended_at`),
  KEY `ix_time_task` (`task_id`,`user_id`,`started_at`),
  KEY `ix_time_project_running` (`project_id`,`ended_at`),
  KEY `fk_time_task` (`project_id`,`task_id`),
  KEY `fk_time_member` (`project_id`,`user_id`),
  CONSTRAINT `fk_time_member` FOREIGN KEY (`project_id`, `user_id`) REFERENCES `project_memberships` (`project_id`, `user_id`),
  CONSTRAINT `fk_time_task` FOREIGN KEY (`project_id`, `task_id`) REFERENCES `tasks` (`project_id`, `id`),
  CONSTRAINT `ck_time_manual` CHECK (((`source` <> _ascii'MANUAL') or ((`ended_at` is not null) and (`created_by` = `user_id`) and (`manual_reason` is not null) and (char_length(trim(`manual_reason`)) > 0)))),
  CONSTRAINT `ck_time_range` CHECK (((`ended_at` is null) or (`ended_at` >= `started_at`))),
  CONSTRAINT `ck_time_source` CHECK ((`source` in (_ascii'TIMER',_ascii'MANUAL'))),
  CONSTRAINT `ck_time_version` CHECK ((`version` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `time_entry_locks` (
  `user_id` char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  PRIMARY KEY (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `time_entry_revisions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `time_entry_id` bigint NOT NULL,
  `revised_by` char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `before_started_at` datetime(6) NOT NULL,
  `before_ended_at` datetime(6) DEFAULT NULL,
  `after_started_at` datetime(6) NOT NULL,
  `after_ended_at` datetime(6) DEFAULT NULL,
  `reason` text COLLATE utf8mb4_0900_as_ci NOT NULL,
  `revised_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_time_revision_history` (`time_entry_id`,`revised_at`),
  CONSTRAINT `fk_time_revision` FOREIGN KEY (`time_entry_id`) REFERENCES `time_entries` (`id`),
  CONSTRAINT `ck_time_revision_ranges` CHECK ((((`before_ended_at` is null) or (`before_ended_at` >= `before_started_at`)) and ((`after_ended_at` is null) or (`after_ended_at` >= `after_started_at`)))),
  CONSTRAINT `ck_time_revision_reason` CHECK ((char_length(trim(`reason`)) > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

-- notification: V1, V2, V3, V4
USE `tasknest_notification`;

CREATE TABLE `email_delivery_attempts` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `email_job_id` bigint NOT NULL,
  `attempt_no` int NOT NULL,
  `started_at` datetime(6) NOT NULL,
  `finished_at` datetime(6) DEFAULT NULL,
  `result` varchar(24) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `provider_message_id` varchar(255) COLLATE utf8mb4_0900_as_ci DEFAULT NULL,
  `error_code` varchar(100) COLLATE utf8mb4_0900_as_ci DEFAULT NULL,
  `error_safe` varchar(500) COLLATE utf8mb4_0900_as_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_email_attempt` (`email_job_id`,`attempt_no`),
  CONSTRAINT `fk_email_attempt_job` FOREIGN KEY (`email_job_id`) REFERENCES `email_jobs` (`id`),
  CONSTRAINT `ck_email_attempt_finished` CHECK ((((`finished_at` is null) = (`result` is null)) and ((`finished_at` is null) or (`finished_at` >= `started_at`)))),
  CONSTRAINT `ck_email_attempt_number` CHECK ((`attempt_no` > 0)),
  CONSTRAINT `ck_email_attempt_result` CHECK (((`result` is null) or (`result` in (_ascii'ACCEPTED',_ascii'TRANSIENT_FAILURE',_ascii'PERMANENT_FAILURE',_ascii'UNKNOWN'))))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `email_jobs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `event_id` char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `recipient_user_id` char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `recipient_email` varchar(255) COLLATE utf8mb4_0900_as_ci NOT NULL,
  `event_type` varchar(120) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `purpose` varchar(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `notification_id` bigint DEFAULT NULL,
  `template_key` varchar(100) COLLATE utf8mb4_0900_as_ci NOT NULL,
  `template_version` int NOT NULL DEFAULT '1',
  `template_data` json NOT NULL,
  `sensitive_data` mediumblob,
  `encryption_key_id` varchar(100) COLLATE utf8mb4_0900_as_ci DEFAULT NULL,
  `status` varchar(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'QUEUED',
  `attempt_count` int NOT NULL DEFAULT '0',
  `next_attempt_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `locked_by` varchar(100) COLLATE utf8mb4_0900_as_ci DEFAULT NULL,
  `locked_until` datetime(6) DEFAULT NULL,
  `provider_message_id` varchar(255) COLLATE utf8mb4_0900_as_ci DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `expires_at` datetime(6) DEFAULT NULL,
  `accepted_at` datetime(6) DEFAULT NULL,
  `delivered_at` datetime(6) DEFAULT NULL,
  `last_error_safe` varchar(500) COLLATE utf8mb4_0900_as_ci DEFAULT NULL,
  `recipient_reasons` json NOT NULL DEFAULT (json_array()),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_email_recipient_event` (`recipient_user_id`,`event_id`),
  KEY `ix_email_dispatch` (`status`,`next_attempt_at`,`id`),
  KEY `ix_email_lease` (`status`,`locked_until`),
  KEY `ix_email_provider` (`provider_message_id`),
  KEY `fk_email_notification` (`notification_id`,`recipient_user_id`,`event_id`),
  CONSTRAINT `fk_email_notification` FOREIGN KEY (`notification_id`, `recipient_user_id`, `event_id`) REFERENCES `notifications` (`id`, `recipient_user_id`, `event_id`),
  CONSTRAINT `ck_email_comment_reasons` CHECK (((not((`event_type` like _utf8mb4'task.comment.%'))) or ((`purpose` = _utf8mb4'TASK_EVENT') and (`notification_id` is not null) and (json_contains(`recipient_reasons`,_utf8mb4'"REPLY"') or json_contains(`recipient_reasons`,_utf8mb4'"MENTION"'))))),
  CONSTRAINT `ck_email_encryption` CHECK (((`sensitive_data` is null) = (`encryption_key_id` is null))),
  CONSTRAINT `ck_email_expiry` CHECK (((`expires_at` is null) or (`expires_at` > `created_at`))),
  CONSTRAINT `ck_email_lease` CHECK (((`locked_by` is null) = (`locked_until` is null))),
  CONSTRAINT `ck_email_numbers` CHECK (((`attempt_count` >= 0) and (`template_version` > 0))),
  CONSTRAINT `ck_email_purpose` CHECK ((`purpose` in (_ascii'EMAIL_VERIFICATION',_ascii'PASSWORD_RESET',_ascii'PROJECT_EVENT',_ascii'TASK_EVENT',_ascii'SECURITY_EVENT'))),
  CONSTRAINT `ck_email_recipient_reasons` CHECK (json_schema_valid(_utf8mb4'{"type":"array","items":{"enum":["ASSIGNEE","CREATOR","REPLY","MENTION"]},"uniqueItems":true}',`recipient_reasons`)),
  CONSTRAINT `ck_email_status` CHECK ((`status` in (_ascii'QUEUED',_ascii'SENDING',_ascii'ACCEPTED',_ascii'DELIVERED',_ascii'BOUNCED',_ascii'FAILED',_ascii'SUPPRESSED')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `email_provider_events` (
  `dedupe_hash` binary(32) NOT NULL,
  `provider` varchar(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'BREVO',
  `provider_event_id` varchar(255) COLLATE utf8mb4_0900_as_ci DEFAULT NULL,
  `provider_message_id` varchar(255) COLLATE utf8mb4_0900_as_ci NOT NULL,
  `email_job_id` bigint DEFAULT NULL,
  `event_type` varchar(80) COLLATE utf8mb4_0900_as_ci NOT NULL,
  `occurred_at` datetime(6) NOT NULL,
  `received_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`dedupe_hash`),
  UNIQUE KEY `uq_provider_event` (`provider`,`provider_event_id`),
  KEY `ix_provider_event_message` (`provider`,`provider_message_id`,`occurred_at`),
  KEY `fk_provider_event_job` (`email_job_id`),
  CONSTRAINT `fk_provider_event_job` FOREIGN KEY (`email_job_id`) REFERENCES `email_jobs` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `notifications` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `recipient_user_id` char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `event_id` char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `event_type` varchar(120) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `actor_user_id` char(36) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `project_id` bigint DEFAULT NULL,
  `task_id` bigint DEFAULT NULL,
  `resource_type` varchar(60) COLLATE utf8mb4_0900_as_ci NOT NULL,
  `resource_id` varchar(64) COLLATE utf8mb4_0900_as_ci NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_0900_as_ci NOT NULL,
  `body` text COLLATE utf8mb4_0900_as_ci NOT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `read_at` datetime(6) DEFAULT NULL,
  `recipient_reasons` json NOT NULL DEFAULT (json_array()),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_notification_recipient_event` (`recipient_user_id`,`event_id`),
  UNIQUE KEY `uq_notification_delivery` (`id`,`recipient_user_id`,`event_id`),
  KEY `ix_notification_unread` (`recipient_user_id`,`read_at`,`created_at`,`id`),
  KEY `ix_notification_inbox` (`recipient_user_id`,`created_at`,`id`),
  CONSTRAINT `ck_notification_read` CHECK (((`read_at` is null) or (`read_at` >= `created_at`))),
  CONSTRAINT `ck_notification_reasons` CHECK (json_schema_valid(_utf8mb4'{"type":"array","items":{"enum":["ASSIGNEE","CREATOR","REPLY","MENTION"]},"uniqueItems":true}',`recipient_reasons`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `outbox_events` (
  `event_id` char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `aggregate_type` varchar(80) COLLATE utf8mb4_0900_as_ci NOT NULL,
  `aggregate_id` varchar(64) COLLATE utf8mb4_0900_as_ci NOT NULL,
  `aggregate_version` bigint NOT NULL,
  `event_type` varchar(120) COLLATE utf8mb4_0900_as_ci NOT NULL,
  `schema_version` int NOT NULL DEFAULT '1',
  `occurred_at` datetime(6) NOT NULL,
  `payload` json NOT NULL,
  `sensitive_payload` mediumblob,
  `encryption_key_id` varchar(100) COLLATE utf8mb4_0900_as_ci DEFAULT NULL,
  `correlation_id` char(36) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `status` varchar(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'PENDING',
  `available_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `attempts` int NOT NULL DEFAULT '0',
  `locked_by` varchar(100) COLLATE utf8mb4_0900_as_ci DEFAULT NULL,
  `locked_until` datetime(6) DEFAULT NULL,
  `published_at` datetime(6) DEFAULT NULL,
  `last_error_safe` varchar(500) COLLATE utf8mb4_0900_as_ci DEFAULT NULL,
  PRIMARY KEY (`event_id`),
  KEY `ix_outbox_dispatch` (`status`,`available_at`,`occurred_at`),
  KEY `ix_outbox_lease` (`status`,`locked_until`),
  CONSTRAINT `ck_outbox_encryption` CHECK (((`sensitive_payload` is null) = (`encryption_key_id` is null))),
  CONSTRAINT `ck_outbox_lease` CHECK (((`locked_by` is null) = (`locked_until` is null))),
  CONSTRAINT `ck_outbox_numbers` CHECK (((`aggregate_version` >= 0) and (`schema_version` > 0) and (`attempts` >= 0))),
  CONSTRAINT `ck_outbox_status` CHECK ((`status` in (_utf8mb4'PENDING',_utf8mb4'PROCESSING',_utf8mb4'PUBLISHED',_utf8mb4'DEAD')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `processed_events` (
  `consumer_name` varchar(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `event_id` char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `event_type` varchar(120) COLLATE utf8mb4_0900_as_ci NOT NULL,
  `processed_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`consumer_name`,`event_id`),
  KEY `ix_processed_retention` (`processed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `recipient_contacts` (
  `user_id` char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_0900_as_ci NOT NULL,
  `full_name` varchar(100) COLLATE utf8mb4_0900_as_ci NOT NULL,
  `is_email_verified` tinyint(1) NOT NULL,
  `source_version` bigint NOT NULL,
  `last_event_at` datetime(6) NOT NULL,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `ck_contact_verified` CHECK ((`is_email_verified` in (0,1))),
  CONSTRAINT `ck_contact_version` CHECK ((`source_version` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `service_metadata` (
  `service_name` varchar(64) NOT NULL,
  `initialized_at` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`service_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

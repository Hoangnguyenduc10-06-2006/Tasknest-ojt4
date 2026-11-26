# Từ điển dữ liệu TaskNest

**38 bảng ứng dụng**: Identity 9, Work 21, Notification 8; đã tính service_metadata, chưa tính flyway_schema_history.

Sinh từ schema vật lý sau toàn bộ migration Flyway. Không đọc database đang sử dụng.

Nguồn nghiệp vụ: [RULE v2.0](../../RULE.md). Quy trình ghi và giới hạn CHECK/FK: [hướng dẫn schema](README.md) và [cộng tác/tài liệu](COLLABORATION_AND_FILES.md).

UUID tài khoản là CHAR(36) ASCII phân biệt hoa/thường. ID dự án/nhiệm vụ/tài liệu là BIGINT. Ngày giờ DATETIME(6) lưu UTC; ngày nghiệp vụ DATE theo Asia/Ho_Chi_Minh.

## Identity — V1, V2, V3, V4, V5

### account_tokens

| Cột | Kiểu SQL | NULL | Mặc định / sinh tự động |
|---|---|---|---|
| `id` | `bigint` | Không | —; auto_increment |
| `user_id` | `char(36)` | Không | — |
| `purpose` | `varchar(24)` | Không | — |
| `token_hash` | `binary(32)` | Không | — |
| `created_at` | `datetime(6)` | Không | — |
| `expires_at` | `datetime(6)` | Không | — |
| `used_at` | `datetime(6)` | Có | — |
| `revoked_at` | `datetime(6)` | Có | — |
| `issue_source` | `varchar(16)` | Không | OTHER |
| `active_user_id` | `char(36)` | Có | (case when ((`used_at` is null) and (`revoked_at` is null)) then `user_id` else NULL end); STORED GENERATED |

Ràng buộc: `CHECK: ck_account_token_expiry`; `CHECK: ck_account_token_issue_source`; `CHECK: ck_account_token_purpose`; `FOREIGN KEY: fk_account_token_user`; `PRIMARY KEY: PRIMARY`; `UNIQUE: uq_account_token_current`; `UNIQUE: uq_account_token_hash`.

### auth_rate_limit_buckets

| Cột | Kiểu SQL | NULL | Mặc định / sinh tự động |
|---|---|---|---|
| `action` | `varchar(50)` | Không | — |
| `scope` | `varchar(24)` | Không | — |
| `subject_hash` | `binary(32)` | Không | — |
| `window_start` | `datetime(6)` | Không | — |
| `window_end` | `datetime(6)` | Không | — |
| `request_count` | `int` | Không | 1 |

Ràng buộc: `CHECK: ck_rate_window`; `PRIMARY KEY: PRIMARY`.

### auth_sessions

| Cột | Kiểu SQL | NULL | Mặc định / sinh tự động |
|---|---|---|---|
| `id` | `char(36)` | Không | — |
| `user_id` | `char(36)` | Không | — |
| `device_label` | `varchar(255)` | Có | — |
| `user_agent` | `text` | Có | — |
| `created_at` | `datetime(6)` | Không | — |
| `expires_at` | `datetime(6)` | Không | — |
| `last_seen_at` | `datetime(6)` | Không | — |
| `revoked_at` | `datetime(6)` | Có | — |
| `revocation_reason` | `varchar(100)` | Có | — |

Ràng buộc: `CHECK: ck_session_expiry`; `CHECK: ck_session_revocation`; `FOREIGN KEY: fk_session_user`; `PRIMARY KEY: PRIMARY`.

### outbox_events

| Cột | Kiểu SQL | NULL | Mặc định / sinh tự động |
|---|---|---|---|
| `event_id` | `char(36)` | Không | — |
| `aggregate_type` | `varchar(80)` | Không | — |
| `aggregate_id` | `varchar(64)` | Không | — |
| `aggregate_version` | `bigint` | Không | — |
| `event_type` | `varchar(120)` | Không | — |
| `schema_version` | `int` | Không | 1 |
| `occurred_at` | `datetime(6)` | Không | — |
| `payload` | `json` | Không | — |
| `sensitive_payload` | `mediumblob` | Có | — |
| `encryption_key_id` | `varchar(100)` | Có | — |
| `correlation_id` | `char(36)` | Có | — |
| `status` | `varchar(16)` | Không | PENDING |
| `available_at` | `datetime(6)` | Không | CURRENT_TIMESTAMP(6); DEFAULT_GENERATED |
| `attempts` | `int` | Không | 0 |
| `locked_by` | `varchar(100)` | Có | — |
| `locked_until` | `datetime(6)` | Có | — |
| `published_at` | `datetime(6)` | Có | — |
| `last_error_safe` | `varchar(500)` | Có | — |

Ràng buộc: `CHECK: ck_outbox_encryption`; `CHECK: ck_outbox_lease`; `CHECK: ck_outbox_numbers`; `CHECK: ck_outbox_status`; `PRIMARY KEY: PRIMARY`.

### processed_events

| Cột | Kiểu SQL | NULL | Mặc định / sinh tự động |
|---|---|---|---|
| `consumer_name` | `varchar(100)` | Không | — |
| `event_id` | `char(36)` | Không | — |
| `event_type` | `varchar(120)` | Không | — |
| `processed_at` | `datetime(6)` | Không | CURRENT_TIMESTAMP(6); DEFAULT_GENERATED |

Ràng buộc: `PRIMARY KEY: PRIMARY`.

### refresh_tokens

| Cột | Kiểu SQL | NULL | Mặc định / sinh tự động |
|---|---|---|---|
| `id` | `char(36)` | Không | — |
| `session_id` | `char(36)` | Không | — |
| `token_hash` | `binary(32)` | Không | — |
| `created_at` | `datetime(6)` | Không | — |
| `consumed_at` | `datetime(6)` | Có | — |
| `revoked_at` | `datetime(6)` | Có | — |
| `replaced_by_id` | `char(36)` | Có | — |
| `active_session_id` | `char(36)` | Có | (case when ((`consumed_at` is null) and (`revoked_at` is null)) then `session_id` else NULL end); STORED GENERATED |

Ràng buộc: `CHECK: ck_refresh_replacement`; `CHECK: ck_refresh_time`; `FOREIGN KEY: fk_refresh_replacement`; `FOREIGN KEY: fk_refresh_session`; `PRIMARY KEY: PRIMARY`; `UNIQUE: uq_refresh_current`; `UNIQUE: uq_refresh_hash`; `UNIQUE: uq_refresh_session_id`.

### service_metadata

| Cột | Kiểu SQL | NULL | Mặc định / sinh tự động |
|---|---|---|---|
| `service_name` | `varchar(64)` | Không | — |
| `initialized_at` | `timestamp(6)` | Không | CURRENT_TIMESTAMP(6); DEFAULT_GENERATED |

Ràng buộc: `PRIMARY KEY: PRIMARY`.

### user_avatars

| Cột | Kiểu SQL | NULL | Mặc định / sinh tự động |
|---|---|---|---|
| `user_id` | `char(36)` | Không | — |
| `image_data` | `mediumblob` | Không | — |

Ràng buộc: `CHECK: ck_avatar_size`; `FOREIGN KEY: fk_avatar_user`; `PRIMARY KEY: PRIMARY`.

### users

| Cột | Kiểu SQL | NULL | Mặc định / sinh tự động |
|---|---|---|---|
| `id` | `char(36)` | Không | — |
| `full_name` | `varchar(100)` | Không | — |
| `email` | `varchar(255)` | Không | — |
| `password_hash` | `varchar(255)` | Không | — |
| `is_email_verified` | `tinyint(1)` | Không | 0 |
| `email_verified_at` | `datetime(6)` | Có | — |
| `avatar_storage_key` | `varchar(500)` | Có | — |
| `avatar_mime_type` | `varchar(100)` | Có | — |
| `avatar_size_bytes` | `bigint` | Có | — |
| `version` | `bigint` | Không | 0 |
| `created_at` | `datetime(6)` | Không | CURRENT_TIMESTAMP(6); DEFAULT_GENERATED |
| `updated_at` | `datetime(6)` | Không | CURRENT_TIMESTAMP(6); DEFAULT_GENERATED |
| `job_title` | `varchar(100)` | Không |  |
| `bio` | `varchar(500)` | Không |  |

Ràng buộc: `CHECK: ck_user_avatar`; `CHECK: ck_user_email`; `CHECK: ck_user_name`; `CHECK: ck_user_verified`; `CHECK: ck_user_version`; `PRIMARY KEY: PRIMARY`; `UNIQUE: uq_users_email`.

## Work — V1, V2, V3, V4

### activity_logs

| Cột | Kiểu SQL | NULL | Mặc định / sinh tự động |
|---|---|---|---|
| `id` | `bigint` | Không | —; auto_increment |
| `project_id` | `bigint` | Không | — |
| `task_id` | `bigint` | Có | — |
| `actor_user_id` | `char(36)` | Có | — |
| `action` | `varchar(100)` | Không | — |
| `entity_type` | `varchar(60)` | Không | — |
| `entity_id` | `varchar(64)` | Không | — |
| `entity_version` | `bigint` | Có | — |
| `before_data` | `json` | Có | — |
| `after_data` | `json` | Có | — |
| `reason` | `text` | Có | — |
| `created_at` | `datetime(6)` | Không | CURRENT_TIMESTAMP(6); DEFAULT_GENERATED |

Ràng buộc: `FOREIGN KEY: fk_activity_project`; `FOREIGN KEY: fk_activity_task`; `PRIMARY KEY: PRIMARY`.

### comment_attachments

| Cột | Kiểu SQL | NULL | Mặc định / sinh tự động |
|---|---|---|---|
| `project_id` | `bigint` | Không | — |
| `task_id` | `bigint` | Không | — |
| `comment_id` | `bigint` | Không | — |
| `slot_no` | `tinyint` | Không | — |
| `stored_file_id` | `bigint` | Không | — |
| `file_kind` | `varchar(20)` | Không | COMMENT_IMAGE |
| `created_at` | `datetime(6)` | Không | CURRENT_TIMESTAMP(6); DEFAULT_GENERATED |

Ràng buộc: `CHECK: ck_attachment_kind`; `CHECK: ck_attachment_slot`; `FOREIGN KEY: fk_attachment_comment`; `FOREIGN KEY: fk_attachment_file`; `PRIMARY KEY: PRIMARY`; `UNIQUE: uq_comment_attachment_file`.

### comment_mentions

| Cột | Kiểu SQL | NULL | Mặc định / sinh tự động |
|---|---|---|---|
| `project_id` | `bigint` | Không | — |
| `task_id` | `bigint` | Không | — |
| `comment_id` | `bigint` | Không | — |
| `mentioned_user_id` | `char(36)` | Không | — |
| `slot_no` | `tinyint` | Không | — |
| `active_slot` | `tinyint` | Có | (case when (`removed_at` is null) then `slot_no` else NULL end); STORED GENERATED |
| `created_at` | `datetime(6)` | Không | CURRENT_TIMESTAMP(6); DEFAULT_GENERATED |
| `removed_at` | `datetime(6)` | Có | — |
| `first_notified_at` | `datetime(6)` | Có | — |
| `first_notification_event_id` | `char(36)` | Có | — |

Ràng buộc: `CHECK: ck_mention_notified`; `CHECK: ck_mention_slot`; `FOREIGN KEY: fk_mention_comment`; `FOREIGN KEY: fk_mention_member`; `PRIMARY KEY: PRIMARY`; `UNIQUE: uq_mention_active_slot`.

### outbox_events

| Cột | Kiểu SQL | NULL | Mặc định / sinh tự động |
|---|---|---|---|
| `event_id` | `char(36)` | Không | — |
| `aggregate_type` | `varchar(80)` | Không | — |
| `aggregate_id` | `varchar(64)` | Không | — |
| `aggregate_version` | `bigint` | Không | — |
| `event_type` | `varchar(120)` | Không | — |
| `schema_version` | `int` | Không | 1 |
| `occurred_at` | `datetime(6)` | Không | — |
| `payload` | `json` | Không | — |
| `sensitive_payload` | `mediumblob` | Có | — |
| `encryption_key_id` | `varchar(100)` | Có | — |
| `correlation_id` | `char(36)` | Có | — |
| `status` | `varchar(16)` | Không | PENDING |
| `available_at` | `datetime(6)` | Không | CURRENT_TIMESTAMP(6); DEFAULT_GENERATED |
| `attempts` | `int` | Không | 0 |
| `locked_by` | `varchar(100)` | Có | — |
| `locked_until` | `datetime(6)` | Có | — |
| `published_at` | `datetime(6)` | Có | — |
| `last_error_safe` | `varchar(500)` | Có | — |

Ràng buộc: `CHECK: ck_outbox_encryption`; `CHECK: ck_outbox_lease`; `CHECK: ck_outbox_numbers`; `CHECK: ck_outbox_status`; `PRIMARY KEY: PRIMARY`.

### processed_events

| Cột | Kiểu SQL | NULL | Mặc định / sinh tự động |
|---|---|---|---|
| `consumer_name` | `varchar(100)` | Không | — |
| `event_id` | `char(36)` | Không | — |
| `event_type` | `varchar(120)` | Không | — |
| `processed_at` | `datetime(6)` | Không | CURRENT_TIMESTAMP(6); DEFAULT_GENERATED |

Ràng buộc: `PRIMARY KEY: PRIMARY`.

### project_invitation_links

| Cột | Kiểu SQL | NULL | Mặc định / sinh tự động |
|---|---|---|---|
| `id` | `bigint` | Không | —; auto_increment |
| `project_id` | `bigint` | Không | — |
| `public_code` | `char(64)` | Không | — |
| `status` | `varchar(10)` | Không | ACTIVE |
| `created_by` | `char(36)` | Không | — |
| `created_at` | `datetime(6)` | Không | — |
| `revoked_at` | `datetime(6)` | Có | — |
| `revocation_reason` | `varchar(100)` | Có | — |
| `active_project_id` | `bigint` | Có | (case when (`status` = _ascii\\'ACTIVE\\') then `project_id` else NULL end); STORED GENERATED |

Ràng buộc: `CHECK: ck_join_link_revocation`; `CHECK: ck_join_link_status`; `FOREIGN KEY: fk_join_link_project`; `PRIMARY KEY: PRIMARY`; `UNIQUE: uq_join_link_active`; `UNIQUE: uq_join_link_code`; `UNIQUE: uq_join_link_project`.

### project_invitations

| Cột | Kiểu SQL | NULL | Mặc định / sinh tự động |
|---|---|---|---|
| `id` | `bigint` | Không | —; auto_increment |
| `project_id` | `bigint` | Không | — |
| `invitee_user_id` | `char(36)` | Không | — |
| `invited_by` | `char(36)` | Không | — |
| `status` | `varchar(12)` | Không | PENDING |
| `created_at` | `datetime(6)` | Không | — |
| `expires_at` | `datetime(6)` | Không | — |
| `resolved_at` | `datetime(6)` | Có | — |
| `resolved_by` | `char(36)` | Có | — |
| `pending_invitee_id` | `char(36)` | Có | (case when (`status` = _ascii\\'PENDING\\') then `invitee_user_id` else NULL end); STORED GENERATED |

Ràng buộc: `CHECK: ck_invitation_expiry`; `CHECK: ck_invitation_resolved`; `CHECK: ck_invitation_status`; `FOREIGN KEY: fk_invitation_project`; `PRIMARY KEY: PRIMARY`; `UNIQUE: uq_invitation_pending`.

### project_join_requests

| Cột | Kiểu SQL | NULL | Mặc định / sinh tự động |
|---|---|---|---|
| `id` | `bigint` | Không | —; auto_increment |
| `project_id` | `bigint` | Không | — |
| `user_id` | `char(36)` | Không | — |
| `invitation_link_id` | `bigint` | Không | — |
| `reason` | `varchar(500)` | Có | — |
| `status` | `varchar(12)` | Không | PENDING |
| `created_at` | `datetime(6)` | Không | — |
| `resolved_at` | `datetime(6)` | Có | — |
| `resolved_by` | `char(36)` | Có | — |
| `close_reason` | `varchar(100)` | Có | — |
| `pending_user_id` | `char(36)` | Có | (case when (`status` = _ascii\\'PENDING\\') then `user_id` else NULL end); STORED GENERATED |

Ràng buộc: `CHECK: ck_join_request_closed`; `CHECK: ck_join_request_resolved`; `CHECK: ck_join_request_status`; `FOREIGN KEY: fk_join_request_link`; `PRIMARY KEY: PRIMARY`; `UNIQUE: uq_join_request_pending`.

### project_memberships

| Cột | Kiểu SQL | NULL | Mặc định / sinh tự động |
|---|---|---|---|
| `project_id` | `bigint` | Không | — |
| `user_id` | `char(36)` | Không | — |
| `specialty` | `varchar(100)` | Có | — |
| `status` | `varchar(10)` | Không | ACTIVE |
| `joined_at` | `datetime(6)` | Không | — |
| `added_by` | `char(36)` | Không | — |
| `removed_at` | `datetime(6)` | Có | — |
| `removed_by` | `char(36)` | Có | — |

Ràng buộc: `CHECK: ck_member_removed`; `CHECK: ck_member_status`; `FOREIGN KEY: fk_member_project`; `PRIMARY KEY: PRIMARY`.

### project_resources

| Cột | Kiểu SQL | NULL | Mặc định / sinh tự động |
|---|---|---|---|
| `id` | `bigint` | Không | —; auto_increment |
| `project_id` | `bigint` | Không | — |
| `resource_type` | `varchar(8)` | Không | — |
| `title` | `varchar(150)` | Không | — |
| `description` | `varchar(500)` | Có | — |
| `stored_file_id` | `bigint` | Có | — |
| `file_kind` | `varchar(20)` | Có | — |
| `link_url` | `varchar(2048)` | Có | — |
| `created_by` | `char(36)` | Không | — |
| `creation_request_id` | `char(36)` | Không | — |
| `request_hash` | `binary(32)` | Không | — |
| `created_at` | `datetime(6)` | Không | CURRENT_TIMESTAMP(6); DEFAULT_GENERATED |
| `updated_at` | `datetime(6)` | Không | CURRENT_TIMESTAMP(6); DEFAULT_GENERATED |
| `deleted_at` | `datetime(6)` | Có | — |
| `deleted_by` | `char(36)` | Có | — |
| `version` | `bigint` | Không | 0 |

Ràng buộc: `CHECK: ck_resource_deleted`; `CHECK: ck_resource_kind`; `CHECK: ck_resource_link`; `CHECK: ck_resource_title`; `CHECK: ck_resource_version`; `FOREIGN KEY: fk_resource_creator`; `FOREIGN KEY: fk_resource_deleter`; `FOREIGN KEY: fk_resource_file`; `FOREIGN KEY: fk_resource_project`; `PRIMARY KEY: PRIMARY`; `UNIQUE: uq_resource_file`; `UNIQUE: uq_resource_request`.

### project_storage_usage

| Cột | Kiểu SQL | NULL | Mặc định / sinh tự động |
|---|---|---|---|
| `project_id` | `bigint` | Không | — |
| `limit_bytes` | `bigint` | Không | 524288000 |
| `used_bytes` | `bigint` | Không | 0 |
| `reserved_bytes` | `bigint` | Không | 0 |
| `version` | `bigint` | Không | 0 |
| `updated_at` | `datetime(6)` | Không | CURRENT_TIMESTAMP(6); DEFAULT_GENERATED |

Ràng buộc: `CHECK: ck_storage_quota`; `CHECK: ck_storage_version`; `FOREIGN KEY: fk_storage_project`; `PRIMARY KEY: PRIMARY`.

### projects

| Cột | Kiểu SQL | NULL | Mặc định / sinh tự động |
|---|---|---|---|
| `id` | `bigint` | Không | —; auto_increment |
| `owner_user_id` | `char(36)` | Không | — |
| `manager_user_id` | `char(36)` | Có | — |
| `name` | `varchar(100)` | Không | — |
| `description` | `varchar(500)` | Không | — |
| `avatar_storage_key` | `varchar(500)` | Có | — |
| `avatar_mime_type` | `varchar(100)` | Có | — |
| `avatar_size_bytes` | `bigint` | Có | — |
| `starts_on` | `date` | Không | — |
| `ends_on` | `date` | Không | — |
| `status` | `varchar(12)` | Không | ACTIVE |
| `archived_at` | `datetime(6)` | Có | — |
| `archived_by` | `char(36)` | Có | — |
| `version` | `bigint` | Không | 0 |
| `created_at` | `datetime(6)` | Không | CURRENT_TIMESTAMP(6); DEFAULT_GENERATED |
| `updated_at` | `datetime(6)` | Không | CURRENT_TIMESTAMP(6); DEFAULT_GENERATED |
| `active_name` | `varchar(100)` | Có | (case when (`status` = _ascii\\'ACTIVE\\') then trim(`name`) else NULL end); STORED GENERATED |

Ràng buộc: `CHECK: ck_project_archive`; `CHECK: ck_project_avatar`; `CHECK: ck_project_dates`; `CHECK: ck_project_description`; `CHECK: ck_project_manager`; `CHECK: ck_project_name`; `CHECK: ck_project_status`; `CHECK: ck_project_version`; `PRIMARY KEY: PRIMARY`; `UNIQUE: uq_project_active_name`.

### service_metadata

| Cột | Kiểu SQL | NULL | Mặc định / sinh tự động |
|---|---|---|---|
| `service_name` | `varchar(64)` | Không | — |
| `initialized_at` | `timestamp(6)` | Không | CURRENT_TIMESTAMP(6); DEFAULT_GENERATED |

Ràng buộc: `PRIMARY KEY: PRIMARY`.

### stored_files

| Cột | Kiểu SQL | NULL | Mặc định / sinh tự động |
|---|---|---|---|
| `id` | `bigint` | Không | —; auto_increment |
| `project_id` | `bigint` | Không | — |
| `uploaded_by` | `char(36)` | Không | — |
| `upload_request_id` | `char(36)` | Không | — |
| `request_hash` | `binary(32)` | Không | — |
| `storage_key` | `varchar(500)` | Không | — |
| `original_name` | `varchar(255)` | Không | — |
| `file_kind` | `varchar(20)` | Không | — |
| `mime_type` | `varchar(100)` | Không | — |
| `size_bytes` | `bigint` | Không | — |
| `content_sha256` | `binary(32)` | Có | — |
| `status` | `varchar(20)` | Không | UPLOADING |
| `created_at` | `datetime(6)` | Không | CURRENT_TIMESTAMP(6); DEFAULT_GENERATED |
| `temporary_expires_at` | `datetime(6)` | Không | — |
| `ready_at` | `datetime(6)` | Có | — |
| `attached_at` | `datetime(6)` | Có | — |
| `deleted_at` | `datetime(6)` | Có | — |
| `deleted_by` | `char(36)` | Có | — |
| `purge_after` | `datetime(6)` | Có | — |
| `purged_at` | `datetime(6)` | Có | — |
| `version` | `bigint` | Không | 0 |

Ràng buộc: `CHECK: ck_file_attached`; `CHECK: ck_file_deleted`; `CHECK: ck_file_kind`; `CHECK: ck_file_mime`; `CHECK: ck_file_name`; `CHECK: ck_file_purge`; `CHECK: ck_file_purged`; `CHECK: ck_file_ready`; `CHECK: ck_file_size`; `CHECK: ck_file_status`; `CHECK: ck_file_temp_expiry`; `CHECK: ck_file_version`; `FOREIGN KEY: fk_file_deleted_by`; `FOREIGN KEY: fk_file_project`; `FOREIGN KEY: fk_file_uploader`; `PRIMARY KEY: PRIMARY`; `UNIQUE: uq_file_project_kind`; `UNIQUE: uq_file_storage`; `UNIQUE: uq_file_upload_request`.

### task_alerts

| Cột | Kiểu SQL | NULL | Mặc định / sinh tự động |
|---|---|---|---|
| `id` | `bigint` | Không | —; auto_increment |
| `project_id` | `bigint` | Không | — |
| `task_id` | `bigint` | Không | — |
| `alert_type` | `varchar(20)` | Không | — |
| `submission_id` | `bigint` | Có | — |
| `dedupe_scope` | `bigint` | Có | coalesce(`submission_id`,0); STORED GENERATED |
| `observed_microseconds` | `bigint` | Có | — |
| `estimated_seconds_snapshot` | `bigint` | Có | — |
| `deadline_on_snapshot` | `date` | Có | — |
| `raised_at` | `datetime(6)` | Không | — |

Ràng buộc: `CHECK: ck_alert_numbers`; `CHECK: ck_alert_scope`; `CHECK: ck_alert_type`; `FOREIGN KEY: fk_alert_submission`; `FOREIGN KEY: fk_alert_task`; `PRIMARY KEY: PRIMARY`; `UNIQUE: uq_task_alert`.

### task_comments

| Cột | Kiểu SQL | NULL | Mặc định / sinh tự động |
|---|---|---|---|
| `id` | `bigint` | Không | —; auto_increment |
| `project_id` | `bigint` | Không | — |
| `task_id` | `bigint` | Không | — |
| `author_user_id` | `char(36)` | Không | — |
| `body` | `text` | Có | — |
| `created_at` | `datetime(6)` | Không | CURRENT_TIMESTAMP(6); DEFAULT_GENERATED |
| `edited_at` | `datetime(6)` | Có | — |
| `deleted_at` | `datetime(6)` | Có | — |
| `version` | `bigint` | Không | 0 |
| `parent_comment_id` | `bigint` | Có | — |
| `thread_level` | `tinyint` | Không | 0 |
| `parent_thread_level` | `tinyint` | Có | — |
| `image_count` | `tinyint` | Không | 0 |
| `deleted_by` | `char(36)` | Có | — |
| `creation_request_id` | `char(36)` | Không | — |
| `request_hash` | `binary(32)` | Không | — |

Ràng buộc: `CHECK: ck_comment_body`; `CHECK: ck_comment_deleted`; `CHECK: ck_comment_images`; `CHECK: ck_comment_thread`; `CHECK: ck_comment_version`; `FOREIGN KEY: fk_comment_author`; `FOREIGN KEY: fk_comment_deleter`; `FOREIGN KEY: fk_comment_parent`; `FOREIGN KEY: fk_comment_task`; `PRIMARY KEY: PRIMARY`; `UNIQUE: uq_comment_project_task`; `UNIQUE: uq_comment_request`; `UNIQUE: uq_comment_thread`.

### task_submissions

| Cột | Kiểu SQL | NULL | Mặc định / sinh tự động |
|---|---|---|---|
| `id` | `bigint` | Không | —; auto_increment |
| `project_id` | `bigint` | Không | — |
| `task_id` | `bigint` | Không | — |
| `submission_no` | `int` | Không | — |
| `submitted_by` | `char(36)` | Không | — |
| `assignee_user_id` | `char(36)` | Không | — |
| `result_note` | `text` | Không | — |
| `deadline_on_snapshot` | `date` | Không | — |
| `submitted_at` | `datetime(6)` | Không | — |
| `decision` | `varchar(10)` | Không | PENDING |
| `reviewed_by` | `char(36)` | Có | — |
| `reviewed_at` | `datetime(6)` | Có | — |
| `rejection_reason` | `text` | Có | — |
| `pending_task_id` | `bigint` | Có | (case when (`decision` = _ascii\\'PENDING\\') then `task_id` else NULL end); STORED GENERATED |

Ràng buộc: `CHECK: ck_submission_decision`; `CHECK: ck_submission_note`; `CHECK: ck_submission_number`; `CHECK: ck_submission_rejection`; `CHECK: ck_submission_review`; `FOREIGN KEY: fk_submission_task`; `PRIMARY KEY: PRIMARY`; `UNIQUE: uq_submission_number`; `UNIQUE: uq_submission_pending`; `UNIQUE: uq_submission_task_id`.

### tasks

| Cột | Kiểu SQL | NULL | Mặc định / sinh tự động |
|---|---|---|---|
| `id` | `bigint` | Không | —; auto_increment |
| `project_id` | `bigint` | Không | — |
| `name` | `varchar(100)` | Không | — |
| `normalized_name` | `varchar(100)` | Có | trim(`name`); STORED GENERATED |
| `description` | `text` | Có | — |
| `assignee_user_id` | `char(36)` | Không | — |
| `created_by` | `char(36)` | Không | — |
| `priority` | `varchar(8)` | Không | MEDIUM |
| `status` | `varchar(16)` | Không | TODO |
| `starts_on` | `date` | Không | — |
| `deadline_on` | `date` | Không | — |
| `estimated_seconds` | `bigint` | Không | — |
| `is_blocked` | `tinyint(1)` | Không | 0 |
| `blocked_reason` | `text` | Có | — |
| `latest_submission_id` | `bigint` | Có | — |
| `accepted_submission_id` | `bigint` | Có | — |
| `completed_at` | `datetime(6)` | Có | — |
| `cancelled_at` | `datetime(6)` | Có | — |
| `cancellation_reason` | `text` | Có | — |
| `version` | `bigint` | Không | 0 |
| `created_at` | `datetime(6)` | Không | CURRENT_TIMESTAMP(6); DEFAULT_GENERATED |
| `updated_at` | `datetime(6)` | Không | CURRENT_TIMESTAMP(6); DEFAULT_GENERATED |

Ràng buộc: `CHECK: ck_task_blocked`; `CHECK: ck_task_cancelled`; `CHECK: ck_task_completed`; `CHECK: ck_task_dates`; `CHECK: ck_task_estimate`; `CHECK: ck_task_name`; `CHECK: ck_task_priority`; `CHECK: ck_task_review`; `CHECK: ck_task_status`; `CHECK: ck_task_version`; `FOREIGN KEY: fk_task_accepted_submission`; `FOREIGN KEY: fk_task_assignee`; `FOREIGN KEY: fk_task_creator`; `FOREIGN KEY: fk_task_latest_submission`; `FOREIGN KEY: fk_task_project`; `PRIMARY KEY: PRIMARY`; `UNIQUE: uq_task_name`; `UNIQUE: uq_task_project_id`.

### time_entries

| Cột | Kiểu SQL | NULL | Mặc định / sinh tự động |
|---|---|---|---|
| `id` | `bigint` | Không | —; auto_increment |
| `project_id` | `bigint` | Không | — |
| `task_id` | `bigint` | Không | — |
| `user_id` | `char(36)` | Không | — |
| `source` | `varchar(8)` | Không | — |
| `started_at` | `datetime(6)` | Không | — |
| `ended_at` | `datetime(6)` | Có | — |
| `manual_reason` | `text` | Có | — |
| `created_by` | `char(36)` | Không | — |
| `updated_by` | `char(36)` | Không | — |
| `created_at` | `datetime(6)` | Không | CURRENT_TIMESTAMP(6); DEFAULT_GENERATED |
| `updated_at` | `datetime(6)` | Không | CURRENT_TIMESTAMP(6); DEFAULT_GENERATED |
| `version` | `bigint` | Không | 0 |
| `duration_microseconds` | `bigint` | Có | timestampdiff(MICROSECOND,`started_at`,`ended_at`); STORED GENERATED |
| `running_user_id` | `char(36)` | Có | (case when (`ended_at` is null) then `user_id` else NULL end); STORED GENERATED |

Ràng buộc: `CHECK: ck_time_manual`; `CHECK: ck_time_range`; `CHECK: ck_time_source`; `CHECK: ck_time_version`; `FOREIGN KEY: fk_time_member`; `FOREIGN KEY: fk_time_task`; `PRIMARY KEY: PRIMARY`; `UNIQUE: uq_time_running_user`.

### time_entry_locks

| Cột | Kiểu SQL | NULL | Mặc định / sinh tự động |
|---|---|---|---|
| `user_id` | `char(36)` | Không | — |

Ràng buộc: `PRIMARY KEY: PRIMARY`.

### time_entry_revisions

| Cột | Kiểu SQL | NULL | Mặc định / sinh tự động |
|---|---|---|---|
| `id` | `bigint` | Không | —; auto_increment |
| `time_entry_id` | `bigint` | Không | — |
| `revised_by` | `char(36)` | Không | — |
| `before_started_at` | `datetime(6)` | Không | — |
| `before_ended_at` | `datetime(6)` | Có | — |
| `after_started_at` | `datetime(6)` | Không | — |
| `after_ended_at` | `datetime(6)` | Có | — |
| `reason` | `text` | Không | — |
| `revised_at` | `datetime(6)` | Không | — |

Ràng buộc: `CHECK: ck_time_revision_ranges`; `CHECK: ck_time_revision_reason`; `FOREIGN KEY: fk_time_revision`; `PRIMARY KEY: PRIMARY`.

## Notification — V1, V2, V3, V4

### email_delivery_attempts

| Cột | Kiểu SQL | NULL | Mặc định / sinh tự động |
|---|---|---|---|
| `id` | `bigint` | Không | —; auto_increment |
| `email_job_id` | `bigint` | Không | — |
| `attempt_no` | `int` | Không | — |
| `started_at` | `datetime(6)` | Không | — |
| `finished_at` | `datetime(6)` | Có | — |
| `result` | `varchar(24)` | Có | — |
| `provider_message_id` | `varchar(255)` | Có | — |
| `error_code` | `varchar(100)` | Có | — |
| `error_safe` | `varchar(500)` | Có | — |

Ràng buộc: `CHECK: ck_email_attempt_finished`; `CHECK: ck_email_attempt_number`; `CHECK: ck_email_attempt_result`; `FOREIGN KEY: fk_email_attempt_job`; `PRIMARY KEY: PRIMARY`; `UNIQUE: uq_email_attempt`.

### email_jobs

| Cột | Kiểu SQL | NULL | Mặc định / sinh tự động |
|---|---|---|---|
| `id` | `bigint` | Không | —; auto_increment |
| `event_id` | `char(36)` | Không | — |
| `recipient_user_id` | `char(36)` | Không | — |
| `recipient_email` | `varchar(255)` | Không | — |
| `event_type` | `varchar(120)` | Không | — |
| `purpose` | `varchar(24)` | Không | — |
| `notification_id` | `bigint` | Có | — |
| `template_key` | `varchar(100)` | Không | — |
| `template_version` | `int` | Không | 1 |
| `template_data` | `json` | Không | — |
| `sensitive_data` | `mediumblob` | Có | — |
| `encryption_key_id` | `varchar(100)` | Có | — |
| `status` | `varchar(16)` | Không | QUEUED |
| `attempt_count` | `int` | Không | 0 |
| `next_attempt_at` | `datetime(6)` | Không | CURRENT_TIMESTAMP(6); DEFAULT_GENERATED |
| `locked_by` | `varchar(100)` | Có | — |
| `locked_until` | `datetime(6)` | Có | — |
| `provider_message_id` | `varchar(255)` | Có | — |
| `created_at` | `datetime(6)` | Không | CURRENT_TIMESTAMP(6); DEFAULT_GENERATED |
| `expires_at` | `datetime(6)` | Có | — |
| `accepted_at` | `datetime(6)` | Có | — |
| `delivered_at` | `datetime(6)` | Có | — |
| `last_error_safe` | `varchar(500)` | Có | — |
| `recipient_reasons` | `json` | Không | json_array(); DEFAULT_GENERATED |

Ràng buộc: `CHECK: ck_email_comment_reasons`; `CHECK: ck_email_encryption`; `CHECK: ck_email_expiry`; `CHECK: ck_email_lease`; `CHECK: ck_email_numbers`; `CHECK: ck_email_purpose`; `CHECK: ck_email_recipient_reasons`; `CHECK: ck_email_status`; `FOREIGN KEY: fk_email_notification`; `PRIMARY KEY: PRIMARY`; `UNIQUE: uq_email_recipient_event`.

### email_provider_events

| Cột | Kiểu SQL | NULL | Mặc định / sinh tự động |
|---|---|---|---|
| `dedupe_hash` | `binary(32)` | Không | — |
| `provider` | `varchar(30)` | Không | BREVO |
| `provider_event_id` | `varchar(255)` | Có | — |
| `provider_message_id` | `varchar(255)` | Không | — |
| `email_job_id` | `bigint` | Có | — |
| `event_type` | `varchar(80)` | Không | — |
| `occurred_at` | `datetime(6)` | Không | — |
| `received_at` | `datetime(6)` | Không | CURRENT_TIMESTAMP(6); DEFAULT_GENERATED |

Ràng buộc: `FOREIGN KEY: fk_provider_event_job`; `PRIMARY KEY: PRIMARY`; `UNIQUE: uq_provider_event`.

### notifications

| Cột | Kiểu SQL | NULL | Mặc định / sinh tự động |
|---|---|---|---|
| `id` | `bigint` | Không | —; auto_increment |
| `recipient_user_id` | `char(36)` | Không | — |
| `event_id` | `char(36)` | Không | — |
| `event_type` | `varchar(120)` | Không | — |
| `actor_user_id` | `char(36)` | Có | — |
| `project_id` | `bigint` | Có | — |
| `task_id` | `bigint` | Có | — |
| `resource_type` | `varchar(60)` | Không | — |
| `resource_id` | `varchar(64)` | Không | — |
| `title` | `varchar(255)` | Không | — |
| `body` | `text` | Không | — |
| `created_at` | `datetime(6)` | Không | CURRENT_TIMESTAMP(6); DEFAULT_GENERATED |
| `read_at` | `datetime(6)` | Có | — |
| `recipient_reasons` | `json` | Không | json_array(); DEFAULT_GENERATED |

Ràng buộc: `CHECK: ck_notification_read`; `CHECK: ck_notification_reasons`; `PRIMARY KEY: PRIMARY`; `UNIQUE: uq_notification_delivery`; `UNIQUE: uq_notification_recipient_event`.

### outbox_events

| Cột | Kiểu SQL | NULL | Mặc định / sinh tự động |
|---|---|---|---|
| `event_id` | `char(36)` | Không | — |
| `aggregate_type` | `varchar(80)` | Không | — |
| `aggregate_id` | `varchar(64)` | Không | — |
| `aggregate_version` | `bigint` | Không | — |
| `event_type` | `varchar(120)` | Không | — |
| `schema_version` | `int` | Không | 1 |
| `occurred_at` | `datetime(6)` | Không | — |
| `payload` | `json` | Không | — |
| `sensitive_payload` | `mediumblob` | Có | — |
| `encryption_key_id` | `varchar(100)` | Có | — |
| `correlation_id` | `char(36)` | Có | — |
| `status` | `varchar(16)` | Không | PENDING |
| `available_at` | `datetime(6)` | Không | CURRENT_TIMESTAMP(6); DEFAULT_GENERATED |
| `attempts` | `int` | Không | 0 |
| `locked_by` | `varchar(100)` | Có | — |
| `locked_until` | `datetime(6)` | Có | — |
| `published_at` | `datetime(6)` | Có | — |
| `last_error_safe` | `varchar(500)` | Có | — |

Ràng buộc: `CHECK: ck_outbox_encryption`; `CHECK: ck_outbox_lease`; `CHECK: ck_outbox_numbers`; `CHECK: ck_outbox_status`; `PRIMARY KEY: PRIMARY`.

### processed_events

| Cột | Kiểu SQL | NULL | Mặc định / sinh tự động |
|---|---|---|---|
| `consumer_name` | `varchar(100)` | Không | — |
| `event_id` | `char(36)` | Không | — |
| `event_type` | `varchar(120)` | Không | — |
| `processed_at` | `datetime(6)` | Không | CURRENT_TIMESTAMP(6); DEFAULT_GENERATED |

Ràng buộc: `PRIMARY KEY: PRIMARY`.

### recipient_contacts

| Cột | Kiểu SQL | NULL | Mặc định / sinh tự động |
|---|---|---|---|
| `user_id` | `char(36)` | Không | — |
| `email` | `varchar(255)` | Không | — |
| `full_name` | `varchar(100)` | Không | — |
| `is_email_verified` | `tinyint(1)` | Không | — |
| `source_version` | `bigint` | Không | — |
| `last_event_at` | `datetime(6)` | Không | — |

Ràng buộc: `CHECK: ck_contact_verified`; `CHECK: ck_contact_version`; `PRIMARY KEY: PRIMARY`.

### service_metadata

| Cột | Kiểu SQL | NULL | Mặc định / sinh tự động |
|---|---|---|---|
| `service_name` | `varchar(64)` | Không | — |
| `initialized_at` | `timestamp(6)` | Không | CURRENT_TIMESTAMP(6); DEFAULT_GENERATED |

Ràng buộc: `PRIMARY KEY: PRIMARY`.

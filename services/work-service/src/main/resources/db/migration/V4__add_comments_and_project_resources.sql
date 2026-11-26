-- RULE v2.0: comment images/replies/mentions and project documents/links.
-- Additive upgrade after UUID V3. Existing comments and project data are retained.
CREATE TABLE project_storage_usage (
    project_id BIGINT PRIMARY KEY,
    limit_bytes BIGINT NOT NULL DEFAULT 524288000,
    used_bytes BIGINT NOT NULL DEFAULT 0,
    reserved_bytes BIGINT NOT NULL DEFAULT 0,
    version BIGINT NOT NULL DEFAULT 0,
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_storage_project FOREIGN KEY (project_id) REFERENCES projects(id),
    CONSTRAINT ck_storage_quota CHECK (limit_bytes = 524288000 AND used_bytes >= 0 AND reserved_bytes >= 0 AND used_bytes + reserved_bytes <= limit_bytes),
    CONSTRAINT ck_storage_version CHECK (version >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;
INSERT INTO project_storage_usage(project_id) SELECT id FROM projects;

CREATE TABLE stored_files (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    project_id BIGINT NOT NULL,
    uploaded_by CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    upload_request_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    request_hash BINARY(32) NOT NULL,
    storage_key VARCHAR(500) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_kind VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    mime_type VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    size_bytes BIGINT NOT NULL,
    content_sha256 BINARY(32) NULL,
    status VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'UPLOADING',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    temporary_expires_at DATETIME(6) NOT NULL,
    ready_at DATETIME(6) NULL,
    attached_at DATETIME(6) NULL,
    deleted_at DATETIME(6) NULL,
    deleted_by CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    purge_after DATETIME(6) NULL,
    purged_at DATETIME(6) NULL,
    version BIGINT NOT NULL DEFAULT 0,
    UNIQUE KEY uq_file_storage (storage_key),
    UNIQUE KEY uq_file_upload_request (project_id, uploaded_by, upload_request_id),
    UNIQUE KEY uq_file_project_kind (project_id, id, file_kind),
    CONSTRAINT fk_file_project FOREIGN KEY (project_id) REFERENCES projects(id),
    CONSTRAINT fk_file_uploader FOREIGN KEY (project_id, uploaded_by) REFERENCES project_memberships(project_id, user_id),
    CONSTRAINT fk_file_deleted_by FOREIGN KEY (project_id, deleted_by) REFERENCES project_memberships(project_id, user_id),
    CONSTRAINT ck_file_kind CHECK (file_kind IN ('COMMENT_IMAGE','PROJECT_DOCUMENT')),
    CONSTRAINT ck_file_name CHECK (CHAR_LENGTH(TRIM(original_name)) BETWEEN 1 AND 255 AND CHAR_LENGTH(storage_key) > 0),
    CONSTRAINT ck_file_size CHECK (size_bytes > 0 AND ((file_kind = 'COMMENT_IMAGE' AND size_bytes <= 5242880) OR (file_kind = 'PROJECT_DOCUMENT' AND size_bytes <= 20971520))),
    CONSTRAINT ck_file_mime CHECK (mime_type IN ('image/png','image/jpeg','application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.presentationml.presentation','text/plain','text/csv','application/zip') AND (file_kind <> 'COMMENT_IMAGE' OR mime_type IN ('image/png','image/jpeg'))),
    CONSTRAINT ck_file_status CHECK (status IN ('UPLOADING','READY','FAILED','DELETE_PENDING','DELETED')),
    CONSTRAINT ck_file_ready CHECK (status <> 'READY' OR (ready_at IS NOT NULL AND content_sha256 IS NOT NULL)),
    CONSTRAINT ck_file_temp_expiry CHECK (temporary_expires_at = DATE_ADD(created_at, INTERVAL 24 HOUR)),
    CONSTRAINT ck_file_deleted CHECK ((status IN ('DELETE_PENDING','DELETED')) = (deleted_at IS NOT NULL) AND (deleted_at IS NULL) = (purge_after IS NULL) AND (deleted_at IS NOT NULL OR deleted_by IS NULL)),
    CONSTRAINT ck_file_purge CHECK (purge_after IS NULL OR purge_after = DATE_ADD(deleted_at, INTERVAL 24 HOUR)),
    CONSTRAINT ck_file_purged CHECK ((status = 'DELETED') = (purged_at IS NOT NULL)),
    CONSTRAINT ck_file_attached CHECK (attached_at IS NULL OR ready_at IS NOT NULL),
    CONSTRAINT ck_file_version CHECK (version >= 0),
    INDEX ix_file_cleanup (status, temporary_expires_at, id),
    INDEX ix_file_purge (status, purge_after, id),
    INDEX ix_file_project (project_id, status, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE project_resources (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    project_id BIGINT NOT NULL,
    resource_type VARCHAR(8) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    title VARCHAR(150) NOT NULL,
    description VARCHAR(500) NULL,
    stored_file_id BIGINT NULL,
    file_kind VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NULL,
    link_url VARCHAR(2048) NULL,
    created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    creation_request_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    request_hash BINARY(32) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    deleted_at DATETIME(6) NULL,
    deleted_by CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    version BIGINT NOT NULL DEFAULT 0,
    UNIQUE KEY uq_resource_file (stored_file_id),
    UNIQUE KEY uq_resource_request (project_id, created_by, creation_request_id),
    CONSTRAINT fk_resource_project FOREIGN KEY (project_id) REFERENCES projects(id),
    CONSTRAINT fk_resource_file FOREIGN KEY (project_id, stored_file_id, file_kind) REFERENCES stored_files(project_id, id, file_kind),
    CONSTRAINT fk_resource_creator FOREIGN KEY (project_id, created_by) REFERENCES project_memberships(project_id, user_id),
    CONSTRAINT fk_resource_deleter FOREIGN KEY (project_id, deleted_by) REFERENCES project_memberships(project_id, user_id),
    CONSTRAINT ck_resource_title CHECK (CHAR_LENGTH(TRIM(title)) BETWEEN 1 AND 150),
    CONSTRAINT ck_resource_kind CHECK ((resource_type = 'FILE' AND stored_file_id IS NOT NULL AND file_kind IS NOT NULL AND file_kind = 'PROJECT_DOCUMENT' AND link_url IS NULL) OR (resource_type = 'LINK' AND stored_file_id IS NULL AND file_kind IS NULL AND link_url IS NOT NULL)),
    CONSTRAINT ck_resource_link CHECK (link_url IS NULL OR (REGEXP_LIKE(link_url, '^https?://[^/?#[:space:]]+', 'i') AND NOT REGEXP_LIKE(link_url, '^https?://[^/?#]*@', 'i') AND NOT REGEXP_LIKE(link_url, '[[:space:]]'))),
    CONSTRAINT ck_resource_deleted CHECK ((deleted_at IS NULL) = (deleted_by IS NULL)),
    CONSTRAINT ck_resource_version CHECK (version >= 0),
    INDEX ix_resource_project (project_id, deleted_at, created_at, id),
    INDEX ix_resource_type (project_id, resource_type, deleted_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

ALTER TABLE task_comments
    DROP CHECK ck_comment_body,
    ADD COLUMN parent_comment_id BIGINT NULL,
    ADD COLUMN thread_level TINYINT NOT NULL DEFAULT 0,
    ADD COLUMN parent_thread_level TINYINT NULL,
    ADD COLUMN image_count TINYINT NOT NULL DEFAULT 0,
    ADD COLUMN deleted_by CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    ADD COLUMN creation_request_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    ADD COLUMN request_hash BINARY(32) NULL;
UPDATE task_comments SET creation_request_id = UUID(), request_hash = UNHEX(SHA2(CONCAT('legacy-comment:',id),256)), deleted_by = CASE WHEN deleted_at IS NOT NULL THEN author_user_id ELSE NULL END;
ALTER TABLE task_comments
    MODIFY COLUMN creation_request_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    MODIFY COLUMN request_hash BINARY(32) NOT NULL,
    ADD UNIQUE KEY uq_comment_project_task (project_id, task_id, id),
    ADD UNIQUE KEY uq_comment_thread (project_id, task_id, id, thread_level),
    ADD UNIQUE KEY uq_comment_request (project_id, author_user_id, creation_request_id);
-- Build the referenced unique index before installing the self-referencing FK.
ALTER TABLE task_comments
    ADD CONSTRAINT fk_comment_parent FOREIGN KEY (project_id, task_id, parent_comment_id, parent_thread_level) REFERENCES task_comments(project_id, task_id, id, thread_level),
    ADD CONSTRAINT fk_comment_deleter FOREIGN KEY (project_id, deleted_by) REFERENCES project_memberships(project_id, user_id),
    ADD CONSTRAINT ck_comment_thread CHECK ((parent_comment_id IS NULL AND thread_level = 0 AND parent_thread_level IS NULL) OR (parent_comment_id IS NOT NULL AND thread_level = 1 AND parent_thread_level IS NOT NULL AND parent_thread_level = 0)),
    ADD CONSTRAINT ck_comment_images CHECK (image_count BETWEEN 0 AND 5),
    ADD CONSTRAINT ck_comment_body CHECK ((deleted_at IS NOT NULL AND body IS NULL AND image_count = 0) OR (deleted_at IS NULL AND ((body IS NOT NULL AND CHAR_LENGTH(TRIM(body)) BETWEEN 1 AND 2000) OR (body IS NULL AND image_count > 0)))),
    ADD CONSTRAINT ck_comment_deleted CHECK ((deleted_at IS NULL) = (deleted_by IS NULL)),
    ADD INDEX ix_comment_replies (task_id, parent_comment_id, created_at, id);

CREATE TABLE comment_attachments (
    project_id BIGINT NOT NULL,
    task_id BIGINT NOT NULL,
    comment_id BIGINT NOT NULL,
    slot_no TINYINT NOT NULL,
    stored_file_id BIGINT NOT NULL,
    file_kind VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'COMMENT_IMAGE',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (comment_id, slot_no),
    UNIQUE KEY uq_comment_attachment_file (stored_file_id),
    CONSTRAINT fk_attachment_comment FOREIGN KEY (project_id, task_id, comment_id) REFERENCES task_comments(project_id, task_id, id),
    CONSTRAINT fk_attachment_file FOREIGN KEY (project_id, stored_file_id, file_kind) REFERENCES stored_files(project_id, id, file_kind),
    CONSTRAINT ck_attachment_slot CHECK (slot_no BETWEEN 1 AND 5),
    CONSTRAINT ck_attachment_kind CHECK (file_kind = 'COMMENT_IMAGE')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE comment_mentions (
    project_id BIGINT NOT NULL,
    task_id BIGINT NOT NULL,
    comment_id BIGINT NOT NULL,
    mentioned_user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    slot_no TINYINT NOT NULL,
    active_slot TINYINT GENERATED ALWAYS AS (CASE WHEN removed_at IS NULL THEN slot_no ELSE NULL END) STORED,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    removed_at DATETIME(6) NULL,
    first_notified_at DATETIME(6) NULL,
    first_notification_event_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    PRIMARY KEY (comment_id, mentioned_user_id),
    UNIQUE KEY uq_mention_active_slot (comment_id, active_slot),
    CONSTRAINT fk_mention_comment FOREIGN KEY (project_id, task_id, comment_id) REFERENCES task_comments(project_id, task_id, id),
    CONSTRAINT fk_mention_member FOREIGN KEY (project_id, mentioned_user_id) REFERENCES project_memberships(project_id, user_id),
    CONSTRAINT ck_mention_slot CHECK (slot_no BETWEEN 1 AND 10),
    CONSTRAINT ck_mention_notified CHECK ((first_notified_at IS NULL) = (first_notification_event_id IS NULL)),
    INDEX ix_mention_user (mentioned_user_id, removed_at, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

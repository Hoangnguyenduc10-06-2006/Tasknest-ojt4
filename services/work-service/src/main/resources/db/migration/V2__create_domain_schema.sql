-- One Work database owns project/member/task/time invariants. User IDs reference Identity logically.
CREATE TABLE projects (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    owner_user_id BIGINT NOT NULL,
    manager_user_id BIGINT NULL,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(500) NOT NULL,
    avatar_storage_key VARCHAR(500) NULL,
    avatar_mime_type VARCHAR(100) NULL,
    avatar_size_bytes BIGINT NULL,
    starts_on DATE NOT NULL,
    ends_on DATE NOT NULL,
    status VARCHAR(12) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'ACTIVE',
    archived_at DATETIME(6) NULL,
    archived_by BIGINT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    active_name VARCHAR(100) GENERATED ALWAYS AS (CASE WHEN status = 'ACTIVE' THEN TRIM(name) ELSE NULL END) STORED,
    UNIQUE KEY uq_project_active_name (owner_user_id, active_name),
    CONSTRAINT ck_project_name CHECK (CHAR_LENGTH(TRIM(name)) BETWEEN 3 AND 100),
    CONSTRAINT ck_project_description CHECK (CHAR_LENGTH(TRIM(description)) BETWEEN 10 AND 500),
    CONSTRAINT ck_project_dates CHECK (ends_on >= starts_on),
    CONSTRAINT ck_project_manager CHECK (manager_user_id IS NULL OR manager_user_id <> owner_user_id),
    CONSTRAINT ck_project_status CHECK (status IN ('ACTIVE','ARCHIVED')),
    CONSTRAINT ck_project_archive CHECK ((status = 'ARCHIVED') = (archived_at IS NOT NULL) AND (archived_at IS NULL) = (archived_by IS NULL)),
    CONSTRAINT ck_project_version CHECK (version >= 0),
    CONSTRAINT ck_project_avatar CHECK (avatar_size_bytes IS NULL OR avatar_size_bytes > 0),
    INDEX ix_project_manager (manager_user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

-- Roles derive from projects.owner_user_id / manager_user_id. No duplicate role column.
CREATE TABLE project_memberships (
    project_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    specialty VARCHAR(100) NULL,
    status VARCHAR(10) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'ACTIVE',
    joined_at DATETIME(6) NOT NULL,
    added_by BIGINT NOT NULL,
    removed_at DATETIME(6) NULL,
    removed_by BIGINT NULL,
    PRIMARY KEY (project_id, user_id),
    CONSTRAINT fk_member_project FOREIGN KEY (project_id) REFERENCES projects(id),
    CONSTRAINT ck_member_status CHECK (status IN ('ACTIVE','REMOVED')),
    CONSTRAINT ck_member_removed CHECK ((status = 'REMOVED') = (removed_at IS NOT NULL) AND (removed_at IS NULL) = (removed_by IS NULL)),
    INDEX ix_membership_user (user_id, status, project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE project_invitation_links (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    project_id BIGINT NOT NULL,
    public_code CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    status VARCHAR(10) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'ACTIVE',
    created_by BIGINT NOT NULL,
    created_at DATETIME(6) NOT NULL,
    revoked_at DATETIME(6) NULL,
    revocation_reason VARCHAR(100) NULL,
    active_project_id BIGINT GENERATED ALWAYS AS (CASE WHEN status = 'ACTIVE' THEN project_id ELSE NULL END) STORED,
    UNIQUE KEY uq_join_link_code (public_code),
    UNIQUE KEY uq_join_link_active (active_project_id),
    UNIQUE KEY uq_join_link_project (project_id, id),
    CONSTRAINT fk_join_link_project FOREIGN KEY (project_id) REFERENCES projects(id),
    CONSTRAINT ck_join_link_status CHECK (status IN ('ACTIVE','REVOKED')),
    CONSTRAINT ck_join_link_revocation CHECK ((status = 'REVOKED') = (revoked_at IS NOT NULL) AND (revoked_at IS NULL) = (revocation_reason IS NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE project_invitations (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    project_id BIGINT NOT NULL,
    invitee_user_id BIGINT NOT NULL,
    invited_by BIGINT NOT NULL,
    status VARCHAR(12) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'PENDING',
    created_at DATETIME(6) NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    resolved_at DATETIME(6) NULL,
    resolved_by BIGINT NULL,
    pending_invitee_id BIGINT GENERATED ALWAYS AS (CASE WHEN status = 'PENDING' THEN invitee_user_id ELSE NULL END) STORED,
    UNIQUE KEY uq_invitation_pending (project_id, pending_invitee_id),
    CONSTRAINT fk_invitation_project FOREIGN KEY (project_id) REFERENCES projects(id),
    CONSTRAINT ck_invitation_status CHECK (status IN ('PENDING','ACCEPTED','REJECTED','CANCELLED','EXPIRED')),
    CONSTRAINT ck_invitation_expiry CHECK (expires_at = DATE_ADD(created_at, INTERVAL 7 DAY)),
    CONSTRAINT ck_invitation_resolved CHECK ((status = 'PENDING') = (resolved_at IS NULL)),
    INDEX ix_invitation_recipient (invitee_user_id, status, created_at),
    INDEX ix_invitation_expiry (status, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE project_join_requests (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    project_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    invitation_link_id BIGINT NOT NULL,
    reason VARCHAR(500) NULL,
    status VARCHAR(12) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'PENDING',
    created_at DATETIME(6) NOT NULL,
    resolved_at DATETIME(6) NULL,
    resolved_by BIGINT NULL,
    close_reason VARCHAR(100) NULL,
    pending_user_id BIGINT GENERATED ALWAYS AS (CASE WHEN status = 'PENDING' THEN user_id ELSE NULL END) STORED,
    UNIQUE KEY uq_join_request_pending (project_id, pending_user_id),
    CONSTRAINT fk_join_request_link FOREIGN KEY (project_id, invitation_link_id) REFERENCES project_invitation_links(project_id, id),
    CONSTRAINT ck_join_request_status CHECK (status IN ('PENDING','ACCEPTED','REJECTED','CANCELLED','CLOSED')),
    CONSTRAINT ck_join_request_resolved CHECK ((status = 'PENDING') = (resolved_at IS NULL)),
    CONSTRAINT ck_join_request_closed CHECK (status <> 'CLOSED' OR (close_reason IS NOT NULL AND CHAR_LENGTH(TRIM(close_reason)) > 0)),
    INDEX ix_join_request_inbox (project_id, status, created_at),
    INDEX ix_join_request_cooldown (project_id, user_id, status, resolved_at),
    INDEX ix_join_request_user (user_id, status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE tasks (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    project_id BIGINT NOT NULL,
    name VARCHAR(100) NOT NULL,
    normalized_name VARCHAR(100) GENERATED ALWAYS AS (TRIM(name)) STORED,
    description TEXT NULL,
    assignee_user_id BIGINT NOT NULL,
    created_by BIGINT NOT NULL,
    priority VARCHAR(8) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'MEDIUM',
    status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'TODO',
    starts_on DATE NOT NULL,
    deadline_on DATE NOT NULL,
    estimated_seconds BIGINT NOT NULL,
    is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
    blocked_reason TEXT NULL,
    latest_submission_id BIGINT NULL,
    accepted_submission_id BIGINT NULL,
    completed_at DATETIME(6) NULL,
    cancelled_at DATETIME(6) NULL,
    cancellation_reason TEXT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UNIQUE KEY uq_task_name (project_id, normalized_name),
    UNIQUE KEY uq_task_project_id (project_id, id),
    CONSTRAINT fk_task_project FOREIGN KEY (project_id) REFERENCES projects(id),
    CONSTRAINT fk_task_assignee FOREIGN KEY (project_id, assignee_user_id) REFERENCES project_memberships(project_id, user_id),
    CONSTRAINT fk_task_creator FOREIGN KEY (project_id, created_by) REFERENCES project_memberships(project_id, user_id),
    CONSTRAINT ck_task_name CHECK (CHAR_LENGTH(TRIM(name)) BETWEEN 3 AND 100),
    CONSTRAINT ck_task_priority CHECK (priority IN ('LOW','MEDIUM','HIGH')),
    CONSTRAINT ck_task_status CHECK (status IN ('TODO','IN_PROGRESS','IN_REVIEW','DONE','CANCELLED')),
    CONSTRAINT ck_task_dates CHECK (deadline_on >= starts_on),
    CONSTRAINT ck_task_estimate CHECK (estimated_seconds > 0),
    CONSTRAINT ck_task_blocked CHECK (is_blocked IN (0,1) AND (is_blocked = 0 OR (blocked_reason IS NOT NULL AND CHAR_LENGTH(TRIM(blocked_reason)) > 0))),
    CONSTRAINT ck_task_review CHECK (status <> 'IN_REVIEW' OR latest_submission_id IS NOT NULL),
    CONSTRAINT ck_task_completed CHECK ((status = 'DONE') = (completed_at IS NOT NULL) AND (status = 'DONE') = (accepted_submission_id IS NOT NULL)),
    CONSTRAINT ck_task_cancelled CHECK ((status = 'CANCELLED') = (cancelled_at IS NOT NULL) AND (status <> 'CANCELLED' OR (cancellation_reason IS NOT NULL AND CHAR_LENGTH(TRIM(cancellation_reason)) > 0))),
    CONSTRAINT ck_task_version CHECK (version >= 0),
    INDEX ix_task_board (project_id, status, deadline_on, id),
    INDEX ix_task_personal (assignee_user_id, status, deadline_on, id),
    INDEX ix_task_priority (project_id, priority, id),
    INDEX ix_task_created (project_id, created_at, id),
    INDEX ix_task_deadline (status, deadline_on)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE task_submissions (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    project_id BIGINT NOT NULL,
    task_id BIGINT NOT NULL,
    submission_no INT NOT NULL,
    submitted_by BIGINT NOT NULL,
    assignee_user_id BIGINT NOT NULL,
    result_note TEXT NOT NULL,
    deadline_on_snapshot DATE NOT NULL,
    submitted_at DATETIME(6) NOT NULL,
    decision VARCHAR(10) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'PENDING',
    reviewed_by BIGINT NULL,
    reviewed_at DATETIME(6) NULL,
    rejection_reason TEXT NULL,
    pending_task_id BIGINT GENERATED ALWAYS AS (CASE WHEN decision = 'PENDING' THEN task_id ELSE NULL END) STORED,
    UNIQUE KEY uq_submission_number (task_id, submission_no),
    UNIQUE KEY uq_submission_task_id (task_id, id),
    UNIQUE KEY uq_submission_pending (pending_task_id),
    CONSTRAINT fk_submission_task FOREIGN KEY (project_id, task_id) REFERENCES tasks(project_id, id),
    CONSTRAINT ck_submission_number CHECK (submission_no > 0),
    CONSTRAINT ck_submission_note CHECK (CHAR_LENGTH(TRIM(result_note)) > 0),
    CONSTRAINT ck_submission_decision CHECK (decision IN ('PENDING','ACCEPTED','REJECTED')),
    CONSTRAINT ck_submission_review CHECK ((decision = 'PENDING') = (reviewed_at IS NULL) AND (reviewed_at IS NULL) = (reviewed_by IS NULL) AND (reviewed_at IS NULL OR reviewed_at >= submitted_at)),
    CONSTRAINT ck_submission_rejection CHECK (decision <> 'REJECTED' OR (rejection_reason IS NOT NULL AND CHAR_LENGTH(TRIM(rejection_reason)) > 0)),
    INDEX ix_submission_completions (project_id, decision, reviewed_at, task_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

ALTER TABLE tasks
    ADD CONSTRAINT fk_task_latest_submission FOREIGN KEY (id, latest_submission_id) REFERENCES task_submissions(task_id, id),
    ADD CONSTRAINT fk_task_accepted_submission FOREIGN KEY (id, accepted_submission_id) REFERENCES task_submissions(task_id, id);

-- A persistent mutex row per user serializes overlap checks, including manual entries.
CREATE TABLE time_entry_locks (
    user_id BIGINT PRIMARY KEY
) ENGINE=InnoDB;

CREATE TABLE time_entries (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    project_id BIGINT NOT NULL,
    task_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    source VARCHAR(8) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    started_at DATETIME(6) NOT NULL,
    ended_at DATETIME(6) NULL,
    manual_reason TEXT NULL,
    created_by BIGINT NOT NULL,
    updated_by BIGINT NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    version BIGINT NOT NULL DEFAULT 0,
    duration_microseconds BIGINT GENERATED ALWAYS AS (TIMESTAMPDIFF(MICROSECOND, started_at, ended_at)) STORED,
    running_user_id BIGINT GENERATED ALWAYS AS (CASE WHEN ended_at IS NULL THEN user_id ELSE NULL END) STORED,
    UNIQUE KEY uq_time_running_user (running_user_id),
    CONSTRAINT fk_time_task FOREIGN KEY (project_id, task_id) REFERENCES tasks(project_id, id),
    CONSTRAINT fk_time_member FOREIGN KEY (project_id, user_id) REFERENCES project_memberships(project_id, user_id),
    CONSTRAINT ck_time_source CHECK (source IN ('TIMER','MANUAL')),
    CONSTRAINT ck_time_range CHECK (ended_at IS NULL OR ended_at >= started_at),
    CONSTRAINT ck_time_manual CHECK (source <> 'MANUAL' OR (ended_at IS NOT NULL AND created_by = user_id AND manual_reason IS NOT NULL AND CHAR_LENGTH(TRIM(manual_reason)) > 0)),
    CONSTRAINT ck_time_version CHECK (version >= 0),
    INDEX ix_time_user_interval (user_id, started_at, ended_at),
    INDEX ix_time_task (task_id, user_id, started_at),
    INDEX ix_time_project_running (project_id, ended_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE time_entry_revisions (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    time_entry_id BIGINT NOT NULL,
    revised_by BIGINT NOT NULL,
    before_started_at DATETIME(6) NOT NULL,
    before_ended_at DATETIME(6) NULL,
    after_started_at DATETIME(6) NOT NULL,
    after_ended_at DATETIME(6) NULL,
    reason TEXT NOT NULL,
    revised_at DATETIME(6) NOT NULL,
    CONSTRAINT fk_time_revision FOREIGN KEY (time_entry_id) REFERENCES time_entries(id),
    CONSTRAINT ck_time_revision_reason CHECK (CHAR_LENGTH(TRIM(reason)) > 0),
    CONSTRAINT ck_time_revision_ranges CHECK ((before_ended_at IS NULL OR before_ended_at >= before_started_at) AND (after_ended_at IS NULL OR after_ended_at >= after_started_at)),
    INDEX ix_time_revision_history (time_entry_id, revised_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE task_comments (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    project_id BIGINT NOT NULL,
    task_id BIGINT NOT NULL,
    author_user_id BIGINT NOT NULL,
    body TEXT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    edited_at DATETIME(6) NULL,
    deleted_at DATETIME(6) NULL,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT fk_comment_task FOREIGN KEY (project_id, task_id) REFERENCES tasks(project_id, id),
    CONSTRAINT fk_comment_author FOREIGN KEY (project_id, author_user_id) REFERENCES project_memberships(project_id, user_id),
    CONSTRAINT ck_comment_body CHECK ((deleted_at IS NOT NULL AND body IS NULL) OR (deleted_at IS NULL AND body IS NOT NULL AND CHAR_LENGTH(TRIM(body)) BETWEEN 1 AND 2000)),
    CONSTRAINT ck_comment_version CHECK (version >= 0),
    INDEX ix_comment_task (task_id, created_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE activity_logs (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    project_id BIGINT NOT NULL,
    task_id BIGINT NULL,
    actor_user_id BIGINT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(60) NOT NULL,
    entity_id VARCHAR(64) NOT NULL,
    entity_version BIGINT NULL,
    before_data JSON NULL,
    after_data JSON NULL,
    reason TEXT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_activity_project FOREIGN KEY (project_id) REFERENCES projects(id),
    CONSTRAINT fk_activity_task FOREIGN KEY (project_id, task_id) REFERENCES tasks(project_id, id),
    INDEX ix_activity_project (project_id, created_at, id),
    INDEX ix_activity_task (task_id, created_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE task_alerts (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    project_id BIGINT NOT NULL,
    task_id BIGINT NOT NULL,
    alert_type VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    submission_id BIGINT NULL,
    dedupe_scope BIGINT GENERATED ALWAYS AS (COALESCE(submission_id, 0)) STORED,
    observed_microseconds BIGINT NULL,
    estimated_seconds_snapshot BIGINT NULL,
    deadline_on_snapshot DATE NULL,
    raised_at DATETIME(6) NOT NULL,
    UNIQUE KEY uq_task_alert (task_id, alert_type, dedupe_scope),
    CONSTRAINT fk_alert_task FOREIGN KEY (project_id, task_id) REFERENCES tasks(project_id, id),
    CONSTRAINT fk_alert_submission FOREIGN KEY (task_id, submission_id) REFERENCES task_submissions(task_id, id),
    CONSTRAINT ck_alert_type CHECK (alert_type IN ('RISK','OVERRUN','OVERDUE','REVIEW_OVERDUE')),
    CONSTRAINT ck_alert_scope CHECK ((alert_type = 'REVIEW_OVERDUE') = (submission_id IS NOT NULL)),
    CONSTRAINT ck_alert_numbers CHECK ((observed_microseconds IS NULL OR observed_microseconds >= 0) AND (estimated_seconds_snapshot IS NULL OR estimated_seconds_snapshot > 0)),
    INDEX ix_alert_project (project_id, raised_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

-- Transactional event delivery. JSON must contain no credentials or raw tokens.
CREATE TABLE outbox_events (
    event_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    aggregate_type VARCHAR(80) NOT NULL,
    aggregate_id VARCHAR(64) NOT NULL,
    aggregate_version BIGINT NOT NULL,
    event_type VARCHAR(120) NOT NULL,
    schema_version INT NOT NULL DEFAULT 1,
    occurred_at DATETIME(6) NOT NULL,
    payload JSON NOT NULL,
    sensitive_payload MEDIUMBLOB NULL,
    encryption_key_id VARCHAR(100) NULL,
    correlation_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'PENDING',
    available_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    attempts INT NOT NULL DEFAULT 0,
    locked_by VARCHAR(100) NULL,
    locked_until DATETIME(6) NULL,
    published_at DATETIME(6) NULL,
    last_error_safe VARCHAR(500) NULL,
    CONSTRAINT ck_outbox_status CHECK (status IN ('PENDING','PROCESSING','PUBLISHED','DEAD')),
    CONSTRAINT ck_outbox_numbers CHECK (aggregate_version >= 0 AND schema_version > 0 AND attempts >= 0),
    CONSTRAINT ck_outbox_encryption CHECK ((sensitive_payload IS NULL) = (encryption_key_id IS NULL)),
    CONSTRAINT ck_outbox_lease CHECK ((locked_by IS NULL) = (locked_until IS NULL)),
    INDEX ix_outbox_dispatch (status, available_at, occurred_at),
    INDEX ix_outbox_lease (status, locked_until)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE processed_events (
    consumer_name VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    event_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    event_type VARCHAR(120) NOT NULL,
    processed_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (consumer_name, event_id),
    INDEX ix_processed_retention (processed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

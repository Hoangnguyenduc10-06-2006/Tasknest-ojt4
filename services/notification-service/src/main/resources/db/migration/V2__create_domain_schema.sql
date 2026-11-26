-- Contacts are an event-fed projection, never the source of authentication/authorization.
CREATE TABLE recipient_contacts (
    user_id BIGINT PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    is_email_verified BOOLEAN NOT NULL,
    source_version BIGINT NOT NULL,
    last_event_at DATETIME(6) NOT NULL,
    CONSTRAINT ck_contact_version CHECK (source_version >= 0),
    CONSTRAINT ck_contact_verified CHECK (is_email_verified IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE notifications (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    recipient_user_id BIGINT NOT NULL,
    event_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    event_type VARCHAR(120) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    actor_user_id BIGINT NULL,
    project_id BIGINT NULL,
    task_id BIGINT NULL,
    resource_type VARCHAR(60) NOT NULL,
    resource_id VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    read_at DATETIME(6) NULL,
    UNIQUE KEY uq_notification_recipient_event (recipient_user_id, event_id),
    UNIQUE KEY uq_notification_delivery (id, recipient_user_id, event_id),
    CONSTRAINT ck_notification_read CHECK (read_at IS NULL OR read_at >= created_at),
    INDEX ix_notification_unread (recipient_user_id, read_at, created_at, id),
    INDEX ix_notification_inbox (recipient_user_id, created_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE email_jobs (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    event_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    recipient_user_id BIGINT NOT NULL,
    recipient_email VARCHAR(255) NOT NULL,
    event_type VARCHAR(120) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    purpose VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    notification_id BIGINT NULL,
    template_key VARCHAR(100) NOT NULL,
    template_version INT NOT NULL DEFAULT 1,
    template_data JSON NOT NULL,
    sensitive_data MEDIUMBLOB NULL,
    encryption_key_id VARCHAR(100) NULL,
    status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'QUEUED',
    attempt_count INT NOT NULL DEFAULT 0,
    next_attempt_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    locked_by VARCHAR(100) NULL,
    locked_until DATETIME(6) NULL,
    provider_message_id VARCHAR(255) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    expires_at DATETIME(6) NULL,
    accepted_at DATETIME(6) NULL,
    delivered_at DATETIME(6) NULL,
    last_error_safe VARCHAR(500) NULL,
    UNIQUE KEY uq_email_recipient_event (recipient_user_id, event_id),
    CONSTRAINT fk_email_notification FOREIGN KEY (notification_id, recipient_user_id, event_id) REFERENCES notifications(id, recipient_user_id, event_id),
    CONSTRAINT ck_email_purpose CHECK (purpose IN ('EMAIL_VERIFICATION','PASSWORD_RESET','PROJECT_EVENT','TASK_EVENT','SECURITY_EVENT')),
    CONSTRAINT ck_email_no_comments CHECK (event_type <> 'task.comment.created'),
    CONSTRAINT ck_email_status CHECK (status IN ('QUEUED','SENDING','ACCEPTED','DELIVERED','BOUNCED','FAILED','SUPPRESSED')),
    CONSTRAINT ck_email_numbers CHECK (attempt_count >= 0 AND template_version > 0),
    CONSTRAINT ck_email_encryption CHECK ((sensitive_data IS NULL) = (encryption_key_id IS NULL)),
    CONSTRAINT ck_email_lease CHECK ((locked_by IS NULL) = (locked_until IS NULL)),
    CONSTRAINT ck_email_expiry CHECK (expires_at IS NULL OR expires_at > created_at),
    INDEX ix_email_dispatch (status, next_attempt_at, id),
    INDEX ix_email_lease (status, locked_until),
    INDEX ix_email_provider (provider_message_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE email_delivery_attempts (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    email_job_id BIGINT NOT NULL,
    attempt_no INT NOT NULL,
    started_at DATETIME(6) NOT NULL,
    finished_at DATETIME(6) NULL,
    result VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
    provider_message_id VARCHAR(255) NULL,
    error_code VARCHAR(100) NULL,
    error_safe VARCHAR(500) NULL,
    UNIQUE KEY uq_email_attempt (email_job_id, attempt_no),
    CONSTRAINT fk_email_attempt_job FOREIGN KEY (email_job_id) REFERENCES email_jobs(id),
    CONSTRAINT ck_email_attempt_number CHECK (attempt_no > 0),
    CONSTRAINT ck_email_attempt_result CHECK (result IS NULL OR result IN ('ACCEPTED','TRANSIENT_FAILURE','PERMANENT_FAILURE','UNKNOWN')),
    CONSTRAINT ck_email_attempt_finished CHECK ((finished_at IS NULL) = (result IS NULL) AND (finished_at IS NULL OR finished_at >= started_at))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE email_provider_events (
    dedupe_hash BINARY(32) PRIMARY KEY,
    provider VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'BREVO',
    provider_event_id VARCHAR(255) NULL,
    provider_message_id VARCHAR(255) NOT NULL,
    email_job_id BIGINT NULL,
    event_type VARCHAR(80) NOT NULL,
    occurred_at DATETIME(6) NOT NULL,
    received_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UNIQUE KEY uq_provider_event (provider, provider_event_id),
    CONSTRAINT fk_provider_event_job FOREIGN KEY (email_job_id) REFERENCES email_jobs(id),
    INDEX ix_provider_event_message (provider, provider_message_id, occurred_at)
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

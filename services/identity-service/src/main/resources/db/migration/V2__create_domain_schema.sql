-- Fresh domain schema; preserve V1. All DATETIME values are UTC.
CREATE TABLE users (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    email_verified_at DATETIME(6) NULL,
    avatar_storage_key VARCHAR(500) NULL,
    avatar_mime_type VARCHAR(100) NULL,
    avatar_size_bytes BIGINT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UNIQUE KEY uq_users_email (email),
    CONSTRAINT ck_user_name CHECK (CHAR_LENGTH(TRIM(full_name)) BETWEEN 2 AND 100),
    CONSTRAINT ck_user_email CHECK (BINARY email = BINARY LOWER(TRIM(email)) AND CHAR_LENGTH(email) > 3),
    CONSTRAINT ck_user_verified CHECK (is_email_verified IN (0,1) AND (is_email_verified = 1) = (email_verified_at IS NOT NULL)),
    CONSTRAINT ck_user_version CHECK (version >= 0),
    CONSTRAINT ck_user_avatar CHECK (avatar_size_bytes IS NULL OR avatar_size_bytes > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE auth_sessions (
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    user_id BIGINT NOT NULL,
    device_label VARCHAR(255) NULL,
    user_agent TEXT NULL,
    created_at DATETIME(6) NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    last_seen_at DATETIME(6) NOT NULL,
    revoked_at DATETIME(6) NULL,
    revocation_reason VARCHAR(100) NULL,
    CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT ck_session_expiry CHECK (expires_at > created_at AND expires_at <= DATE_ADD(created_at, INTERVAL 7 DAY)),
    CONSTRAINT ck_session_revocation CHECK ((revoked_at IS NULL) = (revocation_reason IS NULL)),
    INDEX ix_sessions_user (user_id, revoked_at, expires_at),
    INDEX ix_sessions_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE refresh_tokens (
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    session_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    token_hash BINARY(32) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    consumed_at DATETIME(6) NULL,
    revoked_at DATETIME(6) NULL,
    replaced_by_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    active_session_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin
        GENERATED ALWAYS AS (CASE WHEN consumed_at IS NULL AND revoked_at IS NULL THEN session_id ELSE NULL END) STORED,
    UNIQUE KEY uq_refresh_hash (token_hash),
    UNIQUE KEY uq_refresh_current (active_session_id),
    UNIQUE KEY uq_refresh_session_id (session_id, id),
    CONSTRAINT fk_refresh_session FOREIGN KEY (session_id) REFERENCES auth_sessions(id),
    CONSTRAINT fk_refresh_replacement FOREIGN KEY (session_id, replaced_by_id) REFERENCES refresh_tokens(session_id, id),
    CONSTRAINT ck_refresh_replacement CHECK (replaced_by_id IS NULL OR (consumed_at IS NOT NULL AND replaced_by_id <> id)),
    CONSTRAINT ck_refresh_time CHECK ((consumed_at IS NULL OR consumed_at >= created_at) AND (revoked_at IS NULL OR revoked_at >= created_at))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE account_tokens (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    purpose VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    token_hash BINARY(32) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    used_at DATETIME(6) NULL,
    revoked_at DATETIME(6) NULL,
    active_user_id BIGINT GENERATED ALWAYS AS (CASE WHEN used_at IS NULL AND revoked_at IS NULL THEN user_id ELSE NULL END) STORED,
    UNIQUE KEY uq_account_token_hash (token_hash),
    UNIQUE KEY uq_account_token_current (purpose, active_user_id),
    CONSTRAINT fk_account_token_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT ck_account_token_purpose CHECK (purpose IN ('EMAIL_VERIFICATION','PASSWORD_RESET')),
    CONSTRAINT ck_account_token_expiry CHECK (expires_at > created_at AND (purpose <> 'EMAIL_VERIFICATION' OR expires_at <= DATE_ADD(created_at, INTERVAL 24 HOUR))),
    INDEX ix_account_token_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE auth_rate_limit_buckets (
    action VARCHAR(50) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    scope VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    subject_hash BINARY(32) NOT NULL,
    window_start DATETIME(6) NOT NULL,
    window_end DATETIME(6) NOT NULL,
    request_count INT NOT NULL DEFAULT 1,
    PRIMARY KEY (action, scope, subject_hash, window_start),
    CONSTRAINT ck_rate_window CHECK (window_end > window_start AND request_count >= 0),
    INDEX ix_rate_expiry (window_end)
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

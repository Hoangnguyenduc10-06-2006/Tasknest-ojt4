ALTER TABLE notifications ADD COLUMN push_direct BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE browser_push_subscriptions (
    endpoint_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    endpoint VARCHAR(2048) NOT NULL,
    public_key VARCHAR(100) NOT NULL,
    auth_secret VARCHAR(32) NOT NULL,
    work_alerts BOOLEAN NOT NULL,
    collaboration_alerts BOOLEAN NOT NULL,
    message_alerts BOOLEAN NOT NULL,
    show_details BOOLEAN NOT NULL,
    last_notification_id BIGINT NOT NULL,
    checked_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    INDEX ix_browser_push_poll (checked_at),
    INDEX ix_browser_push_user (user_id)
);

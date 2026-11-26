CREATE TABLE activity_notification_receipts (
    activity_id BIGINT PRIMARY KEY,
    processed_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_activity_receipt FOREIGN KEY (activity_id) REFERENCES activity_logs(id)
) ENGINE=InnoDB;
CREATE TABLE work_request_limits (
    user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    action VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    window_start BIGINT NOT NULL,
    requests INT NOT NULL,
    PRIMARY KEY(user_id,action,window_start)
) ENGINE=InnoDB;

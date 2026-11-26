CREATE TABLE account_connections (
    user_low CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    user_high CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    requested_by CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    status VARCHAR(10) NOT NULL,
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (user_low, user_high),
    INDEX ix_connections_high (user_high, updated_at),
    CHECK (user_low < user_high),
    CHECK (requested_by IN (user_low, user_high)),
    CHECK (status IN ('PENDING', 'ACCEPTED'))
);

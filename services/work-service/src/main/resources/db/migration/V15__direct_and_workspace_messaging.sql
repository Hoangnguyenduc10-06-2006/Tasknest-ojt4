CREATE TABLE chat_conversations (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    kind VARCHAR(10) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    scope_key VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    user_low CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    user_high CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    team_id BIGINT NULL,
    project_id BIGINT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UNIQUE KEY uq_chat_scope(scope_key),
    FOREIGN KEY (team_id) REFERENCES dev_teams(id),
    FOREIGN KEY (project_id) REFERENCES projects(id),
    INDEX ix_chat_updated(updated_at,id),
    CONSTRAINT ck_chat_kind CHECK (
      (kind='DIRECT' AND user_low IS NOT NULL AND user_high IS NOT NULL AND user_low<user_high AND team_id IS NULL AND project_id IS NULL) OR
      (kind='TEAM' AND team_id IS NOT NULL AND user_low IS NULL AND user_high IS NULL AND project_id IS NULL) OR
      (kind='PROJECT' AND project_id IS NOT NULL AND user_low IS NULL AND user_high IS NULL AND team_id IS NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;
CREATE TABLE chat_messages (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    conversation_id BIGINT NOT NULL,
    sender_user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    sender_name VARCHAR(150) NOT NULL,
    body VARCHAR(4000) NOT NULL,
    client_message_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id),
    UNIQUE KEY uq_chat_retry(conversation_id,sender_user_id,client_message_id),
    INDEX ix_chat_history(conversation_id,id),
    CONSTRAINT ck_chat_body CHECK(CHAR_LENGTH(TRIM(body)) BETWEEN 1 AND 4000)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;
CREATE TABLE chat_reads (
    conversation_id BIGINT NOT NULL,
    user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    last_message_id BIGINT NOT NULL,
    read_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY(conversation_id,user_id),
    FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;
CREATE TABLE chat_blocks (
    blocker_user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    blocked_user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    PRIMARY KEY(blocker_user_id,blocked_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

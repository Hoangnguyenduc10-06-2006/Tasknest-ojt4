CREATE TABLE proposal_messages (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    proposal_id BIGINT NOT NULL,
    sender_user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    sender_name VARCHAR(150) NOT NULL,
    body VARCHAR(2000) NOT NULL,
    client_message_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    FOREIGN KEY (proposal_id) REFERENCES team_project_proposals(id),
    UNIQUE KEY uq_proposal_message_retry (proposal_id,sender_user_id,client_message_id),
    UNIQUE KEY uq_proposal_message_id (proposal_id,id),
    INDEX ix_proposal_messages (proposal_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE proposal_message_reads (
    proposal_id BIGINT NOT NULL,
    user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    last_message_id BIGINT NOT NULL,
    read_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (proposal_id,user_id),
    FOREIGN KEY (proposal_id,last_message_id) REFERENCES proposal_messages(proposal_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE dev_teams (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    owner_user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(1500) NOT NULL,
    skills VARCHAR(300) NOT NULL,
    accepting_work BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    version BIGINT NOT NULL DEFAULT 0,
    INDEX ix_team_owner (owner_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE dev_team_members (
    team_id BIGINT NOT NULL,
    user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    display_name VARCHAR(150) NOT NULL,
    specialty VARCHAR(100) NOT NULL DEFAULT '',
    joined_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (team_id, user_id),
    FOREIGN KEY (team_id) REFERENCES dev_teams(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE dev_team_invitations (
    team_id BIGINT NOT NULL,
    user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    status VARCHAR(10) NOT NULL DEFAULT 'PENDING',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (team_id, user_id),
    FOREIGN KEY (team_id) REFERENCES dev_teams(id),
    CONSTRAINT ck_team_invite_status CHECK (status IN ('PENDING','ACCEPTED','REJECTED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE team_engagements (
    project_id BIGINT NOT NULL PRIMARY KEY,
    team_id BIGINT NOT NULL,
    customer_user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    customer_name VARCHAR(150) NOT NULL,
    status VARCHAR(12) NOT NULL DEFAULT 'PROPOSED',
    project_public_name VARCHAR(100) NULL,
    accepted_at DATETIME(6) NULL,
    completed_at DATETIME(6) NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (team_id) REFERENCES dev_teams(id),
    INDEX ix_engagement_team (team_id, status),
    CONSTRAINT ck_engagement_status CHECK (status IN ('PROPOSED','ACTIVE','COMPLETED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE team_engagement_contributors (
    project_id BIGINT NOT NULL,
    user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    display_name VARCHAR(150) NOT NULL,
    PRIMARY KEY (project_id, user_id),
    FOREIGN KEY (project_id) REFERENCES team_engagements(project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE team_reviews (
    project_id BIGINT NOT NULL PRIMARY KEY,
    quality TINYINT NOT NULL,
    schedule TINYINT NOT NULL,
    communication TINYINT NOT NULL,
    support TINYINT NOT NULL,
    comment VARCHAR(2000) NOT NULL,
    would_rehire BOOLEAN NOT NULL,
    reply VARCHAR(2000) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    reply_updated_at DATETIME(6) NULL,
    version BIGINT NOT NULL DEFAULT 0,
    FOREIGN KEY (project_id) REFERENCES team_engagements(project_id),
    CONSTRAINT ck_review_stars CHECK (quality BETWEEN 1 AND 5 AND schedule BETWEEN 1 AND 5 AND communication BETWEEN 1 AND 5 AND support BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE team_review_history (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    project_id BIGINT NOT NULL,
    actor_user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    content JSON NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    FOREIGN KEY (project_id) REFERENCES team_reviews(project_id),
    INDEX ix_review_history (project_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE member_recognitions (
    project_id BIGINT NOT NULL,
    user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    strengths VARCHAR(200) NOT NULL,
    comment VARCHAR(1000) NOT NULL,
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (project_id, user_id),
    FOREIGN KEY (project_id, user_id) REFERENCES team_engagement_contributors(project_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE profile_likes (
    target_type VARCHAR(6) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    target_id VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (target_type, target_id, user_id),
    CONSTRAINT ck_like_target CHECK (target_type IN ('TEAM','MEMBER'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

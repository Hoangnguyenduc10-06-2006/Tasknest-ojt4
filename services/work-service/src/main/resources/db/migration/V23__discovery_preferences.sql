CREATE TABLE discovery_saved_posts (
    user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    kind VARCHAR(8) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    post_id BIGINT NOT NULL,
    PRIMARY KEY (user_id,kind,post_id),
    CONSTRAINT ck_discovery_saved_kind CHECK (kind IN ('REQUEST','OPENING'))
);

CREATE TABLE discovery_followed_skills (
    user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    skill VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NOT NULL,
    PRIMARY KEY (user_id,skill)
);

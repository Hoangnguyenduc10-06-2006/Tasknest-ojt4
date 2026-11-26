CREATE TABLE dev_team_covers (
    team_id BIGINT NOT NULL PRIMARY KEY,
    mime_type VARCHAR(10) NOT NULL,
    image_data MEDIUMBLOB NOT NULL,
    FOREIGN KEY (team_id) REFERENCES dev_teams(id) ON DELETE CASCADE,
    CHECK (mime_type IN ('image/png','image/jpeg')),
    CHECK (OCTET_LENGTH(image_data) BETWEEN 1 AND 5242880)
);

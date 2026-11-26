ALTER TABLE team_openings ADD COLUMN reference_url VARCHAR(2048) NULL;
ALTER TABLE professional_member_profiles
    ADD COLUMN contact_email VARCHAR(254) NULL,
    ADD COLUMN social_url VARCHAR(2048) NULL;

CREATE TABLE request_post_images (
    post_id BIGINT NOT NULL,
    position TINYINT UNSIGNED NOT NULL,
    PRIMARY KEY(post_id,position),
    CHECK (position BETWEEN 1 AND 4),
    mime_type VARCHAR(10) NOT NULL,
    image_data MEDIUMBLOB NOT NULL,
    FOREIGN KEY (post_id) REFERENCES customer_project_requests(id) ON DELETE CASCADE,
    CHECK (mime_type IN ('image/png','image/jpeg')),
    CHECK (OCTET_LENGTH(image_data) BETWEEN 1 AND 1048576)
);
CREATE TABLE opening_post_images (
    post_id BIGINT NOT NULL,
    position TINYINT UNSIGNED NOT NULL,
    PRIMARY KEY(post_id,position),
    CHECK (position BETWEEN 1 AND 4),
    mime_type VARCHAR(10) NOT NULL,
    image_data MEDIUMBLOB NOT NULL,
    FOREIGN KEY (post_id) REFERENCES team_openings(id) ON DELETE CASCADE,
    CHECK (mime_type IN ('image/png','image/jpeg')),
    CHECK (OCTET_LENGTH(image_data) BETWEEN 1 AND 1048576)
);

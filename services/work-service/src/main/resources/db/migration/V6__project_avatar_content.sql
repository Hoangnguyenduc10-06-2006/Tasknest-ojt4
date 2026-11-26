CREATE TABLE project_avatars (
    project_id BIGINT PRIMARY KEY,
    image_data MEDIUMBLOB NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    CONSTRAINT fk_project_avatar FOREIGN KEY(project_id) REFERENCES projects(id),
    CONSTRAINT ck_project_avatar_bytes CHECK (OCTET_LENGTH(image_data) BETWEEN 1 AND 5242880),
    CONSTRAINT ck_project_avatar_type CHECK (mime_type IN ('image/png','image/jpeg'))
) ENGINE=InnoDB;

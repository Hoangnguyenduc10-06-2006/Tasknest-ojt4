CREATE TABLE user_profile_covers (
    user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    image_data MEDIUMBLOB NOT NULL,
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT fk_profile_cover_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT ck_profile_cover_size CHECK (OCTET_LENGTH(image_data) BETWEEN 1 AND 5242880)
) ENGINE=InnoDB;

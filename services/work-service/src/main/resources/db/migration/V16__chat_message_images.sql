CREATE TABLE chat_message_images (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    mime_type VARCHAR(10) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    content_sha256 BINARY(32) NOT NULL,
    image_data MEDIUMBLOB NOT NULL,
    CONSTRAINT ck_chat_image_mime CHECK (mime_type IN ('image/png', 'image/jpeg')),
    CONSTRAINT ck_chat_image_bytes CHECK (OCTET_LENGTH(image_data) BETWEEN 1 AND 5242880)
) ENGINE=InnoDB;

ALTER TABLE chat_messages
    DROP CHECK ck_chat_body,
    ADD COLUMN image_id BIGINT NULL,
    ADD UNIQUE KEY uq_chat_message_image (image_id),
    ADD CONSTRAINT fk_chat_message_image FOREIGN KEY (image_id) REFERENCES chat_message_images(id),
    ADD CONSTRAINT ck_chat_body_or_image CHECK (CHAR_LENGTH(TRIM(body)) BETWEEN 1 AND 4000 OR image_id IS NOT NULL);

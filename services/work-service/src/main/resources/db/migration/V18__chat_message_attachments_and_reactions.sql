CREATE TABLE chat_message_attachments (
    message_id BIGINT NOT NULL,
    image_id BIGINT NOT NULL,
    position TINYINT UNSIGNED NOT NULL,
    PRIMARY KEY (message_id, position),
    UNIQUE KEY uq_chat_attachment_image (image_id),
    CONSTRAINT fk_chat_attachment_message FOREIGN KEY (message_id)
        REFERENCES chat_messages(id) ON DELETE CASCADE,
    CONSTRAINT fk_chat_attachment_image FOREIGN KEY (image_id)
        REFERENCES chat_message_images(id),
    CONSTRAINT ck_chat_attachment_position CHECK (position BETWEEN 1 AND 5)
) ENGINE=InnoDB;

INSERT INTO chat_message_attachments(message_id, image_id, position)
SELECT id, image_id, 1
FROM chat_messages
WHERE image_id IS NOT NULL;

CREATE TABLE chat_message_reactions (
    message_id BIGINT NOT NULL,
    user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    emoji VARCHAR(8) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (message_id, user_id),
    CONSTRAINT fk_chat_reaction_message FOREIGN KEY (message_id)
        REFERENCES chat_messages(id) ON DELETE CASCADE,
    CONSTRAINT ck_chat_reaction_emoji CHECK (emoji IN ('👍', '❤️', '😂', '😮', '😢', '🙏')),
    INDEX ix_chat_reaction_message_emoji (message_id, emoji)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

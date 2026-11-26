ALTER TABLE chat_messages
    ADD COLUMN reply_to_message_id BIGINT NULL,
    ADD UNIQUE KEY uq_chat_message_conversation_id (conversation_id, id),
    ADD CONSTRAINT fk_chat_message_reply_same_conversation
        FOREIGN KEY (conversation_id, reply_to_message_id)
        REFERENCES chat_messages (conversation_id, id);

ALTER TABLE team_engagements
    ADD COLUMN reopen_request_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    ADD COLUMN reopen_requested_by CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL;

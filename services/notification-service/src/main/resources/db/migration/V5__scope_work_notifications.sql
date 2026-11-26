ALTER TABLE notifications ADD COLUMN access_scope VARCHAR(20) NOT NULL DEFAULT 'ACCOUNT_ONLY',
    ADD CONSTRAINT ck_notification_access_scope CHECK (access_scope IN ('ACCOUNT_ONLY','PROJECT_MEMBER'));

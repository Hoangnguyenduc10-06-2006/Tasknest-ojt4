-- Ordinary comment followers remain in-app only. REPLY/MENTION recipients may receive email.
ALTER TABLE notifications
    ADD COLUMN recipient_reasons JSON NOT NULL DEFAULT (JSON_ARRAY()),
    ADD CONSTRAINT ck_notification_reasons CHECK (JSON_SCHEMA_VALID('{"type":"array","items":{"enum":["ASSIGNEE","CREATOR","REPLY","MENTION"]},"uniqueItems":true}',recipient_reasons));
ALTER TABLE email_jobs
    DROP CHECK ck_email_no_comments,
    ADD COLUMN recipient_reasons JSON NOT NULL DEFAULT (JSON_ARRAY()),
    ADD CONSTRAINT ck_email_recipient_reasons CHECK (JSON_SCHEMA_VALID('{"type":"array","items":{"enum":["ASSIGNEE","CREATOR","REPLY","MENTION"]},"uniqueItems":true}',recipient_reasons)),
    ADD CONSTRAINT ck_email_comment_reasons CHECK (event_type NOT LIKE 'task.comment.%' OR (purpose = 'TASK_EVENT' AND notification_id IS NOT NULL AND (JSON_CONTAINS(recipient_reasons,'"REPLY"') OR JSON_CONTAINS(recipient_reasons,'"MENTION"'))));

-- Distinguish the initial email from resends; preserve existing V1/V2 checksums.
ALTER TABLE account_tokens ADD COLUMN issue_source VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'OTHER';
-- Registration created the first verification token; subsequent tokens are resends.
UPDATE account_tokens t
JOIN (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at, id) AS issue_number
    FROM account_tokens WHERE purpose = 'EMAIL_VERIFICATION'
) history ON t.id = history.id
SET t.issue_source = CASE WHEN history.issue_number = 1 THEN 'REGISTER' ELSE 'RESEND' END;
ALTER TABLE account_tokens ADD CONSTRAINT ck_account_token_issue_source CHECK (issue_source IN ('REGISTER','RESEND','OTHER'));
CREATE INDEX ix_account_token_resends ON account_tokens (user_id, purpose, issue_source, created_at);

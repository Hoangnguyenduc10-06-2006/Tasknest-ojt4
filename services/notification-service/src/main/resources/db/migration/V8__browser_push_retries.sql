ALTER TABLE browser_push_subscriptions
    ADD COLUMN push_attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
    ADD COLUMN retry_after DATETIME(6) NULL;

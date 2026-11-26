-- Existing snapshots remain valid; unknown historical evidence counts stay NULL.
ALTER TABLE team_engagement_contributors
    ADD COLUMN completed_tasks INT NULL,
    ADD COLUMN tracked_seconds BIGINT NULL;

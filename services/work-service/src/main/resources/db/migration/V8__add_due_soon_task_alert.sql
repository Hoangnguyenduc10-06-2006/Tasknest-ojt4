-- Allow upcoming deadline reminders (DUE_SOON) and deduplicate them per task deadline snapshot.
ALTER TABLE task_alerts DROP INDEX uq_task_alert;

ALTER TABLE task_alerts DROP COLUMN dedupe_scope;

ALTER TABLE task_alerts DROP CHECK ck_alert_type;

ALTER TABLE task_alerts DROP CHECK ck_alert_scope;

ALTER TABLE task_alerts
    ADD COLUMN dedupe_scope BIGINT GENERATED ALWAYS AS (
        CASE
            WHEN alert_type = 'DUE_SOON' THEN COALESCE(
                YEAR(deadline_on_snapshot) * 10000 + MONTH(deadline_on_snapshot) * 100 + DAY(deadline_on_snapshot),
                0
            )
            ELSE COALESCE(submission_id, 0)
        END
    ) STORED AFTER submission_id;

ALTER TABLE task_alerts
    ADD UNIQUE KEY uq_task_alert (task_id, alert_type, dedupe_scope),
    ADD CONSTRAINT ck_alert_type CHECK (alert_type IN ('RISK','OVERRUN','DUE_SOON','OVERDUE','REVIEW_OVERDUE')),
    ADD CONSTRAINT ck_alert_scope CHECK (
        ((alert_type = 'REVIEW_OVERDUE') = (submission_id IS NOT NULL))
        AND (alert_type <> 'DUE_SOON' OR deadline_on_snapshot IS NOT NULL)
    );


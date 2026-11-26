ALTER TABLE users
    ADD COLUMN account_purpose VARCHAR(12) NOT NULL DEFAULT 'UNDECIDED',
    ADD COLUMN onboarding_status VARCHAR(12) NOT NULL DEFAULT 'DEFERRED',
    ADD COLUMN onboarding_step INT NOT NULL DEFAULT 0,
    ADD COLUMN onboarding_draft TEXT NOT NULL DEFAULT ('{}'),
    ADD COLUMN avatar_public BOOLEAN NOT NULL DEFAULT FALSE,
    ADD CONSTRAINT ck_account_purpose CHECK (account_purpose IN ('UNDECIDED','CLIENT','DEVELOPER','BOTH')),
    ADD CONSTRAINT ck_onboarding_status CHECK (onboarding_status IN ('NOT_STARTED','IN_PROGRESS','DEFERRED','COMPLETED')),
    ADD CONSTRAINT ck_onboarding_step CHECK (onboarding_step BETWEEN 0 AND 3),
    ADD CONSTRAINT ck_onboarding_draft CHECK (JSON_VALID(onboarding_draft));

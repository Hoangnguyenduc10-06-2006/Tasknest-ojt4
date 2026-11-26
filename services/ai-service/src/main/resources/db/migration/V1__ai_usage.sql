-- Only quota counters are stored; no prompts, answers, keys or conversation history.
CREATE TABLE ai_usage_buckets (
    bucket_key VARCHAR(120) PRIMARY KEY,
    request_count INT NOT NULL DEFAULT 0,
    reserved_tokens INT NOT NULL DEFAULT 0,
    expires_at TIMESTAMP(6) NOT NULL
);

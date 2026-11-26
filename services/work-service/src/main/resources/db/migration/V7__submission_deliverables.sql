ALTER TABLE stored_files ADD UNIQUE KEY uq_file_project_id (project_id,id);

ALTER TABLE task_submissions
    ADD COLUMN result_url VARCHAR(2048) NULL,
    ADD COLUMN result_file_id BIGINT NULL,
    ADD CONSTRAINT fk_submission_result_file FOREIGN KEY (project_id,result_file_id) REFERENCES stored_files(project_id,id),
    ADD CONSTRAINT ck_submission_result CHECK (result_url IS NULL OR result_file_id IS NULL);

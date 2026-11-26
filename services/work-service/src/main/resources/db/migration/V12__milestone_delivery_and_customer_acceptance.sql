CREATE TABLE project_milestones (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    project_id BIGINT NOT NULL,
    title VARCHAR(150) NOT NULL,
    criteria JSON NOT NULL,
    due_on DATE NOT NULL,
    status VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'DRAFT',
    created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    plan_approved_by CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    plan_approved_at DATETIME(6) NULL,
    accepted_at DATETIME(6) NULL,
    cancelled_reason VARCHAR(2000) NULL,
    latest_submission_id BIGINT NULL,
    creation_request_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    creation_hash BINARY(32) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UNIQUE KEY uq_milestone_project_id (project_id,id),
    UNIQUE KEY uq_milestone_creation (project_id,created_by,creation_request_id),
    FOREIGN KEY (project_id) REFERENCES projects(id),
    INDEX ix_milestone_project (project_id,due_on,id),
    CONSTRAINT ck_milestone_status CHECK (status IN ('DRAFT','ACTIVE','IN_REVIEW','CHANGES_REQUESTED','ACCEPTED','CANCELLED')),
    CONSTRAINT ck_milestone_accepted CHECK ((status='ACCEPTED')=(accepted_at IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE milestone_tasks (
    project_id BIGINT NOT NULL,
    milestone_id BIGINT NOT NULL,
    task_id BIGINT NOT NULL,
    PRIMARY KEY (milestone_id,task_id),
    FOREIGN KEY (project_id,milestone_id) REFERENCES project_milestones(project_id,id),
    FOREIGN KEY (project_id,task_id) REFERENCES tasks(project_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE milestone_submissions (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    milestone_id BIGINT NOT NULL,
    submission_no INT NOT NULL,
    submitted_by CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    submitted_name VARCHAR(150) NOT NULL,
    note VARCHAR(4000) NOT NULL,
    result_url VARCHAR(2048) NOT NULL,
    criteria JSON NOT NULL,
    decision VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'PENDING',
    feedback VARCHAR(2000) NULL,
    checked_criteria JSON NULL,
    reviewed_by CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    reviewer_name VARCHAR(150) NULL,
    submitted_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    reviewed_at DATETIME(6) NULL,
    request_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    request_hash BINARY(32) NOT NULL,
    UNIQUE KEY uq_milestone_submission_id (milestone_id,id),
    UNIQUE KEY uq_milestone_submission_no (milestone_id,submission_no),
    UNIQUE KEY uq_milestone_submission_request (milestone_id,request_id),
    FOREIGN KEY (milestone_id) REFERENCES project_milestones(id),
    CONSTRAINT ck_milestone_submission_decision CHECK (decision IN ('PENDING','ACCEPTED','CHANGES_REQUESTED')),
    CONSTRAINT ck_milestone_submission_review CHECK ((decision='PENDING')=(reviewed_at IS NULL) AND (reviewed_at IS NULL)=(reviewed_by IS NULL)),
    CONSTRAINT ck_milestone_feedback CHECK (decision<>'CHANGES_REQUESTED' OR CHAR_LENGTH(TRIM(feedback))>0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

ALTER TABLE project_milestones ADD CONSTRAINT fk_milestone_latest_submission
    FOREIGN KEY (id,latest_submission_id) REFERENCES milestone_submissions(milestone_id,id);

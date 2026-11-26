CREATE TABLE task_organization (
    task_id BIGINT NOT NULL PRIMARY KEY,
    checklist JSON NOT NULL,
    tags JSON NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    updated_by CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    FOREIGN KEY(task_id) REFERENCES tasks(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

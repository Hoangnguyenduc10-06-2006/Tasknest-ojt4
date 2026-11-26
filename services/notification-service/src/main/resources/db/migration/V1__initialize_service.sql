-- Infrastructure marker only. Domain schema will be introduced in later migrations.
CREATE TABLE service_metadata (
    service_name VARCHAR(64) PRIMARY KEY,
    initialized_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
INSERT INTO service_metadata (service_name) VALUES ('notification-service');

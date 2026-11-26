#!/bin/bash
set -euo pipefail
# Local passwords are generated as 48 hexadecimal characters by setup-local.py.
for secret in "$IDENTITY_DB_PASSWORD" "$WORK_DB_PASSWORD" "$NOTIFICATION_DB_PASSWORD"; do
  [[ "$secret" =~ ^[a-fA-F0-9]{48}$ ]] || { echo 'Use generated 48-character hexadecimal local DB passwords.' >&2; exit 1; }
done
export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"
mysql --protocol=socket -uroot <<SQL
CREATE DATABASE tasknest_identity CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE DATABASE tasknest_work CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE DATABASE tasknest_notification CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER 'tasknest_identity'@'%' IDENTIFIED BY '${IDENTITY_DB_PASSWORD}';
CREATE USER 'tasknest_work'@'%' IDENTIFIED BY '${WORK_DB_PASSWORD}';
CREATE USER 'tasknest_notification'@'%' IDENTIFIED BY '${NOTIFICATION_DB_PASSWORD}';
GRANT ALL PRIVILEGES ON tasknest_identity.* TO 'tasknest_identity'@'%';
GRANT ALL PRIVILEGES ON tasknest_work.* TO 'tasknest_work'@'%';
GRANT ALL PRIVILEGES ON tasknest_notification.* TO 'tasknest_notification'@'%';
SQL

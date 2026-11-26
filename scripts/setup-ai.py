#!/usr/bin/env python3
"""Add AI credentials and provision only tasknest_ai on existing or new local Compose MySQL.
Never sources .env as shell; never prints generated credentials or changes existing passwords.
"""
from pathlib import Path
import os
import re
import secrets
import subprocess

root = Path(__file__).resolve().parents[1]
def main():
    path = root / '.env'
    text = path.read_text()
    match = re.search(r'^AI_DB_PASSWORD=(.*)$', text, re.M)
    password = match.group(1).strip().strip("\"'") if match else ''
    if not password:
        password = secrets.token_hex(24)
        text = re.sub(r'^AI_DB_PASSWORD=.*$', 'AI_DB_PASSWORD=' + password, text, flags=re.M) if match else text.rstrip() + '\nAI_DB_PASSWORD=' + password + '\n'
    if not re.fullmatch(r'[a-fA-F0-9]{48}', password):
        raise SystemExit('AI_DB_PASSWORD must be a generated 48-character hexadecimal value; existing setting kept.')
    for key, value in [('AI_ENABLED', 'false'), ('AI_PROVIDER', 'groq'), ('AI_API_KEY', ''), ('AI_MODEL', 'openai/gpt-oss-120b')]:
        if not re.search(r'^' + key + '=', text, re.M): text = text.rstrip() + '\n' + key + '=' + value + '\n'
    os.chmod(path, 0o600)
    path.write_text(text)
    compose = ['docker', 'compose', '--env-file', str(path), '-f', str(root / 'infra/compose/compose.yml')]
    subprocess.run(compose + ['up', '-d', '--wait', 'mysql'], check=True)
    # Existing users keep their credentials. Wrong existing passwords fail at ai-service startup.
    sql = f"""CREATE DATABASE IF NOT EXISTS tasknest_ai CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER IF NOT EXISTS 'tasknest_ai'@'%' IDENTIFIED BY '{password}';
GRANT ALL PRIVILEGES ON tasknest_ai.* TO 'tasknest_ai'@'%';
"""
    subprocess.run(compose + ['exec', '-T', 'mysql', 'sh', '-c', 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot'], input=sql, text=True, check=True)
    print('AI database provisioned. No existing business data or credentials changed. API key was not printed.')

if __name__ == '__main__': main()

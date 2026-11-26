#!/usr/bin/env python3
"""Generate ignored local credentials without overwriting existing configuration."""
from pathlib import Path
import secrets
from auth_secrets import generate_auth_secrets
root = Path(__file__).resolve().parents[1]
target = root / '.env'
if target.exists():
    raise SystemExit('.env already exists; keeping your configuration.')
auth_values = generate_auth_secrets()
lines = []
for line in (root / '.env.example').read_text().splitlines():
    if line and not line.startswith('#') and line.endswith('_PASSWORD='):
        line += secrets.token_hex(24)
    if '=' in line and not line.startswith('#'):
        key, value = line.split('=', 1)
        if key in auth_values and not value:
            line = key + '=' + auth_values[key]
    lines.append(line)
with target.open('x') as output:
    target.chmod(0o600)
    output.write('\n'.join(lines) + '\n')
print('Created .env for local development. Credentials were not printed.')

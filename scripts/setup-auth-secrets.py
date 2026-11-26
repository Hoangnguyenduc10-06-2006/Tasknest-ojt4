#!/usr/bin/env python3
"""Add only missing auth secrets to an existing ignored .env; preserve all existing values."""
from pathlib import Path
import os
from auth_secrets import generate_auth_secrets

root = Path(__file__).resolve().parents[1]
path = root / '.env'
if not path.is_file():
    raise SystemExit('Run python3 scripts/setup-local.py first.')
content = path.read_text()
lines = content.splitlines()
values = dict(line.split('=', 1) for line in lines if line and not line.startswith('#') and '=' in line)
required = ('TASKNEST_PROXY_KEY', 'IDENTITY_JWT_PRIVATE_KEY_BASE64', 'IDENTITY_OUTBOX_KEY_BASE64', 'IDENTITY_OUTBOX_KEY_ID')
missing = [key for key in required if not values.get(key)]
if not missing:
    print('Auth secrets already configured; nothing changed.')
    raise SystemExit(0)
# Never generate a new key ID for an existing ciphertext key, or a new key for an existing key ID.
if (bool(values.get('IDENTITY_OUTBOX_KEY_BASE64')) != bool(values.get('IDENTITY_OUTBOX_KEY_ID'))):
    raise SystemExit('Partial outbox key configuration: recover its matching key/key ID; do not rotate automatically.')
new_values = generate_auth_secrets()
for key in missing:
    replacement = key + '=' + new_values[key]
    if key in values:
        lines = [replacement if line.startswith(key + '=') else line for line in lines]
    else:
        lines.append(replacement)
# Atomic replacement, restrictive mode. A failed generation never truncates the previous file.
temporary = path.with_name('.env.auth-tmp')
fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
try:
    with os.fdopen(fd, 'w') as output:
        output.write('\n'.join(lines) + '\n')
    temporary.replace(path)
finally:
    temporary.unlink(missing_ok=True)
print('Added missing auth configuration. Secrets were not printed; existing values were preserved.')

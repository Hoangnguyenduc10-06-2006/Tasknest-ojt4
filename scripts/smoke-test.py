#!/usr/bin/env python3
"""Checks actual routing, contract, correlation and closed business surface."""
import json
import os
from pathlib import Path
import sys
import time
import urllib.error
import urllib.request
settings = {}
env_file = Path(__file__).resolve().parents[1] / '.env'
if env_file.exists():
    settings = dict(line.split('=', 1) for line in env_file.read_text().splitlines() if line and not line.startswith('#') and '=' in line)
port = os.environ.get('FRONTEND_PORT', settings.get('FRONTEND_PORT', '3000'))
base = (sys.argv[1] if len(sys.argv) > 1 else f'http://localhost:{port}').rstrip('/')
checks = {'/api/status': 'api-gateway', '/api/identity/status': 'identity-service', '/api/work/status': 'work-service', '/api/notifications/status': 'notification-service'}
for path, service in checks.items():
    for attempt in range(60):
        try:
            req = urllib.request.Request(base + path, headers={'X-Correlation-ID': 'tasknest-smoke'})
            with urllib.request.urlopen(req, timeout=8) as response:
                payload = json.load(response)
                assert payload == {'service': service, 'stage': 'scaffold'}, (path, payload)
                assert response.headers.get('X-Correlation-ID') == 'tasknest-smoke'
            print('PASS', path)
            break
        except (urllib.error.URLError, TimeoutError):
            if attempt == 59: raise
            time.sleep(2)
for path in ['/api/ai/status', '/api/work/projects', '/api/identity/users', '/api/notifications/inbox', '/ws', '/actuator/metrics', '/eureka/apps']:
    try:
        with urllib.request.urlopen(base + path, timeout=8) as response:
            if path.startswith('/api/') or path == '/ws':
                raise AssertionError('Protected path allowed: ' + path)
            # A frontend SPA fallback is allowed, actual internal data is not.
            assert response.headers.get_content_type() == 'text/html', path
            assert '<html' in response.read().decode().lower(), path
    except urllib.error.HTTPError as error:
        assert error.code in (401, 403, 404), (path, error.code)
    print('PASS protected/unrouted', path)
print('Scaffold smoke test passed. This is not business acceptance testing.')

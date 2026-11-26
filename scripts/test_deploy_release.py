"""Exercise release failure boundaries without SSH, registry or a real database."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).with_name('deploy-release.sh').resolve()
SHA = 'a' * 40


class ReleaseChecks(unittest.TestCase):
    def run_release(self, mode):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / '.env').write_text('server-only-secret=true\n')
            release = root / 'deploy' / 'releases' / SHA
            (release / 'scripts').mkdir(parents=True)
            (release / 'scripts' / 'smoke-test.py').write_text('print("smoke passed")\n')
            (root / 'deploy' / 'current-release').write_text('previous-sha\n')
            binary = root / 'bin'
            binary.mkdir()
            docker = binary / 'docker'
            docker.write_text('''#!/usr/bin/env python3
import json,os,sys
from pathlib import Path
a=sys.argv[1:]
with open(os.environ['TRACE'],'a') as f:f.write(' '.join(a)+'\\n')
mode=os.environ['TEST_MODE']
if a[0]=='login': sys.stdin.read();sys.exit(0)
if 'config' in a and '--format' in a:
 services={'mysql':{'ports':[{'target':3306,'published':'13307','host_ip':'0.0.0.0'}],'labels':{'tasknest.mysql.allowed-ip':'' if mode=='missing-db-ip' else '116.96.44.176'}} if mode in ('public-db','missing-db-ip') else {},'notification-service':{'environment':{'PUBLIC_APP_ORIGIN':'http://bad.test' if mode=='insecure' else 'https://tasknest.tech'}},'identity-service':{'environment':{'IDENTITY_COOKIE_SECURE':'true','IDENTITY_ALLOWED_ORIGINS':'https://tasknest.tech'}}}
 if '--profile' in a:
  services['ai-service']={'environment':{'AI_ENABLED':'true' if mode.startswith('ai-') else 'false','DB_PASSWORD':'private-ai-password' if mode=='ai-configured' else ''}}
 print(json.dumps({'services': services}))
elif 'pull' in a and mode=='pull-failed':sys.exit(1)
elif 'ps' in a:print('existing-mysql')
elif 'exec' in a:
 if mode=='backup-failed':sys.exit(1)
 print('-- backup content')
elif 'up' in a and mode=='unhealthy':sys.exit(1)
elif 'port' in a:print('127.0.0.1:3000')
''')
            docker.chmod(0o700)
            iptables = binary / 'iptables'
            iptables.write_text('#!/bin/sh\necho "firewall $*" >> "$TRACE"\nif [ "$1" = "-C" ]; then exit 1; fi\n')
            iptables.chmod(0o700)
            # macOS may not ship flock; real deployments require Linux flock.
            flock = binary / 'flock'
            flock.write_text('#!/bin/sh\nexit 0\n')
            flock.chmod(0o700)
            trace = root / 'trace'
            env = {**os.environ, 'PATH': str(binary) + os.pathsep + os.environ['PATH'], 'TRACE': str(trace), 'TEST_MODE': mode}
            result = subprocess.run(['bash', str(SCRIPT), str(root), SHA, 'ghcr.io/example/tasknest', 'example'], input='temporary-registry-token\n', text=True, env=env, capture_output=True)
            return (result.returncode, (root / 'deploy' / 'current-release').read_text().strip(), trace.read_text(), list((root / 'deploy' / 'backups').glob('*.gz')), result.stdout + result.stderr)

    def test_success_updates_release_only_after_smoke(self):
        code, marker, trace, backups, output = self.run_release('success')
        self.assertEqual(code, 0, output)
        self.assertEqual(marker, SHA)
        self.assertEqual(len(backups), 1)
        self.assertIn('--no-build --wait', trace)
        self.assertNotIn('temporary-registry-token', trace + output)

    def test_provisioned_ai_is_pulled_and_started_with_release(self):
        code, marker, trace, _, output = self.run_release('ai-configured')
        self.assertEqual(code, 0, output)
        self.assertEqual(marker, SHA)
        self.assertIn('--profile ai pull', trace)
        self.assertIn('--profile ai up', trace)
        self.assertNotIn('private-ai-password', trace + output)

    def test_ai_database_must_be_configured_to_automatically_enable_profile(self):
        code, marker, trace, _, output = self.run_release('ai-missing-db-password')
        self.assertEqual(code, 0, output)
        self.assertEqual(marker, SHA)
        self.assertNotIn('--profile ai pull', trace)
        self.assertNotIn('--profile ai up', trace)

    def test_public_database_restricts_source_before_start(self):
        code, _, trace, _, output = self.run_release('public-db')
        self.assertEqual(code, 0, output)
        self.assertIn('firewall -I DOCKER-USER 1', trace)
        self.assertIn('116.96.44.176/32', trace)
        self.assertLess(trace.index('firewall -I'), trace.index(' up '))

    def test_public_database_requires_client_ip(self):
        code, _, trace, _, _ = self.run_release('missing-db-ip')
        self.assertNotEqual(code, 0)
        self.assertNotIn(' up ', trace)

    def test_failed_backup_never_updates_services(self):
        code, marker, trace, _, _ = self.run_release('backup-failed')
        self.assertNotEqual(code, 0)
        self.assertEqual(marker, 'previous-sha')
        self.assertNotIn(' up ', trace)

    def test_unhealthy_release_keeps_previous_marker(self):
        code, marker, _, _, _ = self.run_release('unhealthy')
        self.assertNotEqual(code, 0)
        self.assertEqual(marker, 'previous-sha')

    def test_invalid_https_or_failed_pull_never_updates_services(self):
        for mode in ('insecure', 'pull-failed'):
            with self.subTest(mode=mode):
                code, marker, trace, _, _ = self.run_release(mode)
                self.assertNotEqual(code, 0)
                self.assertEqual(marker, 'previous-sha')
                self.assertNotIn(' up ', trace)


if __name__ == '__main__':
    unittest.main()

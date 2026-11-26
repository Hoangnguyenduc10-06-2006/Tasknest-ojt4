#!/usr/bin/env python3
"""Scan the actual executable JAR inventory against OSV; network failures fail the check.
Only public Maven coordinates are submitted; no source, environment or credentials leave the machine.
"""
import io
import json
from pathlib import Path
import sys
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]

def inventory():
    packages = set()
    jars = list(ROOT.glob('platform/*/target/*-SNAPSHOT.jar')) + list(ROOT.glob('services/*/target/*-SNAPSHOT.jar'))
    if len(jars) != 7: raise RuntimeError('Build all seven modules with ./mvnw verify before scanning.')
    for jar in jars:
        with zipfile.ZipFile(jar) as outer:
            for name in outer.namelist():
                if not name.startswith('BOOT-INF/lib/') or not name.endswith('.jar'): continue
                with zipfile.ZipFile(io.BytesIO(outer.read(name))) as inner:
                    for meta in inner.namelist():
                        if not meta.startswith('META-INF/maven/') or not meta.endswith('/pom.properties'): continue
                        props = dict(line.split('=', 1) for line in inner.read(meta).decode().splitlines()
                                     if '=' in line and not line.startswith('#'))
                        if all(k in props for k in ('groupId', 'artifactId', 'version')):
                            packages.add((props['groupId'] + ':' + props['artifactId'], props['version']))
    return sorted(packages)

def main():
    packages = inventory()
    query = {'queries': [{'package': {'ecosystem': 'Maven', 'name': name}, 'version': version} for name, version in packages]}
    request = urllib.request.Request('https://api.osv.dev/v1/querybatch', data=json.dumps(query).encode(), headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(request, timeout=60) as response: results = json.load(response)['results']
    if len(results) != len(packages): raise RuntimeError('Incomplete OSV response')
    hits = [{'package': name, 'version': version, 'ids': [v['id'] for v in result.get('vulns', [])]}
            for (name, version), result in zip(packages, results) if result.get('vulns')]
    print(json.dumps({'metadata_package_count': len(packages), 'hits': hits}, indent=2))
    return 1 if hits else 0

if __name__ == '__main__': sys.exit(main())

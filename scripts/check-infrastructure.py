#!/usr/bin/env python3
"""Integration checks against the running Compose scaffold. No persistent data is modified."""
import os, subprocess, json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
compose=[str(root/'scripts/compose.sh')]
def run(args):return subprocess.run(compose+args,cwd=root,capture_output=True,text=True)
for dbuser,other in [('tasknest_identity','tasknest_work'),('tasknest_work','tasknest_notification'),('tasknest_notification','tasknest_identity')]:
 key=dbuser.removeprefix('tasknest_').upper()+'_DB_PASSWORD'
 command=f'MYSQL_PWD="${key}" mysql --protocol=TCP -h127.0.0.1 -u{dbuser} --batch --skip-column-names -e "SELECT COUNT(*) FROM {dbuser}.flyway_schema_history;"'
 result=run(['exec','-T','mysql','bash','-c',command]);assert result.returncode==0,result.stderr
 command=f'MYSQL_PWD="${key}" mysql --protocol=TCP -h127.0.0.1 -u{dbuser} --batch --skip-column-names -e "SELECT * FROM {other}.service_metadata;"'
 result=run(['exec','-T','mysql','bash','-c',command]);assert result.returncode!=0 and 'denied' in result.stderr,result.stderr
 print('PASS own migration / cross-database denied:',dbuser)
for target,path in [('config-server','identity-service/default'),('discovery-server','eureka/apps')]:
 port='8888' if target=='config-server' else '8761'
 result=run(['exec','-T',target,'curl','-s','-o','/dev/null','-w','%{http_code}',f'http://localhost:{port}/{path}'])
 assert result.stdout=='401',(target,result.stdout)
 print('PASS unauthenticated internal endpoint denied:',target)
# Prove Config is required on a one-off container without stopping the running stack.
result=run(['run','--rm','--no-deps','-e','CONFIG_SERVER_URL=http://127.0.0.1:1','identity-service'])
assert result.returncode!=0
assert 'Could not locate PropertySource' in result.stdout+result.stderr or 'Connection refused' in result.stdout+result.stderr
print('PASS missing Config prevents application startup')

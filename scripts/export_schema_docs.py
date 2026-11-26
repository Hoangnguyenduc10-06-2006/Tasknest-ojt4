"""Export physical schema docs from test-schema's disposable, migrated MySQL only."""
import json
import os
import re
import subprocess


def export_schema_docs(root, query, container):
    markdown = ['# Từ điển dữ liệu TaskNest', '',
                'Sinh từ schema vật lý sau toàn bộ migration Flyway. Không đọc database đang sử dụng.', '',
                'Nguồn nghiệp vụ: [RULE v2.0](../../RULE.md). Quy trình ghi và giới hạn CHECK/FK: [hướng dẫn schema](README.md) và [cộng tác/tài liệu](COLLABORATION_AND_FILES.md).', '',
                'UUID tài khoản là CHAR(36) ASCII phân biệt hoa/thường. ID dự án/nhiệm vụ/tài liệu là BIGINT. Ngày giờ DATETIME(6) lưu UTC; ngày nghiệp vụ DATE theo Asia/Ho_Chi_Minh.', '']
    snapshot = ['-- TaskNest current physical schema; generated from all Flyway migrations.',
                '-- REFERENCE ONLY: use service Flyway migrations to deploy; do not import this snapshot.',
                '-- No application records, credentials, or Flyway history are exported.', '']
    counts = {}
    for service in ('identity', 'work', 'notification'):
        versions = ', '.join(m.name.split('__')[0] for m in sorted((root / f'services/{service}-service/src/main/resources/db/migration').glob('V*.sql')))
        markdown += [f'## {service.title()} — {versions}', '']
        snapshot += [f'-- {service}: {versions}', f'USE `tasknest_{service}`;', '']
        tables = query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' AND TABLE_NAME <> 'flyway_schema_history' ORDER BY TABLE_NAME;", service).splitlines()
        counts[service] = len(tables)
        for table in tables:
            columns = query("SELECT JSON_OBJECT('name',COLUMN_NAME,'type',COLUMN_TYPE,'null',IS_NULLABLE,'default',COLUMN_DEFAULT,'extra',EXTRA,'generated',GENERATION_EXPRESSION) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='" + table + "' ORDER BY ORDINAL_POSITION;", service)
            markdown += [f'### {table}', '', '| Cột | Kiểu SQL | NULL | Mặc định / sinh tự động |', '|---|---|---|---|']
            def cell(value):
                return str(value).replace('|', '\\|').replace('\n', ' ')
            for raw in columns.splitlines():
                col = json.loads(raw)
                default = col['generated'] or (col['default'] if col['default'] is not None else '—')
                if col['extra']:
                    default = str(default) + '; ' + col['extra']
                markdown.append(f"| `{col['name']}` | `{cell(col['type'])}` | {'Có' if col['null']=='YES' else 'Không'} | {cell(default)} |")
            constraints = query("SELECT CONCAT(CONSTRAINT_TYPE, ': ', CONSTRAINT_NAME) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='" + table + "' ORDER BY CONSTRAINT_TYPE,CONSTRAINT_NAME;", service)
            markdown += ['', 'Ràng buộc: ' + '; '.join('`' + cell(c) + '`' for c in constraints.splitlines()) + '.', '']
            result = subprocess.run(['docker', 'exec', '-e', 'MYSQL_PWD', container, 'mysql', '-uroot', '--raw', '--batch', '--skip-column-names', 'tasknest_' + service, '-e', 'SHOW CREATE TABLE `' + table + '`;'], check=True, capture_output=True, text=True, env=os.environ).stdout
            ddl = result.split('\t', 1)[1].strip()
            snapshot += [re.sub(r' AUTO_INCREMENT=\d+', '', ddl) + ';', '']
    total = sum(counts.values())
    markdown[2:2] = [f'**{total} bảng ứng dụng**: Identity {counts["identity"]}, Work {counts["work"]}, Notification {counts["notification"]}; đã tính service_metadata, chưa tính flyway_schema_history.', '']
    folder = root / 'docs/database'
    (folder / 'DATA_DICTIONARY.md').write_text('\n'.join(markdown).rstrip() + '\n')
    (folder / 'SCHEMA_CURRENT.sql').write_text('\n'.join(snapshot).rstrip() + '\n')
    print(f'Exported current dictionary and DDL snapshot: {total} application tables.', flush=True)

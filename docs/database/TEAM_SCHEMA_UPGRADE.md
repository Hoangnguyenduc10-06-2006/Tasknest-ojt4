# Pull code và áp dụng schema mới — dành cho cả nhóm

Phiên bản hiện tại: **Identity V5, Work V4, Notification V4**. Schema đầy đủ có 38 bảng ứng dụng và 3 bảng flyway_schema_history. Chỉ Flyway của service sở hữu database được áp dụng migration; không chạy lại SCHEMA_CURRENT.sql hoặc sửa migration đã có.

## 1. Máy đã chạy TaskNest bằng Docker và có dữ liệu

Cần Docker Desktop/Compose, Python 3 và **JDK 21**. Dừng các Spring Boot instance chạy từ IntelliJ/terminal để chúng không ghi vào database trong lúc nâng cấp. Không cần đóng IntelliJ hoặc dừng các dự án Docker khác.

Nếu đang ở main và đã lưu/commit công việc của mình:

```sh
git status
git switch main
git pull --ff-only origin main
java -version
python3 scripts/upgrade-local-schema.py
```

Nếu đang làm trên feature branch, commit công việc của mình trước, sau đó cập nhật main vào nhánh hiện tại:

```sh
git fetch origin
git merge origin/main
python3 scripts/upgrade-local-schema.py
```

Windows PowerShell có thể dùng `python` thay `python3`. Đặt JAVA_HOME tới JDK 21 nếu `java -version` chưa đúng. Ví dụ PowerShell:

```powershell
$env:JAVA_HOME = 'C:\duong-dan\jdk-21'
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
python scripts/upgrade-local-schema.py
```

macOS có thể dùng JDK đã cài:

```sh
export JAVA_HOME=$(/usr/libexec/java_home -v 21)
python3 scripts/upgrade-local-schema.py
```

Không đổi password .env để khắc phục lỗi kết nối với database đã tạo. Nếu code mới báo thiếu khóa xác thực, bổ sung **chỉ khóa còn thiếu** bằng `python3 scripts/setup-auth-secrets.py`; script này giữ giá trị đang có. Nếu mất một phần cặp khóa/key ID của outbox, khôi phục cặp gốc thay vì tạo khóa mới cho ciphertext cũ.

### Script tự thực hiện

1. Xác định stack MySQL của repository và dùng lại đúng các file Compose đang chạy, kể cả override cổng IDE trên từng máy. Không cần mở cổng 3306/3307 trên host để migrate.
2. Kiểm tra .env tương thích với container MySQL hiện tại, build và chạy Java verify. Dùng mật khẩu trong bộ nhớ; không in secret/config ra terminal.
3. Giữ binary/config container cũ trong thư mục backup riêng; build image Identity/Work/Notification/Gateway mới trước khi dừng ứng dụng.
4. Dừng frontend, Gateway và các service ghi dữ liệu. Giữ MySQL, RabbitMQ, Config, Discovery và volume đang có.
5. Dump ba database, khôi phục vào MySQL tạm rồi chạy Flyway trên bản khôi phục trước. Kiểm tra số bản ghi cũ, dữ liệu tài khoản, phiên bản và hàng quota dự án.
6. Chạy cùng migration lên MySQL thật bằng một Java container tạm, không bật publisher/consumer trong lúc ba schema đang nâng cấp.
7. Kiểm tra dữ liệu, khởi động service mới, chờ healthy và bật lại Gateway/frontend. Xóa container kiểm chứng và file môi trường tạm chứa secret; giữ backup và log tại `local/schema-backups/<thoi-diem>/`.

Thành công kết thúc bằng COMPLETE. `.env`, SQL backup, cấu hình chứa secret, binary cũ và log trong local/ **không được commit/chia sẻ lên Git**. Trên Windows, đặt quyền truy cập thư mục backup chỉ cho tài khoản máy của mình theo thiết lập ACL của máy.

`--skip-build` chỉ dùng khi đã chạy Java verify cho đúng source hiện tại; mặc định không dùng. Script vẫn so sánh migration trong JAR với source để chặn JAR cũ.

### Nếu gặp lỗi

- Trước khi dừng writer: sửa lỗi Java/Docker/config theo log rồi thử lại; chưa có thay đổi schema.
- Nếu script báo writer đã dừng: xem `state.json`, `clone-migration.log`, `live-migration.log`, `build.log` và `images.log` trong thư mục backup được in ra. Không chạy repair/reset hoặc lặp lại mù quáng vì MySQL DDL tự commit.
- Nếu live migration dở dang: giữ ứng dụng dừng; khôi phục đồng bộ database từ backup đã kiểm tra và binary/config tương ứng. Không dùng binary cũ ghi vào schema mới khi chưa xác định tương thích.
- Lịch sử migration từ nhánh cũ có V2 khác checksum phải được xử lý riêng. Không sửa checksum hoặc xóa volume để bỏ qua.
- Nếu Work đã có metadata tệp: script dừng từ preflight vì bản sao SQL không chứa bytes trên Docker volume. Khi đã triển khai upload, cần dừng writer rồi sao lưu/kiểm tra khôi phục **database và volume tệp cùng mốc** trước khi nâng; dùng quy trình ở [COLLABORATION_AND_FILES.md](COLLABORATION_AND_FILES.md). Bản nâng từ Work V3 hiện tại chưa có tệp nên không cần sao lưu volume tệp mới.

Nếu database còn ID tài khoản dạng số và có đúng lịch sử migration cũ của repository, Flyway áp dụng cả migration UUID. Dữ liệu tài khoản được đối chiếu theo ánh xạ UUID đã quy định; các phiên cũ sẽ bị thu hồi bởi Identity V4 và người dùng cần đăng nhập lại. Nếu đã là UUID/V5 thì không đổi lại ID hoặc thu hồi phiên thêm chỉ vì nâng Work/Notification V4.

## 2. Máy mới, chưa có .env hoặc stack Docker

Từ thư mục repository, tạo cấu hình một lần rồi build bằng Java 21:

```sh
python3 scripts/setup-local.py
./mvnw -B verify
docker compose --env-file .env -f infra/compose/compose.yml up -d --build --wait
```

Windows dùng `python scripts/setup-local.py` và `.\mvnw.cmd -B verify`. Nếu cần override riêng để mở MySQL cho IDE, giữ file override cục bộ và dùng thêm `-f <file-override>` trong lệnh Compose. Không lấy cổng, password hoặc .env của người khác. Khi stack đã chạy, script nâng cấp sẽ tự nhận lại các file Compose đó.

Flyway tự tạo schema mới nhất khi các service khởi động; không import DDL thủ công. Chỉ chạy setup-local lần đầu, không chạy lại để thay cấu hình hoặc xóa dữ liệu đang sử dụng.

## 3. Kiểm tra sau nâng cấp

```sh
docker compose --env-file .env -f infra/compose/compose.yml ps
```

Trong IDE/MySQL, kiểm tra:

```sql
SELECT version, description, success
FROM tasknest_identity.flyway_schema_history ORDER BY installed_rank;
SELECT version, description, success
FROM tasknest_work.flyway_schema_history ORDER BY installed_rank;
SELECT version, description, success
FROM tasknest_notification.flyway_schema_history ORDER BY installed_rank;
```

Dòng mới nhất phải là 5/4/4 và success=1. Refresh datasource trong IDE để thấy các bảng/cột mới. Kiểm tra ứng dụng tại cổng frontend của máy mình (mặc định http://localhost:3000), `/api/status` và `/api/work/status` trả 200. Thiếu phiên hợp lệ khi tạo dự án phải trả 401.

Nếu container healthy nhưng Gateway gọi Work lỗi 503, kiểm tra đăng ký Eureka. HTTP client gọi địa chỉ vật lý Config/Eureka phải dùng builder thường; client gọi service ID mới dùng builder @LoadBalanced được chỉ định rõ. Khung hiện tại đã tách hai loại và có kiểm thử hồi quy.

Không chạy `docker compose down -v`, không xóa mysql-data và không đổi `ddl-auto=validate` sang update. Tên bảng/cột trong [DATA_DICTIONARY.md](DATA_DICTIONARY.md) và [SCHEMA_CURRENT.sql](SCHEMA_CURRENT.sql) là hợp đồng dùng chung cho backend/frontend.

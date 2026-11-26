# TaskNest

Bộ khung monorepo cho hệ thống quản lý công việc và dự án. Yêu cầu nghiệp vụ ở [RULE.md](local/RULE.md) và [SRS.md](local/SRS.md).

Links Rule: https://docs.google.com/document/d/1azQKmuLXqE6lXGEXaKgxwhXW6OxJQUrP2KANB4sMLSE/edit?usp=sharing
Links SRS: https://docs.google.com/document/d/1Smu0DL9cbJ9SqSmOb1lBA4oGAldz5OcU_XegqKhhpIM/edit?usp=sharing
Links Jira: https://khanhanke.atlassian.net/jira/software/projects/SCRUM/boards/1?filter=&groupBy=none
Links Figma: https://www.figma.com/design/RJQ7mMCNWhOWSUYlhlAjBR/TaskNest---OJT?node-id=0-1&p=f&t=cIYZ6RdsnVWzG8Jt-0
## Cấu trúc

```text
frontend/                       React + TypeScript + Tailwind, Vite
platform/
  config-server/                Spring Cloud Config, cổng nội bộ 8888
  discovery-server/             Eureka, cổng nội bộ 8761
  api-gateway/                  Gateway WebFlux, cổng nội bộ 8080
services/
  identity-service/             Tài khoản, phiên đăng nhập — 8081
  work-service/                 Dự án, thành viên, task, ghi giờ — 8082
  notification-service/         Thông báo, email, realtime — 8083
  ai-service/                   Configurable AI foundation (Groq/OpenRouter, profile ai) — 8084
infra/
  config-repo/                  Cấu hình có phiên bản, không chứa bí mật
  compose/                      Stack local và override phát triển
  mysql/init/                   Ba database và ba tài khoản riêng
  reverse-proxy/                Nginx phục vụ frontend và proxy Gateway
local/                          Tài liệu, hướng dẫn và bản render; không đưa lên GitHub
scripts/                        Khởi tạo môi trường, chạy và kiểm tra
```

## Chạy lần đầu

Cần **JDK 21**, **Docker Engine + Compose v2**, Python 3. Frontend phát triển trên **Node 24 LTS** (Node 20.19+/22.13+ cũng được Vite hỗ trợ). Maven Wrapper đã kèm theo, không cần cài Maven. Chạy các lệnh từ thư mục gốc.

Trên macOS có nhiều JDK, chọn Java 21 trước:

```sh
export JAVA_HOME=$(/usr/libexec/java_home -v 21)
./scripts/dev.sh
```

Linux/Windows: đặt `JAVA_HOME` tới JDK 21; script shell chạy bằng Bash/WSL hoặc Git Bash. Windows có thể build backend bằng `mvnw.cmd verify` và dùng các lệnh tương đương dưới đây.

`dev.sh` tạo `.env` riêng nếu chưa có, build/test sáu ứng dụng, build image, đợi các container healthy và chạy smoke test. Mật khẩu local được sinh ngẫu nhiên, `.env` bị Git bỏ qua. Tệp mẫu là `.env.example`.

Mở **http://localhost:3000**. Trang khởi đầu hiển thị trạng thái Gateway và ba service, hỗ trợ Sáng/Tối/Theo hệ thống.

Các bước riêng lẻ:

```sh
python3 scripts/setup-local.py   # chỉ lần đầu, không ghi đè .env đã có
./mvnw -B verify
./scripts/compose.sh config --quiet
./scripts/compose.sh up -d --build --wait --wait-timeout 300
python3 scripts/smoke-test.py
```

Mặc định chỉ frontend được bind tới `127.0.0.1:3000`. API và WebSocket đi qua Nginx → Gateway; database, service, Config, Eureka và management port không publish ra host. Đây là cấu hình **local HTTP**, chưa phải cấu hình deploy production/TLS.

## Phát triển frontend

Mở cổng Gateway trên loopback bằng override, giữ backend trong Docker:

```sh
docker compose --env-file .env -f infra/compose/compose.yml -f infra/compose/compose.dev.yml up -d --wait
npm --prefix frontend ci
npm --prefix frontend run dev
```

Vite ở http://localhost:5173 proxy `/api` và `/ws` tới `localhost:8080`. Nếu đổi đích, sao chép `frontend/.env.example` thành `frontend/.env.local`. Không đưa secret vào biến `VITE_*`.

Đặt code theo phân hệ trong `src/features/`, thành phần dùng chung trong `src/shared/`, thành phần khởi tạo trong `src/app/`. Chưa thêm thư viện form/state/router khi chưa cần đến màn hình nghiệp vụ.

## Phát triển backend

Sau khi pull code có schema mới, xem [hướng dẫn nâng database cho thành viên](docs/database/TEAM_SCHEMA_UPGRADE.md). Máy đã có stack Docker dùng `python3 scripts/upgrade-local-schema.py` để build, sao lưu/kiểm tra khôi phục và nâng bằng Flyway; giữ nguyên volume và override cục bộ.

Khung nghiệp vụ dự án, API tạo dự án, DTO và cách dùng kiểm tra quyền chung: [hướng dẫn backend dự án](docs/projects/PROJECT_BACKEND_FOUNDATION.md). Tài liệu ghi rõ phần đã triển khai, phần việc bàn giao và cách chạy kiểm thử tích hợp trên MySQL tạm.

Mỗi module có `pom.xml`, main class, cấu hình, Dockerfile và có thể build riêng qua reactor:

```sh
./mvnw -B -pl services/work-service -am verify
./scripts/compose.sh up -d --build work-service
```

Service dùng các lớp `api`, `application`, `domain`, `infrastructure`, `config`. Chỉ thêm migration mới sau `V1`; không sửa migration đã chạy. Flyway quản lý schema; Hibernate dùng `validate`, không tự tạo/sửa bảng.

Schema hiện tại gồm 38 bảng ứng dụng: Identity đến V5, Work đến V4 và Notification đến V4, thống nhất theo [RULE v2.0](RULE.md). Xem [thiết kế, ERD và hướng dẫn migration](docs/database/README.md), [từ điển dữ liệu](docs/database/DATA_DICTIONARY.md). Chạy `python3 scripts/test-schema.py` để kiểm tra DDL và ràng buộc trên MySQL 8.4 riêng; thêm `--export-docs` để sinh từ điển và DDL snapshot; sau khi build JAR, thêm `--service-startup` để kiểm tra Flyway và khởi động lại cả ba service. Các lệnh không dùng database của stack local.

Config Server dùng native backend đọc `infra/config-repo/` gắn read-only để local không phụ thuộc GitHub. Thư mục này được quản lý phiên bản trong monorepo. Client import bắt buộc, không dùng `optional:`; Config khởi động độc lập trước Eureka. Cập nhật cấu hình bằng restart/recreate service liên quan; chưa có refresh động/Bus.

API lịch sử nộp/duyệt và tải tệp kết quả cũ: [hợp đồng backend](docs/tasks/SUBMISSION_HISTORY.md).

Xuất CSV tiến độ nhiệm vụ và nhật ký giờ làm: xem [hướng dẫn báo cáo dự án](docs/projects/PROJECT_REPORTS.md).

## Kiểm tra và vận hành local

```sh
./scripts/verify.sh              # backend test/build + npm ci/typecheck/lint/test/build
./scripts/compose.sh ps
./scripts/compose.sh logs --tail=100 work-service
./scripts/compose.sh stop        # giữ dữ liệu và container
./scripts/compose.sh down        # bỏ container, giữ volume dữ liệu
```

Không thêm `--volumes` khi muốn giữ dữ liệu. Thay mật khẩu trong `.env` không tự thay tài khoản trong volume MySQL/RabbitMQ đã tồn tại; cần chủ động rotation. Script MySQL local nhận mật khẩu DB 48 ký tự hexadecimal do `setup-local.py` tạo.

CI kiểm tra frontend, sáu module, Compose và smoke test trên môi trường riêng. Chưa push mã nguồn hoặc chạy workflow trên GitHub trong bước khởi tạo này.



## Identity Auth

Thiết lập khóa bền vững/Origin/rate limit và cập nhật môi trường cũ theo [docs/auth/SETUP.md](docs/auth/SETUP.md). Hướng dẫn cấu hình email Brevo, relay RabbitMQ và worker nằm tại [docs/auth/BREVO_SETUP.md](docs/auth/BREVO_SETUP.md). Đăng ký, xác nhận email và đăng nhập đã nối API thật; mail dùng outbox, RabbitMQ và Brevo.

Chi tiết các bản sửa bảo mật Auth, proxy IP, rate limit và kiểm thử: [docs/auth/SECURITY_FIXES.md](docs/auth/SECURITY_FIXES.md).

## AI Foundation

AI Service là thành phần tùy chọn, bật bằng profile `ai`. Xem [cấu hình Groq/OpenRouter và kiểm thử](docs/ai/GROQ_SETUP.md). Chặng 1 chưa đọc dữ liệu nghiệp vụ; các chức năng hiện có không phụ thuộc AI.

# Cấu hình và kiểm tra Identity Auth

## Chuẩn bị khóa bền vững

Máy cần Java 21, Python 3, OpenSSL và Docker. Không commit `.env`, không gửi khóa trong chat hoặc dùng khóa test cho triển khai.

Với checkout mới chưa có `.env`:

```sh
python3 scripts/setup-local.py
```

Với máy đã có `.env`:

```sh
python3 scripts/setup-auth-secrets.py
```

Script thứ hai chỉ thêm các khóa auth còn thiếu, giữ nguyên mật khẩu DB/RabbitMQ và cấu hình cũ. Khóa được lưu trong `.env` quyền 0600; không được in ra terminal. Chạy lại không rotation khóa. Nếu outbox chỉ có một nửa cặp key/key ID, script dừng để người vận hành khôi phục đúng cặp thay vì tự thay khóa.

| Biến | Mục đích |
|---|---|
| `IDENTITY_JWT_PRIVATE_KEY_BASE64` | RSA private key PKCS#8 DER, mã hóa base64. Backend suy ra public key và kid từ SHA-256 public key; cùng khóa cho cùng kid qua restart. |
| `IDENTITY_OUTBOX_KEY_BASE64` | Khóa AES-256 32 byte, mã hóa base64, bảo vệ token trong outbox. |
| `IDENTITY_OUTBOX_KEY_ID` | Định danh đúng phiên bản khóa outbox, phải được giữ cùng khóa. |
| `IDENTITY_ALLOWED_ORIGINS` | Danh sách origin frontend, ngăn cách dấu phẩy; gồm scheme/host/port, không thêm đường dẫn hoặc dấu `/` cuối. |
| `IDENTITY_COOKIE_SECURE` | Mặc định true; giữ true khi triển khai HTTPS. Chỉ đặt false cho phép thử local HTTP nếu cần. |

Config Repo và Compose đã truyền các biến này tới Identity. Thiếu khóa JWT/outbox thì service không khởi động. Các instance Identity dùng cùng secret bền vững theo môi trường; không chạy setup riêng để tạo các khóa khác nhau cho mỗi replica.

Khi chạy JAR trực tiếp thay vì Compose, nạp các biến bằng cơ chế môi trường của IDE/tiến trình; file `.env` không tự được Spring Boot đọc. Base64 chỉ là định dạng vận chuyển, không mã hóa private key. Khi triển khai, đưa secret vào cơ chế quản lý bí mật của máy chủ và giới hạn người được đọc, không đưa vào frontend hoặc Config Repo công khai.

## Build và khởi chạy

```sh
./mvnw -B verify
./scripts/compose.sh config --quiet
./scripts/compose.sh up -d --build --force-recreate identity-service
```

Không dùng `down --volumes` hoặc sửa checksum V1/V2. Identity tự áp dụng V3 bổ sung `account_tokens.issue_source` và index đếm resend. V3 giữ dữ liệu cũ, phân loại lần xác nhận đầu là REGISTER, các lần sau là RESEND theo lịch sử còn lưu. Số bảng không đổi; V1/V2 giữ nguyên.

Nếu đổi cấu hình mà Config Server đang chạy, file Config Repo được mount sẵn; recreate Identity để nó tải lại cấu hình. Nếu thay secret môi trường thì recreate container, không chỉ restart. Lệnh trên dành cho người dùng chủ động cập nhật stack của mình; phép kiểm thử của trợ lý không chạy vào database đó.

## Origin và CSRF cho client

- POST login/refresh-token/logout phải gửi Origin nằm trong allowlist. Browser tự thêm Origin; Postman phải cấu hình header này. Thiếu Origin hoặc origin lạ trả 403.
- Trước refresh/logout, GET `/api/identity/status` qua Gateway để nhận cookie `XSRF-TOKEN`; client gửi chính giá trị cookie đó trong `X-XSRF-TOKEN` cùng cookie HttpOnly refresh.
- CSRF và Origin là hai kiểm tra riêng. Cho phép origin không miễn CSRF. Không gửi refresh token trong JSON hoặc lưu vào localStorage.
- Postman collection cũ cần thêm Origin vào login/refresh/logout. Khi triển khai khác domain, kiểm tra lại cookie/SameSite/CORS và allowlist theo topology thực tế; không dùng `*` với credentials.

## Rate limit

Các giá trị dưới đây là mặc định vận hành để cơ chế hoạt động, chỉnh được bằng cấu hình, không phải thay đổi thông số nghiệp vụ đã chốt.

| Biến | Mặc định |
|---|---:|
| `AUTH_LOGIN_ACCOUNT_ATTEMPTS` | 10 yêu cầu/định danh/cửa sổ |
| `AUTH_LOGIN_ADDRESS_ATTEMPTS` | 100 yêu cầu/địa chỉ peer/cửa sổ |
| `AUTH_LOGIN_WINDOW_SECONDS` | 900 giây |
| `AUTH_REFRESH_SESSION_ATTEMPTS` | 30 yêu cầu/phiên/cửa sổ |
| `AUTH_REFRESH_ADDRESS_ATTEMPTS` | 100 yêu cầu/địa chỉ peer/cửa sổ |
| `AUTH_REFRESH_WINDOW_SECONDS` | 60 giây |

Đây là fixed-window **đếm yêu cầu**, gồm cả yêu cầu thành công; không mô tả thành bộ đếm chỉ các lần sai. Khi vượt trả 429 + Retry-After. Bộ đếm được upsert nguyên tử trong transaction riêng và commit trước khi báo lỗi, nên lỗi mật khẩu/restart không xóa giới hạn. Danh tính không tồn tại cũng bị giới hạn.

Địa chỉ lấy từ `request.getRemoteAddr()`, không tin X-Forwarded-For client tự gửi. Sau Gateway, nhiều người có thể chung một peer address, do đó hạn mức địa chỉ là hạn mức dùng chung của peer; hạn mức định danh/phiên vẫn độc lập xuyên instance. Không bật tin mọi forwarded header để né vấn đề này. Nếu cần giới hạn từng IP người dùng thật, phải cấu hình chuỗi proxy tin cậy và kiểm thử việc loại header giả tại ingress; phần đó chưa được thực hiện ở đây.

Dọn các bucket cũ theo kế hoạch vận hành, ví dụ xóa hàng có `window_end` cũ hơn 24 giờ; không xóa cửa sổ đang hiệu lực. Resend không dùng fixed-window này: vẫn kiểm tra 60 giây và tối đa **5 lần RESEND trong một giờ trượt**, không tính lần REGISTER ban đầu.

## Kiểm thử riêng

```sh
./mvnw -B -pl services/identity-service,services/work-service,services/notification-service,platform/api-gateway -am verify
python3 scripts/test-schema.py --service-startup
```

Script tạo MySQL tạm bằng tmpfs, cổng loopback ngẫu nhiên, secret và tài khoản thử riêng, không đọc `.env`/không dùng database của người dùng. Nó kiểm tra V2 → V3 trên fixture cũ, khởi động service với Flyway/JPA, HTTP auth/CSRF/Origin/rate limit/resend/concurrency, rồi restart kiểm tra JWKS/phiên/bộ đếm và cuối cùng xóa container thử. Timestamp token chỉ được điều chỉnh trong fixture riêng để không phải đợi 60 giây mỗi lần resend.

## Chuyển từ khóa tạm cũ

Khóa AES từng sinh trong RAM không thể khôi phục nếu process cũ đã mất. Không giả vờ rằng thêm khóa mới sẽ giải mã được outbox cũ. Giữ dữ liệu, xử lý sự kiện không giải mã được theo quy trình lỗi/DLQ và phát hành email xác nhận mới bằng luồng resend khi worker đã sẵn sàng. Không đánh dấu mail đã gửi hoặc xóa DB để bỏ qua lỗi.

Lần chuyển từ RSA tạm sang khóa bền vững cũng không giữ được chữ ký của JWT cũ nếu khóa cũ đã mất. Session/refresh hash trong DB vẫn còn; refresh hợp lệ cấp Access Token theo khóa mới. Sau bước chuyển này, giữ khóa ổn định. Chưa triển khai key ring/JWKS giữ nhiều khóa cho rotation có grace period; khi cần rotation phải thêm quy trình riêng, không đổi secret tùy tiện.

Luồng gửi Brevo đã triển khai, xem [BREVO_SETUP.md](BREVO_SETUP.md). Việc cấp JWT trong nhánh này chưa đồng nghĩa Gateway/Work/Notification đã có toàn bộ API nghiệp vụ và kiểm tra phiên/realtime; những phần chưa triển khai vẫn được deny theo bộ khung.

## Route được bảo vệ

Frontend chuyển người chưa đăng nhập sang `/login?returnTo=...` trước khi render trang nội bộ. Sau đăng nhập trở lại trang đích hợp lệ, mặc định `/dashboard`. Tải lại trang thực hiện refresh cookie + CSRF rồi gọi `GET /api/identity/auth/session` với Access Token Bearer.

Endpoint session tại Identity dùng Resource Server JWT: kiểm tra chữ ký, issuer/audience/thời hạn và sid còn hiệu lực. Gateway chuyển tiếp endpoint này, không tự coi cookie/ID người dùng là chứng minh xác thực. JWT của phiên đã đăng xuất trả 401 ngay tại endpoint này. Các API nghiệp vụ Work/Notification vẫn cần triển khai kiểm tra quyền tương ứng khi được xây dựng.

Có nút Đăng xuất trên thanh điều hướng. Sau đăng xuất, Quay lại hoặc gõ URL dashboard không được hiển thị nội dung nội bộ. Nếu mất kết nối trong lúc kiểm tra phiên, giao diện chặn nội dung và cho thử lại.

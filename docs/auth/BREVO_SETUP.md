# Đăng ký, xác nhận email và đăng nhập với Brevo

## Cấu hình

Cấu hình ở `.env` tại thư mục gốc; không đặt API key trong frontend, Git hoặc chat:

```dotenv
MAIL_ENABLED=true
BREVO_API_KEY=<API key Brevo>
MAIL_FROM_EMAIL=<sender đã xác nhận trong Brevo>
MAIL_FROM_NAME=TaskNest
PUBLIC_APP_ORIGIN=http://localhost:3000
```

`PUBLIC_APP_ORIGIN` là địa chỉ **frontend** mà người nhận mở được, không phải URL nội bộ service. Khi triển khai dùng domain HTTPS thực tế. API key dùng header `api-key`, khác SMTP key. Sender/domain cần được xác nhận theo [hướng dẫn Brevo](https://developers.brevo.com/docs/send-a-transactional-email).

Máy có `.env` cũ cần chạy một lần:

```sh
python3 scripts/setup-auth-secrets.py
```

Script thêm khóa JWT/AES bền vững còn thiếu, giữ nguyên các cấu hình khác. Identity và Notification dùng cùng khóa AES/key ID để chuyển token xác nhận dưới dạng mã hóa. `MAIL_ENABLED=false` tắt cả relay và worker; khi bật thì bắt buộc có đủ khóa, sender và public origin.

Với môi trường local HTTP, đặt `IDENTITY_COOKIE_SECURE=false`. Khi triển khai HTTPS phải đặt true. `IDENTITY_ALLOWED_ORIGINS` phải bao gồm origin bạn mở: `http://localhost:3000`, `http://localhost:5173` hoặc `http://127.0.0.1:5173` tương ứng; phân cách bằng dấu phẩy.

Sau khi chạy kiểm thử thành công, cập nhật local stack:

```sh
./scripts/compose.sh config --quiet
./scripts/compose.sh up -d --build --wait --wait-timeout 300 identity-service notification-service api-gateway frontend
```

Không dùng `down --volumes`. Không sửa mật khẩu `.env` của database đã có dữ liệu rồi mong MySQL tự cập nhật theo; mật khẩu đã được lưu trong volume khi khởi tạo.

## Luồng đã triển khai

1. Frontend gọi `/api/identity/auth/register` qua Gateway, tạo tài khoản chưa xác nhận, token băm trong `account_tokens` và payload mã hóa trong outbox cùng transaction.
2. Relay lấy event bằng khóa/lease, gửi RabbitMQ với publisher confirms và kiểm tra unroutable. Chỉ đánh dấu PUBLISHED khi broker xác nhận. Sự kiện gửi lại có cùng event ID.
3. Notification consumer ghi `processed_events` và `email_jobs` trong một transaction; commit trước ACK. Event trùng không tạo mail job thứ hai. Token vẫn được mã hóa khi qua broker và nằm trong database.
4. Worker lấy job bằng lease, giải mã trong bộ nhớ và gọi `POST https://api.brevo.com/v3/smtp/email`. Mail chứa liên kết `/verify-email?token=...` của frontend. Khi Brevo trả `messageId`, job chuyển ACCEPTED và xóa dữ liệu token đã mã hóa khỏi job.
5. Người dùng mở liên kết; frontend tự xác minh và chuyển sang đăng nhập khi API xác nhận thành công. Không yêu cầu bấm nút xác nhận hay tự đánh dấu đã xác minh. Token dùng một lần, tối đa 24 giờ; resend vô hiệu token cũ.
6. Đăng nhập chỉ thành công sau xác nhận email. Access Token chỉ trong bộ nhớ; Refresh Token là cookie HttpOnly. Đăng nhập thành công vào dashboard hoặc trang nội bộ được yêu cầu; router guard khôi phục/kiểm tra phiên trên backend. Trang `/auth/session` hỗ trợ kiểm tra phiên và đăng xuất thật. Dashboard vẫn là dữ liệu mẫu, chưa phải API nghiệp vụ hoàn chỉnh.

Frontend đã bỏ mock đăng ký/đăng nhập. Đăng ký thành công chuyển sang trang riêng `/verify-email`, chỉ hiển thị hướng dẫn kiểm tra hộp thư, email đăng ký và gửi lại khi cần. Email được truyền qua history state; mật khẩu/token không được lưu trong state. Khi API xác minh thành công, trang tự chuyển sang login với thông báo kết quả, đồng thời thông báo tab chờ cùng origin qua BroadcastChannel. Link lỗi/hết hạn không được coi là thành công. Backend áp dụng cooldown 60 giây và 5 lần resend/giờ.

## Retry và trạng thái

- Outbox lỗi broker thử lại mỗi 30 giây, tối đa 10 lần rồi DEAD. Consumer chống trùng bằng event ID. Queue lỗi có DLQ `tasknest.notification.dead-letter`.
- Brevo trả 429: lên lịch thử lại sau 60 giây, tối đa 5 lần gọi tổng cộng.
- 4xx khác: FAILED, giữ mã lỗi an toàn như BREVO_HTTP_401, không lưu response body/API key/token vào log hoặc bảng lỗi.
- Timeout/mất kết nối/5xx: kết quả có thể chưa rõ, giữ FAILED với attempt UNKNOWN, không tự gửi lại gây thư trùng. Lease SENDING hết hạn cũng thành UNKNOWN; người vận hành kiểm tra trước khi phát lại hoặc người dùng yêu cầu resend token mới.
- Token hết hạn trước gửi: SUPPRESSED; không gửi liên kết đã hết hạn.
- ACCEPTED chỉ có nghĩa Brevo tiếp nhận. Chưa triển khai webhook xác nhận DELIVERED/BOUNCED. Xem kết quả giao thư trong Transactional Logs của Brevo; kiểm tra thư rác nếu cần.
- Địa chỉ người nhận còn trống lúc job được xếp hàng vì nằm trong payload mã hóa; worker điền sau giải mã. Token không nằm trong template_data/payload JSON. Các bản outbox đã publish còn ciphertext để hỗ trợ đối soát; cần chính sách lưu trữ/dọn dữ liệu phù hợp.

Không tự phát lại job FAILED/UNKNOWN hoặc đổi khóa để xử lý lỗi gửi. Đổi khóa AES khiến payload cũ không giải mã được nếu không có key ring/quy trình chuyển đổi; nhánh này dùng một khóa bền vững theo môi trường.

## Kiểm thử

```sh
./mvnw -B verify
npm --prefix frontend run lint
npm --prefix frontend test
npm --prefix frontend run build
python3 scripts/test-schema.py --service-startup
python3 scripts/test-auth-mail.py
```

`test-auth-mail.py` dùng MySQL/RabbitMQ riêng và Brevo giả lập tại loopback, không đọc `.env`, không gửi email thật. Kiểm tra Gateway → đăng ký → broker → worker → link xác nhận → đăng nhập → rotation → logout; cùng các trường hợp event trùng, lỗi 429, lỗi vĩnh viễn và kết quả gửi chưa rõ. Các container thử được xóa sau khi hoàn tất.

Kiểm thử thủ công tại `http://localhost:3000/register`:

1. Đăng ký bằng hộp thư bạn sở hữu. Đăng nhập trước xác nhận phải báo cần xác nhận email.
2. Kiểm tra hộp thư/thư rác và Transactional Logs Brevo.
3. Mở link: hệ thống tự xác minh và chuyển sang login. Đăng nhập bằng mật khẩu đã đăng ký.
4. Thử tải lại dashboard, kiểm tra trang phiên và đăng xuất; khi chưa đăng nhập hoặc sau đăng xuất, gõ URL dashboard phải chuyển về đăng nhập. Mật khẩu sai phải bị từ chối; link đã dùng không xác nhận lần nữa.

Không cần cung cấp API key trong chat. Chỉ gọi GET kiểm tra tài khoản/sender chưa chứng minh thư đã được giao; chỉ báo kết quả gửi thật sau khi đã kiểm tra worker và trạng thái provider.

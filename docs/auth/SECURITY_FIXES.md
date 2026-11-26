# Sửa lỗi Auth và cấu hình vận hành

## IP qua proxy

Nginx ghi đè `X-Tasknest-Client-IP` bằng địa chỉ kết nối thực, kèm khóa nội bộ `TASKNEST_PROXY_KEY`. Gateway chỉ nhận địa chỉ này khi khóa khớp; mọi header giả từ client trực tiếp bị thay bằng IP kết nối. Identity cũng kiểm tra khóa trước khi dùng địa chỉ truyền qua Gateway. Header `Forwarded`/`X-Forwarded-For` không được dùng để quyết định hạn mức. Khóa chỉ tồn tại ở runtime Nginx, Gateway và Identity; không đưa vào bundle React hoặc biến `VITE_*`, không log header này.

Chạy `python3 scripts/setup-auth-secrets.py` để bổ sung khóa còn thiếu, giữ nguyên khóa JWT/outbox hiện tại. Compose yêu cầu khóa; khi chạy service từ IDE cần truyền cùng giá trị vào Gateway và Identity. Chạy riêng không cấu hình khóa sẽ bỏ qua metadata proxy và dùng IP kết nối trực tiếp. Đây không phải cấu hình cho lưu lượng public qua proxy.

Nginx sử dụng template envsubst với bộ lọc chỉ thay `TASKNEST_PROXY_KEY`, giữ nguyên các biến `$host`, `$uri`, `$remote_addr`. Gateway/Identity đặt `server.forward-headers-strategy=none` để framework không thay IP kết nối bằng header client. Không công khai port service phía sau Gateway. Khi đặt thêm load balancer/CDN trước Nginx, cấu hình `real_ip` với danh sách proxy tin cậy cụ thể; không tin mọi địa chỉ. Nếu proxy/service nằm trên các máy khác nhau, bảo vệ đường truyền nội bộ bằng TLS/mạng riêng và quản lý khóa như các secret backend khác.

## Hạn mức và validation

Ngoài login/refresh, register và resend có budget theo IP, cùng budget gửi email toàn hệ thống. Bộ đếm MySQL nguyên tử, commit trước khi từ chối và không hoàn tác theo transaction tài khoản. IP đã vượt hạn mức không tiếp tục tiêu thụ budget toàn hệ thống. Mọi yêu cầu hợp lệ về hình thức đều tính vào budget, kể cả email trùng/không tồn tại; vì vậy đây là trần yêu cầu, không phải số thư Brevo đã gửi.

| Biến cấu hình | Mặc định |
|---|---|
| `AUTH_MAIL_ADDRESS_ATTEMPTS` | 10 yêu cầu cho mỗi thao tác register/resend, mỗi IP, mỗi cửa sổ |
| `AUTH_MAIL_GLOBAL_ATTEMPTS` | 200 yêu cầu tổng cộng cho register/resend, mỗi cửa sổ |
| `AUTH_MAIL_WINDOW_SECONDS` | 3600 giây |

Đây là giá trị vận hành có thể điều chỉnh. Hạn mức theo tài khoản resend 60 giây / 5 lần mỗi giờ vẫn áp dụng. Hệ thống trả 429 kèm `Retry-After`. IP dùng chung qua NAT có chung budget địa chỉ. Budget toàn hệ thống là bảo vệ tài nguyên, có thể giảm khả dụng khi bị tiêu thụ; cần theo dõi khi public.

Đăng ký, đăng nhập và resend dùng cùng quy tắc email: trim, lowercase, local part tối đa 64 ký tự, tổng tối đa 255, định dạng ASCII được hỗ trợ thống nhất. Không tuyên bố hỗ trợ toàn bộ RFC 5322. Mật khẩu ít nhất 8 Unicode code point, tối đa 72 byte UTF-8 theo BCrypt; không trim hoặc cắt mật khẩu. Frontend và backend kiểm tra cùng giới hạn.

Không tự đổi/xóa tài khoản có email không hợp lệ đã được tạo trước bản sửa. Nếu có dữ liệu cũ như vậy, cần quản trị viên xác minh chủ tài khoản và sửa email qua quy trình hỗ trợ riêng; bản sửa ngăn tạo thêm dữ liệu này.

## Phiên và mail queue

Login/refresh trả thêm `sessionExpiresAt` là hạn tuyệt đối phiên; refresh không kéo dài quá 7 ngày. Token còn hơn 30 giây được làm mới trước hạn. Token cuối phiên còn 30 giây hoặc ít hơn được dùng đến hạn, tránh timer bằng 0 liên tục và refresh storm. Khi token/phiên hết hạn, backend quyết định cho refresh hay yêu cầu đăng nhập lại.

Consumer dùng AUTO ACK của container sau khi transaction ghi dedupe/job commit. Sự kiện hết hạn chỉ ghi dedupe và không tạo mail job. Lỗi runtime được trả dưới dạng thông báo an toàn, retry tối đa 3 lần theo cấu hình rồi reject vào DLQ, không giữ unacked vô hạn. Khi mất kết nối sau commit trước ACK, broker có thể phát lại; dedupe ngăn tạo job thứ hai. DLQ vẫn cần người vận hành kiểm tra và phát lại sau khi sửa nguyên nhân; không phát lại tự động vô hạn.

## Dependency và kiểm thử

Nâng [Spring Boot 4.1.2](https://github.com/spring-projects/spring-boot/releases/tag/v4.1.2), lấy Jackson 2.21.7 / 3.1.7 từ BOM. Bổ sung bản vá [RabbitMQ client 5.37.0](https://github.com/rabbitmq/rabbitmq-java-client/releases/tag/v5.37.0), [Guava 33.7.2](https://github.com/google/guava/releases/tag/v33.7.2) và HttpClient 4.5.14 trong dependency management. Các override cần rà lại khi nâng BOM. [Advisory Jackson](https://github.com/FasterXML/jackson-databind/security/advisories/GHSA-cxp5-3px4-pw24) và [advisory RabbitMQ](https://github.com/rabbitmq/rabbitmq-java-client/security/advisories/GHSA-5xwg-cfvj-gff5) là một phần căn cứ vá.

```sh
./mvnw -B clean verify
python3 scripts/check-java-dependencies.py
python3 scripts/test-schema.py
python3 scripts/test-auth-mail.py
cd frontend
npm test
npm run lint
npm run build
```

SCA đọc metadata dependency thực tế trong sáu executable JAR và hỏi OSV bằng tọa độ Maven công khai. Mất mạng/lỗi phản hồi làm bước kiểm tra thất bại. Kết quả không có advisory chỉ phản ánh dữ liệu OSV tại thời điểm chạy, không chứng minh không còn lỗ hổng. CI chạy SCA và kiểm thử Auth/mail trên database/broker tạm, dùng Brevo giả lập.

Các bản sửa này xử lý A1–A7 trong báo cáo rà soát. Forgot/reset/change password, quản lý tất cả thiết bị, RBAC nghiệp vụ và realtime vẫn là phần triển khai tiếp theo; không coi Auth hoặc toàn dự án đã hoàn thiện toàn bộ.

## Kết quả kiểm thử ngày 28/10/2026

- Backend: 75 test đạt; frontend: 39 test, lint và production build đạt.
- Schema/service restart: 60 assertion và 31 kiểm tra auth trực tiếp đạt trên database tạm.
- Gateway → Identity → RabbitMQ → Notification → Brevo giả lập: đăng ký, xác minh một lần, login/session/refresh/logout, dedupe, provider failures, IP riêng biệt, budget register/mail và retry exhausted → DLQ đạt. Không gửi thư thật trong kiểm thử này.
- OSV: 137 tọa độ dependency trong executable JAR, không có advisory tại thời điểm chạy.
- UI thật với API giả lập token 20 giây: một refresh ở khoảng 20 giây, không lặp liên tục; trang tiếp tục hoạt động.
- Build/restart stack local và smoke test đạt. Một yêu cầu đăng nhập tài khoản không tồn tại qua Nginx xác nhận header IP/khóa giả bị bỏ qua; không tạo tài khoản hoặc gửi email.

Chưa commit/push các thay đổi.

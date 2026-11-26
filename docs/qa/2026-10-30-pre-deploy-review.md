# Kiểm tra trước triển khai — TaskNest

Ngày: 30/10/2026 (Asia/Ho_Chi_Minh). Nhánh: `feat/rule-completion`.

## Kết luận

Các bộ kiểm thử dưới đây đạt trên mã nguồn trong workspace. Có thể chuẩn bị bản staging để kiểm thử nghiệm thu. Chưa xác nhận môi trường production: hiện chưa có máy chủ/domain được cung cấp để kiểm tra TLS, reverse proxy ngoài cùng, email thực tế và khôi phục backup.

Thay đổi còn nằm trong working tree, chưa commit/push trong lần kiểm tra này. Clone/pull trên máy chủ sẽ chưa nhận đủ thay đổi nếu chưa đưa lên Git.

## Bằng chứng tự động

| Hạng mục | Kết quả |
| --- | --- |
| Frontend TypeScript, ESLint, production build | Đạt |
| Frontend Vitest | 114 tests / 26 files đạt |
| Java Maven verify | 129 tests; 0 failure, 0 error, 0 skipped |
| Schema trên MySQL riêng | 98 assertions đạt; kiểm tra migration/startup lặp hai lần cho các service |
| Auth/mail/member/collaboration integration | Đạt trên Identity, Work, Notification, MySQL, RabbitMQ riêng |
| Workspace/project/workflow/time integration | Đạt; bộ này dùng Identity contract stub, không thay thế kiểm thử Identity thật ở bộ trước |
| Docker Compose config | Đạt |
| Infrastructure checks | Service chỉ migrate DB của mình; từ chối truy cập DB khác; bảo vệ Config/Discovery; thiếu Config không khởi động |
| Smoke test stack đang chạy | Đạt; đây là kiểm tra health/routing, không thay thế nghiệm thu nghiệp vụ |
| OSV dependency scan | 140 metadata packages, không có hit tại thời điểm chạy; không phải bảo đảm không tồn tại lỗ hổng |

### Phạm vi API đã chạy

- Đăng ký, xác minh email một lần, đăng nhập, refresh rotation/reuse, đăng xuất, rate limit, CSRF/Origin.
- Quên/đặt lại mật khẩu qua email thử, token dùng một lần, đổi mật khẩu, liệt kê/thu hồi phiên và đăng xuất tất cả thiết bị.
- Email đã đăng ký nhưng chưa xác minh được đưa về luồng xác minh; không ghi đè mật khẩu/thông tin tài khoản.
- Hồ sơ/ảnh đại diện, quyền cập nhật, phiên bản cũ, định dạng ảnh.
- Danh sách/chi tiết dự án, tìm kiếm/lọc/phân trang, vai trò hiện tại, outsider và người bị xóa.
- Lời mời, chấp nhận/từ chối, mã QR/link, xoay/vô hiệu hóa link, yêu cầu tham gia và duyệt; xử lý đồng thời.
- Tạo/sửa/phân công nhiệm vụ, cờ bị chặn, stale version, chuyển trạng thái/nộp/duyệt/yêu cầu làm lại/mở lại/hủy; đổi người phụ trách đóng timer cũ.
- Bình luận, phản hồi một cấp, ảnh, quyền sửa/xóa, tombstone, idempotency, mention deduplication và email.
- Tài liệu/liên kết, quota, kiểm tra nội dung tệp, URL không an toàn, quyền download, mất quyền khi xóa, avatar dự án.
- Ghi giờ thủ công/timer, chồng lấn và đồng thời, sửa giờ/lịch sử, cấm tương lai, quyền sở hữu, dự án lưu trữ.
- WebSocket xác thực thật: invalidation dưới 2 giây trong kịch bản kiểm thử và đóng kết nối khi thu hồi phiên. Chưa benchmark tải production.
- Dữ liệu analytics và chế độ chỉ đọc khi lưu trữ.

Email trong integration được gửi đến fake Brevo tại localhost. Kết quả này kiểm tra hợp đồng API và hàng đợi, không chứng minh thư đến inbox thực tế trên server.

## Kiểm tra trực quan và thao tác trình duyệt

Dùng tài khoản/dự án thử nghiệm trên stack riêng tại localhost:5188; không sửa dữ liệu đang sử dụng.

- Đăng nhập, dashboard và danh sách công việc tải dữ liệu thật.
- Chi tiết nhiệm vụ có đủ thanh tab dự án, nội dung chính và sidebar thao tác.
- Gửi bình luận thành công; tải lại trang giữ bình luận và phiên đăng nhập.
- Tab lịch sử tải hoạt động thật, không còn HTTP 401 trong luồng đã thử.
- Chuyển nhiệm vụ từ Chưa bắt đầu sang Đang thực hiện lưu thành công; tải lại giữ trạng thái.
- Tổng quan dự án và analytics tải dữ liệu phù hợp nhiệm vụ vừa chuyển trạng thái.
- Đã quan sát trang chi tiết ở chế độ sáng và tối. Chưa kiểm tra mọi màn hình trên mọi kích thước/thiết bị.
- Phát hiện HMR của Vite có thể mất workspace context khi sửa module liên quan lúc đang mở trang; tải lại khôi phục. Đây là tình huống dev, chưa thấy khi tải trang mới. Không dùng Vite dev server để deploy.

Sửa trong lần kiểm tra: nhãn realtime thành “Đã kết nối cập nhật trực tiếp”; thao tác TODO thành “Bắt đầu thực hiện”.

Ảnh: [Tối](assets/2026-10-30/task-detail-dark.png), [Sáng](assets/2026-10-30/task-detail-light.png).

## Các bước cần làm trước production

1. Commit/push toàn bộ thay đổi cần bàn giao trên nhánh hiện tại, review/merge rồi triển khai đúng revision. Không commit `.env`, khóa hoặc backup.
2. Chạy `./mvnw -B verify` với Java 21 trước Docker build: Dockerfile Java lấy JAR từ `target`, không tự biên dịch source.
3. Cấu hình HTTPS/WSS ở reverse proxy ngoài cùng. Compose hiện bind frontend về `127.0.0.1:3000`, cấu hình nginx đi kèm phục vụ HTTP nội bộ.
4. Đặt `PUBLIC_APP_ORIGIN=https://<domain>`, `IDENTITY_ALLOWED_ORIGINS=https://<domain>`, `IDENTITY_COOKIE_SECURE=true`; dùng bộ secret riêng trên server.
5. Cấu hình Brevo, sender đã xác minh, `MAIL_ENABLED=true`; thử email xác minh/reset trên địa chỉ được chủ dự án cho phép, kiểm tra cả provider status và inbox.
6. Giữ volume MySQL, RabbitMQ và `work-files`; sao lưu phối hợp DB + volume tệp, lưu khóa cần giải mã an toàn và thử khôi phục riêng trước bàn giao. Bản SQL backup cục bộ hiện tại không thay thế kế hoạch này.
7. Sau triển khai chạy health/smoke, rồi nghiệm thu đăng ký → xác minh → đăng nhập → tạo dự án/nhiệm vụ → mời thành viên → bình luận/ghi giờ/duyệt từ hai phiên trình duyệt.

Không thực hiện deploy từ xa, commit, push hoặc merge trong lần kiểm tra này.

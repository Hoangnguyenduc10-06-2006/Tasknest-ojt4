# Dữ liệu thật cho các màn hình sau đăng nhập

## Nguồn dữ liệu và bảo vệ

- Dự án: các API tạo/đọc/sửa hiện có của Work Service.
- `GET /api/work/projects/workspace`: nhiệm vụ của dự án có membership ACTIVE, thành viên hiện tại, phiên ghi giờ của chính người dùng, lời mời nhận được và yêu cầu do chính người dùng gửi. Không trả dữ liệu dự án khác. Lời mời/yêu cầu chỉ trả thông tin tối thiểu của chính người nhận/người gửi.
- Tên hiển thị lấy từ Identity qua `GET /internal/identity/profiles?ids=...`, theo từng batch tối đa 100 UUID. API nội bộ này xác thực JWT/phiên hiện tại, không được Gateway route công khai, chỉ trả ID/họ tên; không trả email, mật khẩu hay bio. Work kiểm tra và chọn tập ID theo dữ liệu được phép trước khi gọi; không join trực tiếp database Identity.
- `GET /api/notifications/inbox?page=0&size=20`: Notification Service đọc database riêng, chỉ trả thông báo của người đăng nhập. Size nhận 10/20/50. `PUT /api/notifications/inbox/{id}/read` kiểm tra người nhận và đánh dấu đã đọc theo thời gian máy chủ.
- Gateway và service đều xác thực phiên với Identity. API ghi dùng Bearer, không nhận danh tính/vai trò từ body hoặc cookie. Refresh/logout của Identity giữ CSRF hiện tại.
- Member chỉ đọc giờ của mình. Owner/Manager được đọc tổng giờ trong dự án. Timer đang chạy cộng thời gian trên máy chủ vào tổng được phép xem.

## Thao tác đã nối API

| API | Điều kiện |
|---|---|
| POST `/api/work/projects/{projectId}/tasks` | Người đã xác nhận, dự án ACTIVE; Member chỉ giao cho chính mình; assignee phải là thành viên ACTIVE; tên 3–100, ngày bắt đầu từ hôm nay theo giờ Việt Nam, deadline không trước ngày bắt đầu, ước tính > 0 |
| PUT `.../tasks/{taskId}/start` | Người phụ trách, TODO, đúng version; ghi lịch sử và chuyển IN_PROGRESS |
| POST `.../tasks/{taskId}/timer` | Người phụ trách, IN_PROGRESS, dự án ACTIVE; khóa theo người dùng và unique index bảo đảm chỉ một timer toàn hệ thống |
| PUT `.../time-entries/{entryId}/stop` | Chính người ghi giờ, dự án ACTIVE; thời điểm dừng do máy chủ; gọi lại không cộng thêm thời gian |
| PUT `.../invitations/{id}/accept` hoặc `/decline` | Đúng người nhận, còn PENDING, chưa hết hạn, dự án ACTIVE; chấp nhận tạo/khôi phục membership và đóng yêu cầu chờ trong cùng transaction |
| PUT `.../join-requests/{id}/cancel` | Người gửi, còn PENDING, dự án ACTIVE |
| GET `/api/work/projects/workspace/join-links/{code}` | Tài khoản đã xác nhận; chỉ thông tin tối thiểu của link ACTIVE/dự án ACTIVE |
| POST `/api/work/projects/workspace/join-requests` | Link hợp lệ, chưa là thành viên, không có yêu cầu đang chờ, qua 24 giờ sau từ chối; không tự cấp membership |

Tạo nhiệm vụ/timer/yêu cầu trả 201. Quyền, trạng thái và version được kiểm tra lại tại thời điểm ghi. Không thay migration đã áp dụng và không cần reset database.

## Giao diện

Dashboard, công việc cá nhân, danh sách/chi tiết dự án, thành viên, chi tiết/tạo nhiệm vụ, giờ làm, lời mời/yêu cầu và thông báo đọc dữ liệu API. Không còn khởi tạo dữ liệu mẫu ở các màn hình này. Không có dữ liệu thì hiển thị trạng thái trống; lỗi không biến thành số liệu 0. Cache tách tài khoản; phản hồi tải cũ bị bỏ khi đổi phiên. Khi refresh thất bại, hiển thị lỗi và ghi rõ nếu đang giữ dữ liệu từ lần tải thành công trước.

Dashboard dùng múi giờ Việt Nam, không tính nhiệm vụ đã hủy vào tiến độ; quá hạn thực hiện chỉ tính TODO/IN_PROGRESS. Cờ bị chặn tách khỏi trạng thái. Danh sách nhiệm vụ phân trang 20 dòng trên frontend; inbox phân trang tại backend. Workspace hiện đọc toàn bộ tập được phép, chưa có hợp đồng phân trang API riêng cho từng loại dữ liệu.

Đồng hồ hiển thị mỗi giây, khôi phục timer đang chạy từ database sau tải lại. Dữ liệu làm việc/inbox tải lại sau thao tác, khi lấy lại focus và định kỳ 30 giây khi tab đang hiển thị. Đây là cơ chế lấy lại dữ liệu, **chưa phải** kết nối realtime 2 giây theo RULE.

## Giới hạn phạm vi

Các endpoint mới đọc dữ liệu hiện có và nối các thao tác nêu trên. Chưa bổ sung luồng tạo lời mời trực tiếp/quản lý link, duyệt yêu cầu, nộp/duyệt/rework công việc, sửa giờ thủ công, bình luận/tệp, phát sự kiện thông báo nghiệp vụ và gửi email cho các sự kiện mới. Không hiển thị thành công giả cho các phần chưa có API. Inbox đọc thông báo đã lưu; nếu chưa có producer ghi thông báo thì danh sách sẽ trống. Luồng email xác minh tài khoản hiện có được giữ nguyên. Không thay đổi luồng quên/reset mật khẩu trong bước dữ liệu sau đăng nhập này.

## Kiểm tra và chạy

```sh
./mvnw -B -pl services/identity-service,services/work-service,services/notification-service,platform/api-gateway -am verify
python3 scripts/test-workspace-data.py
npm --prefix frontend run typecheck
npm --prefix frontend run lint
npm --prefix frontend test
npm --prefix frontend run build
```

Script kiểm thử dùng MySQL/service riêng và Identity contract stub; không đọc .env, không sửa dữ liệu đang dùng, không gọi Brevo. Kiểm tra cách ly tài khoản, tạo nhiệm vụ thật, version, timer duy nhất/khôi phục/dừng, lời mời nhận đúng người, link/yêu cầu, riêng tư giờ làm và quyền đọc thông báo.

Sau khi kiểm tra, build lại các container liên quan để cổng 3000 nhận code mới; giữ volume dữ liệu.

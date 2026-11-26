# Thành viên, lời mời và link/QR

Giao diện Thành viên trong trang chi tiết dự án đọc API theo project ID; không dùng dữ liệu mock. Danh sách có các tab Thành viên, Lời mời đã gửi và Yêu cầu tham gia; mỗi trang 10/20/50 kết quả. Hai tab quản lý chỉ dành cho Owner/Manager. Các thao tác kiểm tra quyền và trạng thái hiện tại tại Work Service, có khóa dự án để tuần tự hóa thay đổi.

- Mời bằng email chỉ áp dụng cho tài khoản đã đăng ký và xác nhận email. Work gọi hợp đồng nội bộ Identity để tìm người nhận, không truy cập database Identity. Lời mời có hiệu lực 7 ngày; chấp nhận tạo Member và đóng yêu cầu đang chờ. Chỉ người gửi được hủy lời mời đang chờ, còn hiệu lực.
- Chỉ Owner được chỉ định Manager từ thành viên hiện tại. Thay Manager đưa Manager cũ về Member. Không đổi/xóa Owner; xóa thành viên bị chặn khi còn nhiệm vụ chưa DONE/CANCELLED.
- Link/QR dùng cùng mã ngẫu nhiên 256 bit. Người mở phải đăng nhập, gửi yêu cầu và chờ duyệt. `/join/:code` là route được bảo vệ; đường dẫn tham gia được giữ trong sessionStorage của tab khi người dùng đi qua đăng ký/xác minh rồi đăng nhập. Đây là đường dẫn công khai, không chứa token xác thực.
- Link không tự hết hạn. Tắt/tạo lại làm link và QR cũ mất hiệu lực nhưng không hủy yêu cầu đã gửi. Dự án ARCHIVED chỉ được xem, không ghi thêm dữ liệu thành viên.

## API

Các endpoint bên dưới thuộc `/api/work/projects/{projectId}` và yêu cầu Bearer Access Token hợp lệ.

| Method | Đường dẫn | Nội dung |
|---|---|---|
| GET | `/members?tab=members&page=0&size=20` | Snapshot gồm items, total, page, size, role hiện tại, archived; tab còn có invitations/requests |
| POST | `/invitations` | `{ "email": "member@example.com" }` |
| PUT | `/invitations/{id}/cancel` | Hủy lời mời do mình gửi |
| PUT | `/join-requests/{id}/decision` | `{ "accept": true }` hoặc false |
| PUT | `/members/{userId}/role` | `{ "role": "Manager" }` hoặc Member; Owner thực hiện |
| PUT | `/members/{userId}/remove` | Xóa thành viên; Owner thực hiện |
| GET | `/invitation-link` | Link đang hoạt động hoặc null |
| PUT | `/invitation-link` | `{ "action": "CREATE" }`, ROTATE hoặc DISABLE |

Chấp nhận/từ chối lời mời và gửi yêu cầu tiếp tục dùng API workspace hiện tại. Không thay cấu trúc response danh sách dự án trên main.

## Thông báo và email

Work ghi sự kiện `work.project-invitation.created` vào outbox cùng transaction tạo lời mời. Relay gửi qua RabbitMQ với publisher confirm; Notification dedupe theo event ID, tạo notification và email job trong một transaction. Worker dùng cấu hình Brevo hiện tại và link `/invitations`; mở email không tự thêm thành viên. Lời mời hiển thị trong ứng dụng kể cả khi email gửi thất bại. `MAIL_ENABLED` tại Notification bật/tắt worker gửi thư; outbox và inbox vẫn hoạt động khi tắt gửi email. Thông tin người nhận từ Identity chỉ được truy cập qua route nội bộ không được Gateway công khai.

Giao diện thành viên thăm dò API mỗi 5 giây khi tab hiển thị và tải lại khi cửa sổ được focus. Đây chưa phải kết nối WebSocket/SSE.

## Kiểm thử

```bash
./mvnw -B verify
npm --prefix frontend ci
npm --prefix frontend run build
npm --prefix frontend run lint
npm --prefix frontend test
python3 scripts/test-project-members.py
python3 scripts/test-workspace-data.py
```

Integration test tạo MySQL/RabbitMQ riêng, chạy Identity/Work/Notification thật và Brevo giả lập; không đọc `.env`, không sửa database đang sử dụng, không gửi email thật. CI chạy bộ kiểm thử thành viên kèm các kiểm thử auth/mail cũ.

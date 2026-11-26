# Bảng nhiệm vụ Danh sách / Kanban

Tab Nhiệm vụ trong trang dự án sử dụng `TaskBoard`. Hai chế độ dùng chung dữ liệu Workspace và bộ lọc; `TaskTable` nhận kết quả đã lọc, không tạo thêm thanh lọc riêng. Ngày hôm nay được tính theo Asia/Ho_Chi_Minh, so sánh với deadline ISO từ API. Đang bị chặn là cờ bổ sung, không phải cột trạng thái. Lọc Đã hủy mở Danh sách; chuyển về Kanban cần chủ động xóa điều kiện này.

Kéo thả hoặc chọn menu trên thẻ mở cùng hộp xác nhận. Gửi duyệt cần kết quả; làm lại, mở lại và hủy cần lý do; duyệt hoàn thành cần xác nhận đạt yêu cầu. Giao diện chỉ cập nhật sau khi API thành công và Workspace được tải lại. Nhiệm vụ mới luôn TODO. Dự án lưu trữ chỉ được xem. Menu chuyển trạng thái cũng dùng được trên bàn phím và màn hình cảm ứng.

## API

`PUT /api/work/projects/{projectId}/tasks/{taskId}/status`

```json
{
  "version": 2,
  "status": "REVIEW",
  "note": "Đã hoàn thành và kiểm thử kết quả",
  "confirmed": false
}
```

`GET /api/work/projects/{projectId}/tasks/{taskId}/submission` trả kết quả lần nộp gần nhất cho thành viên dự án. Hộp duyệt/làm lại hiển thị kết quả này trước khi cho xác nhận.

Trạng thái đích: IN_PROGRESS, REVIEW, DONE hoặc CANCELLED. Backend lưu REVIEW thành IN_REVIEW theo schema. API `/start` hiện có dùng chung dịch vụ chuyển trạng thái.

Backend kiểm tra tư cách thành viên, vai trò hiện tại, trạng thái dự án, phiên bản nhiệm vụ và đường chuyển hợp lệ trong một transaction. Người phụ trách/Owner/Manager được bắt đầu và gửi duyệt; chỉ Owner/Manager được duyệt, làm lại, mở lại hoặc hủy. Không được nhảy TODO sang DONE hoặc khôi phục nhiệm vụ đã hủy.

Mỗi lần gửi duyệt tạo `task_submissions` với snapshot deadline và người phụ trách. Duyệt gắn đúng lần nộp được chấp nhận; mở lại xóa mốc hoàn thành hiện tại và liên kết lần nộp được chấp nhận, giữ nguyên lịch sử. Gửi duyệt/hủy kết thúc đồng hồ đang chạy. Các thay đổi được ghi vào `activity_logs`; phiên bản tăng để chống ghi đè thao tác đồng thời.

Dùng các bảng hiện có, không cần migration mới. Dữ liệu trên các màn hình dùng chung Workspace, làm mới sau ghi thành công, khi focus và định kỳ 30 giây theo cơ chế hiện tại; thay đổi này chưa triển khai kênh realtime giữa các thiết bị hoặc phát thông báo chuyển trạng thái.

## Kiểm tra

```sh
npm --prefix frontend run lint
npm --prefix frontend test
npm --prefix frontend run build
./mvnw -B -pl services/work-service,platform/api-gateway,services/notification-service -am verify
python3 scripts/test-workspace-data.py
```

Bài integration tạo MySQL riêng trong Docker, chạy service và gateway bằng cổng tạm, dùng Identity stub; không dùng `.env`, dữ liệu hiện tại hoặc dịch vụ email thật. Bao gồm quyền, ghi chú, duyệt, lần nộp, mở lại, hủy, dừng timer, dự án lưu trữ, thành viên bị xóa và xung đột phiên bản.

Chạy Docker cần build lại cả `frontend` và `work-service` để có giao diện và endpoint mới.

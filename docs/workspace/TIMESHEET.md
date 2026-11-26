# Giờ làm cá nhân

Trang `/my-time` nhận timer và đồng hồ hiển thị từ `useServerTimer` ở App, dùng cùng phiên đang chạy với Navbar và dashboard. Chỉ hiện banner khi server có phiên thật. Dừng gọi API hiện có; không có nút tiếp tục giả hoặc state timer riêng.

Lịch sử lấy từ Workspace theo người dùng hiện tại. Bộ lọc tên/mã, dự án, nhiệm vụ và ngày dùng dữ liệu thật; phân trang 20 kết quả. Hôm nay/tuần này/tháng này tính theo Asia/Ho_Chi_Minh, tuần bắt đầu thứ Hai và phân bổ phiên qua đêm theo phần giao với từng kỳ. Ngày giờ nhập luôn là UTC+7, chuyển thành Instant trước khi gửi API, không phụ thuộc múi giờ thiết bị.

## API

- `POST /api/work/projects/{projectId}/tasks/{taskId}/time-entries`: bổ sung giờ. Body gồm `startedAt`, `endedAt` (ISO có múi giờ) và `reason` (1–4000 ký tự).
- `PUT /api/work/projects/{projectId}/time-entries/{entryId}`: sửa phiên đã kết thúc của chính mình. Body gồm các trường trên và `version` hiện tại. Phải dừng timer trước khi sửa.
- `GET /api/work/projects/workspace/time-revisions`: 50 lần sửa gần nhất của chính người dùng, giới hạn trong dự án còn membership ACTIVE; có giá trị trước/sau, lý do và thời điểm sửa.

Server yêu cầu phiên và email hợp lệ, membership hiện tại, dự án ACTIVE và nhiệm vụ chưa DONE/CANCELLED. Bổ sung chỉ cho nhiệm vụ người gọi phụ trách; sửa chỉ cho phiên của chính người gọi, kể cả khi người gọi là Owner/Manager. Không nhận user ID, nguồn phiên hoặc tổng thời lượng từ client. Không ghi thời gian tương lai; kết thúc phải sau bắt đầu. Khoảng thời gian không được trùng bất kỳ phiên nào của cùng người dùng trên toàn hệ thống, bao gồm phiên đang chạy. Hai khoảng tiếp giáp được chấp nhận.

Ghi theo transaction, khóa project → task → mutex người dùng → entry. Mutex dùng upsert để lấy khóa ghi trực tiếp, tránh deadlock khi nâng khóa sau INSERT IGNORE. Kiểm tra trùng bằng locking read sau khi lấy mutex để đọc commit mới từ dự án khác. Mọi chỉnh sửa có version và bản ghi `time_entry_revisions`; thao tác thêm/sửa ghi `activity_logs`. Không tự retry request ghi. Xung đột khóa/phiên bản trả HTTP 409, không báo thành công hoặc báo nhầm đăng xuất.

Frontend giữ nội dung khi lỗi. Modal được mount riêng cho mỗi lần mở để nạp đúng phiên và xóa dữ liệu cũ. Không báo Đã lưu trước khi API thành công. Sau mutation tải lại Workspace và lịch sử; cảnh báo ước tính/tổng giờ của các màn hình dùng lại dữ liệu server. Bổ sung và sửa giờ không thay trạng thái nhiệm vụ.

Dùng các bảng schema hiện có, không cần migration. Đồng bộ giữa thiết bị vẫn theo Workspace focus/polling 30 giây; thay đổi này không bổ sung WebSocket hoặc email thông báo.

## Kiểm thử

```sh
npm --prefix frontend run lint
npm --prefix frontend test
npm --prefix frontend run build
./mvnw -B -pl services/work-service,platform/api-gateway,services/notification-service -am verify
python3 scripts/test-workspace-data.py
```

`scripts/timesheet_checks.py` được gọi từ bộ integration hiện có, dùng MySQL riêng, gateway và Identity stub; không đọc `.env`, gửi email hoặc thay dữ liệu đang dùng. Kiểm tra ghi thật, lịch sử, quyền riêng tư, trùng giờ giữa dự án, thời gian tương lai, phiên đang chạy, phiên bản cũ, nhiệm vụ kết thúc/dự án lưu trữ và ghi đồng thời.

Để chạy Docker với API mới cần build lại frontend và work-service.

# Lịch sử nộp và duyệt nhiệm vụ — hợp đồng backend

Phạm vi hiện tại: task 1 (hợp đồng dữ liệu), task 2 (API danh sách), task 3 (quyền lịch sử và tệp). Task 4 bổ sung tab Kết quả với trạng thái tải/lỗi/rỗng, tải lại và phân trang. Task 5 hiển thị người duyệt, thời điểm, lý do xử lý và file/link, tải tệp qua endpoint của đúng lần nộp. Task 6 đồng bộ sau thao tác thành công, thay đổi phiên bản nhiệm vụ, sự kiện realtime, focus/online và kiểm tra định kỳ khi tab đang mở.

## Danh sách lịch sử

`GET /api/work/projects/{projectId}/tasks/{taskId}/submissions?page=0&size=20`

Bearer token bắt buộc; không nhận user ID hoặc vai trò từ query/header tùy ý. Trang bắt đầu từ 0; mặc định page=0, size=20. Size chỉ nhận 10/20/50, offset không vượt Integer.MAX_VALUE. Thứ tự cố định `submission_no DESC, id DESC` trên tập dữ liệu của từng request. Khi có lần nộp mới giữa hai request, các trang có thể dịch chuyển; frontend cần làm mới danh sách khi nhận cập nhật.

Response dùng `WorkResponse` với data là `PageResponse` hiện có:

```json
{
  "success": true,
  "message": "Đã tải lịch sử nộp và duyệt.",
  "data": {
    "content": [{
      "id": 102,
      "number": 2,
      "submittedBy": {"id": "00000000-0000-4000-8000-000000000002", "name": "Thành viên"},
      "assignee": {"id": "00000000-0000-4000-8000-000000000002", "name": "Thành viên"},
      "submittedAt": "2026-11-08T01:00:00Z",
      "resultNote": "Kết quả lần hai",
      "resultUrl": null,
      "file": {"id": 44, "name": "ket-qua.pdf", "available": true},
      "decision": "ACCEPTED",
      "reviewOutcome": "ACCEPTED",
      "reviewedBy": {"id": "00000000-0000-4000-8000-000000000001", "name": "Quản lý"},
      "reviewedAt": "2026-11-08T02:00:00Z",
      "rejectionReason": null,
      "deadlineOnSnapshot": "2026-11-08"
    }],
    "page": 0,
    "size": 20,
    "totalElements": 1,
    "totalPages": 1
  }
}
```

- `submittedBy`: người nộp; `assignee`: người phụ trách được chụp ở lần nộp, không lấy từ phân công hiện tại của nhiệm vụ. Tên là tên hiển thị hiện tại từ Identity; không có hồ sơ thì dùng UUID, không xóa lịch sử của thành viên cũ. Lỗi kết nối Identity trả 503, không báo lịch sử rỗng.
- `submittedAt`, `reviewedAt` là thời điểm UTC ISO-8601, frontend hiển thị theo giờ Việt Nam. `deadlineOnSnapshot` là deadline của lần nộp.
- Chưa duyệt thì reviewedBy/reviewedAt/rejectionReason là null. Dữ liệu cũ thiếu file hoặc link giữ null; không yêu cầu nộp lại và không tự xóa bản ghi cũ.
- File đã mất/xóa/chưa attached vẫn có metadata tham chiếu nếu còn; `file.available=false`. Nếu không có tham chiếu file thì `file=null`. `available=true` thể hiện metadata READY, đúng project/loại và đã attached; tải thật vẫn có thể 404 nếu bytes mất trên volume.
- Nhiệm vụ có thật nhưng chưa nộp trả content=[], totalElements=0, totalPages=0. Trang vượt cuối trả content=[] và giữ đúng tổng số bản ghi/trang.
- Bao gồm mọi lần PENDING/ACCEPTED/REJECTED. Không phụ thuộc latest_submission_id, trạng thái hiện tại, phân công hiện tại hoặc lần nộp đang được chấp nhận; mở lại/hủy nhiệm vụ không làm mất lịch sử.

## Phân biệt quyết định và lý do đóng lần nộp

`decision` giữ đúng dữ liệu hiện có: PENDING, ACCEPTED, REJECTED. Không sửa migration hoặc thay đổi luồng ghi dữ liệu hiện tại.

| reviewOutcome | Ý nghĩa |
|---|---|
| PENDING | Đang chờ duyệt |
| ACCEPTED | Đã chấp nhận |
| REWORK_REQUESTED | Yêu cầu làm lại, có sự kiện TASK_REJECTED xác minh được |
| TASK_CANCELLED | Lần nộp bị đóng do hủy nhiệm vụ khi đang chờ duyệt |
| REJECTED | Đã từ chối nhưng dữ liệu cũ không đủ bằng chứng để phân loại nguyên nhân |

Chỉ phân loại hai nguyên nhân REJECTED khi activity log khớp **project, task, submissionId, trạng thái trước là IN_REVIEW, người duyệt và thời điểm duyệt** của chính lần nộp. Không suy đoán từ trạng thái CANCELLED hiện tại của nhiệm vụ; hủy sau khi mở lại không đổi các lần nộp đã được chấp nhận hoặc đã yêu cầu làm lại. Nếu thiếu log hoặc không khớp thì giữ REJECTED. Frontend cần hiển thị trạng thái từ chối chung cho trường hợp này, không tự gán là yêu cầu làm lại.

## Tải tệp kết quả cũ

`GET /api/work/projects/{projectId}/tasks/{taskId}/submissions/{submissionId}/file`

API kiểm tra membership hiện tại, nhiệm vụ đúng dự án, lần nộp đúng nhiệm vụ/dự án và file đúng project, loại PROJECT_DOCUMENT, READY, đã attached. Không chỉ chấp nhận lần nộp mới nhất. Tệp attached còn READY không bị hết hạn chỉ vì temporary_expires_at đã qua.

Tái sử dụng ProjectFileService để kiểm tra quyền/trạng thái và đọc volume riêng; không trả storage_key, không phát URL tải công khai hoặc đưa token lên URL. File được trả dưới dạng attachment với tên UTF-8, Content-Type đã xác minh, nosniff và Cache-Control: private, no-store. API danh sách cũng không cho cache dữ liệu riêng.

## Ma trận quyền và lỗi

| Người dùng/trạng thái | Danh sách | Tải tệp |
|---|---|---|
| Owner/Manager/Member hiện tại, dự án hoạt động | Cho phép | Cho phép nếu đúng quan hệ và file khả dụng |
| Thành viên hiện tại, dự án lưu trữ | Cho phép | Cho phép |
| Người ngoài, đang mời/chờ tham gia, thành viên bị xóa | 404 | 404 |
| Chưa đăng nhập/phiên thu hồi | 401 | 401 |
| Chưa xác minh email | 403 | 403 |

Nhiệm vụ sai dự án hoặc không tồn tại: 404 TASK_NOT_FOUND. Lần nộp sai nhiệm vụ, chỉ có link, không có file hoặc file không còn khả dụng: 404 SUBMISSION_FILE_NOT_FOUND. Tham số phân trang sai: 400. API cũ `GET .../submission` (số ít) dùng cho hộp duyệt được giữ nguyên.

## Kiểm tra và triển khai

```powershell
.\mvnw.cmd -B -pl services/work-service verify
python scripts/test-workspace-data.py
```

Bộ test unit/MVC kiểm tra contract/nulls, phân trang, thiếu lịch sử, scope query, xác thực, file cũ và quyền tải. Script workflow tích hợp có thêm kiểm tra thứ tự, phân loại đóng lần nộp, dữ liệu cũ và truy cập sau khi lưu trữ/xóa thành viên; bộ này cần Docker và không dùng dữ liệu local hiện tại.

Không thêm dependency, biến môi trường hoặc migration. Build lại Work Service để có API. Docker daemon hiện chưa hoạt động trên máy kiểm tra, nên chưa xác nhận truy vấn MySQL hoặc nghiệm thu trên bản deploy.

### Kết quả local ngày 08/11/2026

- Work Service `clean verify`: 70 test đạt, không failure/error/skipped.
- `scripts/task_workflow_checks.py`: kiểm tra cú pháp Python đạt.
- Chưa chạy tích hợp MySQL/Gateway hoặc kiểm thử trên deploy vì Docker daemon chưa hoạt động.

## Giao diện Kết quả (task 4–6)

Chi tiết nhiệm vụ có tab Kết quả: mở tab để tải danh sách, dùng phân trang/Tải lại khi cần. Hiển thị ghi chú, người phụ trách lúc nộp, deadline snapshot, người và thời điểm xử lý, lý do và file/link. Nội dung văn bản được React escape; URL ngoài chỉ nhận HTTP/HTTPS không chứa userinfo, mở tab mới; file tải bằng Bearer token qua endpoint của đúng lần nộp.

Sau nộp/duyệt/làm lại/mở lại/hủy thành công, giao diện chuyển sang Kết quả và tải từ trang đầu, kể cả khi lượt làm mới Workspace sau ghi chưa thành công. Sự kiện realtime dùng kênh tasknest:sync hiện có, không mở WebSocket mới. Đồng bộ nền giữ trang đang xem, gom sự kiện liên tiếp và chỉ có một request đang chạy trên mỗi lịch sử; nếu có cập nhật trong lúc tải sẽ lấy lại sau đó. Phản hồi cũ sau đổi nhiệm vụ/tài khoản hoặc đóng tab bị bỏ qua. Trang bị vượt cuối khi dữ liệu đổi được tự điều chỉnh.

Khi API lịch sử trả lỗi, dữ liệu cũ được xóa khỏi giao diện thay vì hiện như một danh sách rỗng. Lỗi tải file 401/403 xóa lịch sử đang giữ; 404 tải lại danh sách để kiểm tra lại quyền và tình trạng file. Timer 30 giây chỉ kiểm tra khi tab Kết quả đang hoạt động và trang không bị ẩn; listener/timer được dọn khi rời tab. Form duyệt đang nhập không bị reset bởi cập nhật lịch sử.

### Kiểm tra task 4–6 ngày 09/11/2026

Đã cập nhật nhánh từ main trước khi làm giao diện; giữ nguyên AI và lịch nhiệm vụ mới tích hợp. Frontend typecheck, ESLint, 171 test trên 37 file và production build đạt. Các test mới bao phủ hợp đồng dữ liệu, thông tin duyệt/file/link, URL không an toàn, quyền tải, loại bỏ phản hồi cũ, gom sự kiện, giữ phân trang, mất quyền và dọn timer/listener. Chưa nghiệm thu trên trình duyệt kết nối stack thật hoặc bản deploy; các bước tích hợp/nghiệm thu task 7–8 tiếp tục sau.

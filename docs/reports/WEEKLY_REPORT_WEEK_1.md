# BÁO CÁO TUẦN LÀM VIỆC CỦA NHÓM

## 1. Thông tin chung

| Nội dung | Thông tin |
|---|---|
| Tên dự án | TaskNest – Hệ thống quản lý công việc và dự án |
| Học phần | OJT4 |
| Lớp | HN-KS24-CNTT3 |
| Tuần báo cáo | Tuần 1 |
| Thời gian | 19/10/2026 – 25/10/2026 |
| Số thành viên | 4 |
| Công cụ | GitHub, Jira, Figma, Docker Compose |
| Trạng thái Sprint 1 | Hoàn thành 18/18 task |

## 2. Thành viên nhóm

| Thành viên | Vai trò chính |
|---|---|
| Đặng Khánh An | Trưởng nhóm; kiến trúc, fullstack, Docker/CI-CD, tài liệu và review |
| Đoàn Việt Anh | UI/UX, Figma và giao diện frontend |
| Hoàng Nguyên Đức | Backend Identity/Notification, REST API và JWT |
| Nguyễn Duy Mạnh | Fullstack, frontend integration, messaging và backend hỗ trợ |

## 3. Mục tiêu trong tuần

- Chốt kiến trúc microservice và hợp đồng giao tiếp giữa các service.
- Khởi tạo monorepo, môi trường Docker Compose, CI và các nền tảng Spring Cloud.
- Hoàn thiện schema/migration nền tảng cho Work, Identity và Notification.
- Xây dựng nền tảng JWT, refresh token, xác minh email và gửi email qua Brevo.
- Xây dựng layout, theme, routing và các màn hình đăng ký/đăng nhập theo Figma.
- Thiết lập các quy ước làm việc, review và kiểm tra mã nguồn.

## 4. Phân công và kết quả thực hiện

| Thành viên | Task đã thực hiện | Kết quả |
|---|---|---|
| Đặng Khánh An | TN-001, TN-004, TN-057, TN-059, TN-005, TN-006, TN-014 | Hoàn thành kiến trúc và API contract; tổ chức repo; cấu hình Gateway, Config Server, Docker Compose, CI và backlog/rule. |
| Đoàn Việt Anh | TN-007, TN-008, TN-012 | Hoàn thành đối chiếu Figma; layout/component/theme; giao diện đăng ký, xác minh và đăng nhập. |
| Hoàng Nguyên Đức | TN-003, TN-011, TN-058, TN-010 | Hoàn thành schema Identity/Notification; JWT và refresh rotation; Eureka; luồng đăng ký và xác minh email. |
| Nguyễn Duy Mạnh | TN-002, TN-060, TN-009, TN-013 | Hoàn thành schema Work; RabbitMQ và DLQ; lớp routing/API frontend; khung gửi email Brevo. |

### Tổng hợp tiến độ

| Chỉ tiêu | Kết quả |
|---|---:|
| Tổng số task Sprint 1 | 18 |
| Task hoàn thành | 18 |
| Task còn lại | 0 |
| Tỷ lệ hoàn thành | 100% |

## 5. Sản phẩm và kết quả đạt được

### Kiến trúc và nền tảng

- Hoàn thiện cấu trúc monorepo gồm frontend, platform và các service nghiệp vụ.
- Thiết lập các thành phần Spring Cloud: API Gateway, Eureka Discovery và Config Server.
- Thiết lập Docker Compose cho môi trường local, MySQL, RabbitMQ và các service.
- Thiết lập pipeline kiểm tra frontend/backend và quy ước branch, commit, pull request.

### Dữ liệu và bảo mật

- Hoàn thiện schema/migration nền tảng cho Work, Identity và Notification.
- Áp dụng JWT với Access Token ngắn hạn, Refresh Token xoay vòng và phiên đăng nhập nhiều thiết bị.
- Bổ sung các kiểm tra chữ ký, thời hạn, issuer/audience và thu hồi phiên.
- Mật khẩu và refresh token không được lưu ở dạng nguyên bản.

### Tài khoản và email

- Hoàn thiện đăng ký, xác minh email, đăng nhập và xử lý tài khoản chưa xác minh.
- Tích hợp hàng đợi email và cấu hình sender Brevo theo môi trường.
- Bổ sung xử lý retry/DLQ để không làm mất yêu cầu gửi email khi dịch vụ tạm thời lỗi.

### Frontend

- Hoàn thiện layout dùng chung, theme sáng/tối/theo hệ thống và routing bảo vệ.
- Các form đăng ký, xác minh email và đăng nhập có trạng thái loading, lỗi và thành công.
- Frontend chỉ giao tiếp qua API Gateway, không gọi trực tiếp các service nội bộ.

## 6. Khó khăn và cách xử lý

| Khó khăn | Cách xử lý |
|---|---|
| Nhiều service khởi động theo thứ tự phụ thuộc | Bổ sung healthcheck, readiness và cấu hình khởi động theo dependency trong Compose. |
| Cấu hình local khác nhau giữa các máy | Chuẩn hóa `.env.example`, tách secret khỏi mã nguồn và hướng dẫn khởi tạo môi trường. |
| Luồng JWT và refresh token có nhiều trạng thái | Thống nhất contract trước, lưu trạng thái phiên ở backend và kiểm tra thu hồi ngoài JWT. |
| Gửi email phụ thuộc dịch vụ bên ngoài | Dùng queue/outbox, retry hữu hạn và DLQ; không ghi API key vào log hoặc Git. |
| Đồng bộ giao diện với nghiệp vụ | Đối chiếu Figma theo từng trạng thái loading, empty, error, forbidden và dark mode. |

## 7. Đánh giá tuần

Sprint 1 hoàn thành đầy đủ 18/18 task theo bảng phân công. Nhóm đã có nền tảng kiến trúc, môi trường chạy, bảo mật tài khoản, email và giao diện xác thực để chuyển sang phát triển các nghiệp vụ dự án, thành viên và nhiệm vụ trong tuần tiếp theo.

## 8. Kế hoạch tuần 2

- Hoàn thiện danh sách phiên, logout mọi thiết bị, quên/đặt lại mật khẩu và hồ sơ cá nhân.
- Phát triển CRUD dự án, vai trò Owner/Manager và quản lý thành viên.
- Xây dựng lời mời trực tiếp qua email, link/QR và luồng yêu cầu chờ duyệt.
- Phát triển CRUD nhiệm vụ, phân công, nộp kết quả, duyệt và làm lại.
- Tích hợp dữ liệu thật vào các màn hình danh sách/chi tiết dự án và nhiệm vụ.
- Duy trì review chéo, kiểm thử API và cập nhật Jira sau mỗi task.

## 9. Xác nhận

| Người lập báo cáo | Trưởng nhóm xác nhận |
|---|---|
| Đặng Khánh An | Đặng Khánh An |

*Ghi chú: Báo cáo này được lập từ bảng phân công Jira nội bộ và trạng thái Sprint 1 đã được nhóm xác nhận. Liên kết Google Docs mẫu chưa thể truy cập từ môi trường hiện tại nên bố cục trên là bản báo cáo tuần chuẩn hóa cho TaskNest.*

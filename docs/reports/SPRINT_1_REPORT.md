# BÁO CÁO KẾT QUẢ SPRINT 1

## 1. Thông tin chung

| Nội dung | Thông tin |
|---|---|
| Dự án | TaskNest — Hệ thống quản lý công việc và dự án |
| Học phần | OJT4 |
| Lớp | HN-KS24-CNTT3 |
| Nhóm | Đặng Khánh An, Đoàn Việt Anh, Hoàng Nguyên Đức, Nguyễn Duy Mạnh |
| Sprint | Sprint 1 — nhóm công việc Tuần 1 trong bảng phân công |
| Thời gian theo kế hoạch | 19/10–25/10/2026 |
| Ngày cập nhật báo cáo | 30/10/2026 |
| Tổng số task | 18 |
| Task hoàn thành | 18 |
| Tỷ lệ hoàn thành theo số task | 100% |

Trạng thái hoàn thành được ghi nhận theo xác nhận của trưởng nhóm tại thời điểm lập báo cáo. Thời gian kế hoạch không thay thế ngày hoàn thành thực tế của từng task.

## 2. Mục tiêu Sprint

Xây dựng nền tảng kiến trúc và môi trường phát triển của TaskNest; thống nhất dữ liệu, quy tắc tổ chức mã nguồn, giao tiếp giữa các service và thiết kế giao diện. Hoàn thiện luồng đăng ký, xác minh email, đăng nhập và quản lý JWT để làm cơ sở phát triển các chức năng quản lý dự án, nhiệm vụ và cộng tác trong những Sprint tiếp theo.

## 3. Kết quả công việc

| Mã | Công việc | Phụ trách theo bảng phân công | Kết quả | Trạng thái |
|---|---|---|---|---|
| TN-001 | Chốt service, API contract và quy tắc giao tiếp | Đặng Khánh An | Xác định kiến trúc ba service nghiệp vụ, Gateway, Discovery, Config và RabbitMQ; thống nhất quy tắc API/event và xác thực. | Hoàn thành |
| TN-002 | Thiết kế ERD và migration Work Service | Nguyễn Duy Mạnh | Thiết kế dữ liệu Work, quan hệ và migration; ràng buộc vai trò, nhiệm vụ, phiên ghi giờ và lịch sử. | Hoàn thành |
| TN-003 | Thiết kế dữ liệu Identity và Notification | Hoàng Nguyên Đức | Thiết kế dữ liệu Identity/Notification, phiên đăng nhập, token, notification, outbox và trạng thái gửi email. | Hoàn thành |
| TN-004 | Khởi tạo cấu trúc repo và quy ước PR | Đặng Khánh An | Tổ chức monorepo frontend/platform/services/infra; hướng dẫn chạy và quy ước đóng góp, review PR. | Hoàn thành |
| TN-011 | JWT, refresh rotation và phiên 7 ngày | Hoàng Nguyên Đức | Triển khai Access Token/Refresh Token, kiểm tra JWT, rotation, thu hồi và giới hạn phiên 7 ngày. | Hoàn thành |
| TN-058 | Eureka Server và đăng ký các service | Nguyễn Duy Mạnh | Cấu hình Eureka Server, đăng ký service và tra cứu service qua load balancer. | Hoàn thành |
| TN-059 | Config Server và cấu hình theo môi trường | Đặng Khánh An | Cấu hình Config Server, bootstrap và tách cấu hình khỏi mã nguồn ứng dụng. | Hoàn thành |
| TN-057 | Spring Cloud Gateway cho API và WebSocket | Đặng Khánh An | Cấu hình Gateway cho REST API/WebSocket, định tuyến và bảo vệ biên truy cập. | Hoàn thành |
| TN-060 | RabbitMQ và hợp đồng queue exchange DLQ | Nguyễn Duy Mạnh | Cấu hình RabbitMQ, exchange/queue bền vững, publisher confirm, ACK, retry và DLQ. | Hoàn thành |
| TN-005 | Môi trường Docker Compose local | Đặng Khánh An | Thiết lập Docker Compose cho ứng dụng và hạ tầng, healthcheck cùng volume dữ liệu. | Hoàn thành |
| TN-006 | Pipeline kiểm tra PR và build | Đặng Khánh An | Thiết lập CI kiểm tra frontend, backend, schema và cấu hình triển khai. | Hoàn thành |
| TN-007 | Đối chiếu Figma với màn hình và trạng thái nghiệp vụ | Đoàn Việt Anh | Đối chiếu thiết kế Figma với màn hình và trạng thái nghiệp vụ; ghi nhận hoàn thành theo xác nhận của nhóm. | Hoàn thành |
| TN-008 | Layout, component dùng chung và theme | Đoàn Việt Anh | Xây dựng layout và các thành phần dùng chung như Button, Badge, Icon, Avatar, Panel, Modal; hỗ trợ sáng/tối/theo hệ thống. | Hoàn thành |
| TN-009 | Routing và lớp API có xử lý lỗi/xác thực | Nguyễn Duy Mạnh | Tổ chức routing, bảo vệ trang yêu cầu đăng nhập, lớp gọi API và xử lý lỗi/xác thực. | Hoàn thành |
| TN-013 | Khung gửi email Brevo và cấu hình sender | Nguyễn Duy Mạnh | Tích hợp khung gửi email Brevo, cấu hình sender, hàng đợi và xử lý lỗi gửi; ghi nhận hoàn thành theo xác nhận của nhóm. | Hoàn thành |
| TN-010 | Đăng ký và xác minh email | Hoàng Nguyên Đức | Hoàn thiện đăng ký, băm mật khẩu, xác minh email, gửi lại và kiểm soát tài khoản chưa xác minh. | Hoàn thành |
| TN-012 | Đăng ký, xác minh và đăng nhập | Đoàn Việt Anh | Xây dựng giao diện đăng ký, đăng nhập và xác minh email, validation và xử lý trạng thái tài khoản. | Hoàn thành |
| TN-014 | Rà soát RULE SRS và backlog cùng nhóm | Đặng Khánh An | Rà soát RULE, SRS và backlog; ghi nhận hoàn thành theo xác nhận của nhóm. | Hoàn thành |

## 4. Tổng hợp theo thành viên

| Thành viên | Số task Sprint 1 | Hoàn thành |
|---|---:|---:|
| Đặng Khánh An | 7 | 7 |
| Đoàn Việt Anh | 3 | 3 |
| Hoàng Nguyên Đức | 3 | 3 |
| Nguyễn Duy Mạnh | 5 | 5 |

Số liệu phân công lấy từ file Excel do nhóm cung cấp. Số lượng task không biểu thị số giờ làm hoặc độ phức tạp; kết quả có sự phối hợp và kiểm tra chéo giữa các thành viên.

## 5. Sản phẩm bàn giao

- Monorepo gồm frontend, platform, ba service nghiệp vụ, cấu hình hạ tầng và script hỗ trợ.
- Frontend React, TypeScript, Tailwind CSS với layout, routing, theme và bộ component dùng chung.
- Backend Java Spring Boot, REST API, MySQL và Flyway migration.
- Gateway, Eureka, Config Server và RabbitMQ phục vụ giao tiếp giữa các service.
- Luồng đăng ký, xác minh email, đăng nhập và JWT; tích hợp gửi email qua Brevo.
- Docker Compose, pipeline CI và hướng dẫn phát triển dự án.
- RULE, SRS, thiết kế Figma và bảng phân công công việc.

## 6. Kiểm tra và xác nhận kết quả

Các lần kiểm tra gần nhất trên workspace ghi nhận:

| Hạng mục | Kết quả |
|---|---|
| Frontend TypeScript, ESLint và production build | Đạt |
| Frontend unit tests | 114 tests đạt |
| Java Maven verify | 129 tests đạt, không có failure/error |
| Schema và ràng buộc dữ liệu | 98 assertions đạt trên MySQL riêng |
| Auth/email integration | Kiểm tra đăng ký, xác minh một lần, JWT, refresh rotation, thu hồi phiên và xử lý lỗi email đạt trên môi trường thử nghiệm |
| Hạ tầng | Compose config, health/routing và bảo vệ truy cập nội bộ đạt |

Các con số kiểm thử là kết quả của toàn bộ workspace tại ngày 30/10/2026, bao gồm các phần phát triển sau Sprint 1; không tính chúng là số test riêng của Sprint 1. Kiểm thử email tự động sử dụng fake Brevo. Nghiệm thu gửi thư và liên kết trên domain thật thuộc công việc triển khai sau Sprint.

Các mục TN-001, TN-007, TN-008, TN-013 và TN-014 trước đó còn thiếu bằng chứng nghiệm thu trong lần rà soát kỹ thuật. Báo cáo này cập nhật trạng thái Hoàn thành theo xác nhận của trưởng nhóm; không coi xác nhận này là một lần chạy kiểm thử bổ sung.

## 7. Vấn đề đã xử lý và kinh nghiệm

- Chuẩn hóa tổ chức frontend theo app/features/shared, giảm lặp component và thống nhất màu giao diện.
- Bảo vệ trang và API yêu cầu đăng nhập, kiểm tra vai trò tại backend và xử lý tài khoản chưa xác minh email.
- Thống nhất cấu hình môi trường giữa Docker và máy phát triển để tránh frontend gọi bản backend cũ.
- Bổ sung kiểm thử cho xác thực, dữ liệu và hạ tầng; dùng database riêng để tránh tác động dữ liệu đang sử dụng.
- Mỗi thay đổi cần build, kiểm tra các luồng liên quan và cập nhật tài liệu trước khi đưa lên nhánh dùng chung.

## 8. Công việc tiếp theo

- Tiếp tục nghiệm thu các nhóm quản lý dự án, thành viên, lời mời/QR, nhiệm vụ và Kanban của Sprint tiếp theo.
- Hoàn thiện ma trận kiểm thử giao diện, realtime và các tình huống mạng lỗi.
- Chuẩn bị môi trường staging/production, HTTPS, cấu hình email và quy trình backup/restore theo kế hoạch triển khai.

## 9. Kết luận

Sprint 1 hoàn thành 18/18 task theo xác nhận của nhóm, đạt 100% kế hoạch về số lượng task. Nền tảng kiến trúc, dữ liệu, môi trường phát triển, giao diện dùng chung và chức năng xác thực đã được xây dựng để hỗ trợ các Sprint tiếp theo.

## Tài liệu và bằng chứng

- Bảng phân công nguồn: `local/exports/tasknest/TaskNest_Bang_Phan_Cong_Jira.xlsx`, sheet `Backlog`, các dòng 7–24.
- [Báo cáo kiểm tra trước triển khai](../qa/2026-10-30-pre-deploy-review.md).
- [RULE](../../RULE.md) và [SRS](../../SRS.md).
- Repository: https://github.com/KHANHAN007/TaskNest---OJT4

# Báo cáo công việc tuần

## Dự án TaskNest

**Thời gian báo cáo:** Tuần vừa qua, cập nhật đến ngày 30/10/2026  
**Phạm vi:** Chỉ tính các thay đổi đã có trên nhánh `main`.

## 1. Tuần vừa rồi đã làm gì và có khó khăn gì không

### Công việc đã thực hiện

- Hoàn thiện nền tảng xác thực tài khoản: đăng ký, đăng nhập, xác minh email, refresh token, đặt lại mật khẩu và hồ sơ cá nhân.
- Phát triển danh sách và chi tiết dự án, phân trang và kiểm soát quyền truy cập.
- Hoàn thiện quản lý thành viên và lời mời trong dự án.
- Tích hợp Kanban board, trạng thái nhiệm vụ và phân quyền thao tác.
- Hoàn thiện luồng đóng/mở lại dự án và kiểm tra đồng hồ thời gian đang chạy.
- Tích hợp chức năng theo dõi thời gian và nhập thời gian thủ công.
- Cập nhật tài liệu rule, cấu trúc frontend và workflow CI.
- Kiểm tra frontend bằng test, TypeScript, ESLint và production build.

### Khó khăn gặp phải

- Backend chưa build thành công tại `identity-service`.
- Lỗi biên dịch liên quan đến getter, builder, constructor và cấu hình Lombok/annotation processing.
- Một số chức năng đã có giao diện nhưng cần tiếp tục kiểm tra với dữ liệu thật và luồng API xuyên service.
- Chưa có đủ bằng chứng để kết luận Docker Compose và toàn bộ hệ thống đã sẵn sàng triển khai production.

## 2. Cách xử lý và phương pháp thực hiện

- Đọc lại lịch sử Git và chỉ đối chiếu những commit đã merge vào `main`.
- Tách rõ chức năng đã có trong mã nguồn với chức năng đã được kiểm thử thành công.
- Kiểm tra frontend bằng các lệnh:

  ```bash
  cd frontend
  npm test
  npm run typecheck
  npm run lint
  npm run build
  ```

- Kiểm tra backend bằng Maven:

  ```bash
  ./mvnw -B test
  ```

- Ưu tiên sửa lỗi biên dịch `identity-service` trước khi đánh giá các lỗi backend tiếp theo.
- Kiểm tra lại cấu hình Lombok, annotation processing và phiên bản JDK/Maven thay vì bỏ qua lỗi hoặc chỉ chạy riêng frontend.
- Sau khi backend build pass, chạy lại test toàn bộ module và kiểm tra Docker Compose trên môi trường sạch.
- Cập nhật Jira theo trạng thái thực tế: đã merge, đang xử lý, bị chặn bởi build hoặc chưa có bằng chứng kiểm thử.

### Kết quả kiểm tra hiện tại

| Hạng mục | Kết quả |
|---|---|
| Frontend test | 27 file test, 118/118 test pass |
| TypeScript | Pass |
| ESLint | Pass |
| Frontend production build | Pass |
| Backend Maven test | Fail tại `identity-service` |
| Production deployment | Chưa đủ bằng chứng để xác nhận |

## 3. Dự định tuần sau

- Sửa lỗi biên dịch `identity-service` và chạy lại toàn bộ Maven test.
- Kiểm tra các service còn lại sau khi identity service build thành công.
- Chạy Docker Compose trên môi trường sạch, kiểm tra healthcheck, migration, Gateway và kết nối giữa các service.
- Kiểm thử đầy đủ các luồng xác thực: đăng ký, xác minh email, đăng nhập, refresh, logout, reset password và nhiều thiết bị.
- Kiểm thử nghiệp vụ dự án, thành viên, lời mời, Kanban và theo dõi thời gian với dữ liệu thật.
- Kiểm tra notification, queue/DLQ và khả năng gửi email qua Brevo.
- Thay dữ liệu mock còn lại bằng API thật trên frontend.
- Cập nhật Jira, lưu kết quả test theo commit và chuẩn bị checklist release candidate.

## Kết luận

TaskNest đã có nhiều chức năng chính trên `main`, frontend đang đạt các kiểm tra local. Tuy nhiên backend còn bị chặn bởi lỗi build tại `identity-service`, vì vậy tuần sau cần ưu tiên khôi phục khả năng build/test toàn hệ thống trước khi triển khai.

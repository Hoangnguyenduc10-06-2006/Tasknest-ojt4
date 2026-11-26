# Tuyển thành viên cho đội

## Luồng sử dụng

1. Chủ đội mở hồ sơ đội và chọn **Đăng tin tuyển thành viên**. Tin có vị trí, mô tả cách hợp tác, kỹ năng, hình thức làm việc, số giờ mỗi tuần, số chỗ và hạn nhận hồ sơ.
2. Người tìm đội mở **Tìm đội để tham gia** (`/teams?view=recruiting`), tìm theo vị trí, kỹ năng hoặc tên đội. Tin còn mở, chưa hết hạn và chưa tuyển đủ mới xuất hiện công khai.
3. Ứng viên gửi kinh nghiệm, kỹ năng, thời gian có thể tham gia và xác nhận đồng ý tham gia đội nếu được nhận. Mỗi ứng viên có một đơn cho mỗi tin. Đơn và phản hồi chỉ ứng viên cùng chủ đội được xem.
4. Chủ đội mở **Xem đơn ứng tuyển** trên hồ sơ đội, nhận ứng viên hoặc gửi lý do chưa phù hợp. Chủ đội có thể tạm dừng nhận hồ sơ, mở lại tin còn hạn hoặc đóng tin.
5. Khi được nhận, ứng viên trở thành thành viên thực tế của đội. Tên và vị trí được công khai trên hồ sơ đội. Không tự thêm quyền truy cập bất kỳ dự án nào; chủ dự án vẫn mời thành viên theo quy trình hiện có.
6. Ứng viên theo dõi ở **Đơn ứng tuyển** (`/teams?view=applications`), xem phản hồi hoặc rút đơn đang chờ. Đơn đã rút hoặc đã được phản hồi được giữ lại và không thể thay đổi quyết định.

Nội dung tin được giữ nguyên sau khi đăng để hai bên dùng cùng yêu cầu. Nếu thay đổi vị trí hoặc điều kiện hợp tác, chủ đội đóng tin cũ và đăng tin mới. Đây là luồng tuyển vào đội; chưa tự tạo hợp đồng hay xử lý thanh toán.

## Quyền và tính nhất quán

- Chỉ tài khoản đã xác minh được đăng tin, gửi đơn và xử lý đơn. Chỉ chủ đội được quản lý tin và đọc danh sách hồ sơ.
- Danh sách công khai không trả thư ứng tuyển, phản hồi, email hoặc mã thao tác nội bộ.
- Các thao tác thêm thành viên khóa cùng bản ghi đội với luồng lời mời hiện có. Duyệt đồng thời không vượt số chỗ và không tạo trùng thành viên.
- Khi nhận người có lời mời đang chờ, lời mời được chuyển sang đã chấp nhận trong cùng giao dịch.
- Khách hàng của đội không được gia nhập đội thực hiện, giữ quy tắc xác thực đánh giá khách hàng hiện có.
- Chỉ nhận người khi tin đang mở, còn hạn và còn chỗ. Có thể từ chối hồ sơ sau khi đóng tin để trả lời các ứng viên còn chờ.
- Số phiên bản bảo vệ các thao tác thay đổi trạng thái. Gửi lại cùng nội dung không tạo tin hoặc đơn trùng; quyết định đã xử lý không bị ghi đè.
- Kết quả được cập nhật trong mục đơn ứng tuyển khi người dùng tải dữ liệu mới; giai đoạn này chưa gửi thông báo email/push tuyển dụng.

Migration `V13__team_recruitment.sql` thêm hai bảng `team_openings`, `team_applications` trong Work database. API ở `/api/work/community/openings`, `/api/work/community/teams/{team}/openings` và `/api/work/community/applications/mine`.

## Kiểm thử

```sh
./mvnw -pl services/work-service,platform/api-gateway -am package
python3 scripts/test-community.py
```

Bộ kiểm thử dùng MySQL riêng, kiểm tra quyền qua Gateway, riêng tư hồ sơ, xác nhận đồng ý, đăng/gửi lại thao tác, tạm dừng và đóng tin, cạnh tranh cùng một chỗ, nhận thành viên, từ chối có lý do, rút đơn và giữ riêng quyền truy cập dự án.

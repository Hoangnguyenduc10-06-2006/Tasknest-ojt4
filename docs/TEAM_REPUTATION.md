# Hồ sơ đội và đánh giá khách hàng

## Luồng sử dụng

1. Vào **Đội dev & Cộng đồng** hoặc mở `/teams`. Hồ sơ đội và thành viên được xem công khai.
2. Tài khoản đã xác minh email tạo đội, giới thiệu chuyên môn và bật trạng thái nhận dự án.
3. Chủ đội mời thành viên bằng email. Người nhận vào **Đội của tôi** để chấp nhận hoặc từ chối. Chấp nhận đồng nghĩa cho phép hiển thị tên trong hồ sơ đội.
4. Trong dự án, chủ dự án mở tab **Nghiệm thu & Đánh giá**, chọn đội mình đại diện và khách hàng. Khách hàng phải là thành viên dự án và ở ngoài đội thực hiện.
5. Khách hàng xác nhận thông tin hợp tác tại cùng tab. Khách hàng có thể từ chối thông tin chưa đúng để chủ dự án thiết lập lại.
6. Khách hàng nghiệm thu sau khi tất cả nhiệm vụ đã hoàn thành hoặc hủy, với ít nhất một nhiệm vụ hoàn thành. Tên dự án chỉ công khai khi khách hàng chọn cho phép.
7. Khách hàng đánh giá bốn tiêu chí từ 1–5 sao, viết nhận xét và chọn có sẵn sàng hợp tác lại. Chủ đội phản hồi trong dự án.
8. Khách hàng ghi nhận những thành viên của đội đã phụ trách nhiệm vụ hoàn thành tại thời điểm nghiệm thu. Lời ghi nhận xuất hiện trên hồ sơ cá nhân.

## Ý nghĩa dữ liệu

- Điểm đội là trung bình bốn tiêu chí của các đánh giá khách hàng, mỗi dự án có một đánh giá.
- Lượt thích hồ sơ đội và thành viên được lưu độc lập. Mỗi tài khoản có một lượt thích cho mỗi hồ sơ.
- Gửi lại yêu cầu thích với cùng trạng thái giữ nguyên số lượt thích.
- Ghi nhận đóng góp gắn với từng cặp dự án–thành viên. Cập nhật lời ghi nhận giữ nguyên số ghi nhận.
- Danh sách người đóng góp được chụp tại thời điểm nghiệm thu. Thay đổi nhiệm vụ về sau không thay đổi danh sách này.
- Khách hàng của đội không thể nhận lời mời gia nhập chính đội đó trong khi quan hệ khách hàng còn được lưu.
- Chỉnh sửa đánh giá và phản hồi có phiên bản để phát hiện cập nhật đồng thời. Mỗi phiên bản lưu lại trong lịch sử của dự án.
- Nhãn **Đã hợp tác** thể hiện quan hệ đã được khách hàng xác nhận và nghiệm thu trong TaskNest.

## Quyền và công khai

- Chủ đội sửa hồ sơ, mời người và phản hồi đánh giá.
- Tài khoản xác minh email thích/bỏ thích hồ sơ.
- Đại diện khách hàng được chỉ định xác nhận hợp tác, nghiệm thu, đánh giá và ghi nhận đóng góp.
- Mọi thao tác trong dự án kiểm tra lại tư cách thành viên hiện tại.
- Hồ sơ công khai gồm giới thiệu đội, tên các thành viên đã đồng ý tham gia, điểm số, nhận xét, phản hồi và ghi nhận.
- Nội dung nhiệm vụ, tệp, lời mời và email không xuất hiện trong API hồ sơ công khai.
- Bản đầu tiên liên kết đội với dự án hiện có. Chủ dự án đồng thời là chủ đội được liên kết. Khách hàng được mời vào dự án bằng chức năng thành viên hiện tại.

## Hồ sơ cá nhân

Mở `/profile` để bổ sung hồ sơ nghề nghiệp với chuyên môn, kinh nghiệm, khu vực làm việc, kỹ năng, vị trí mong muốn, hình thức hợp tác, thời gian có thể tham gia, GitHub, LinkedIn, website và tối đa 6 sản phẩm portfolio.

Hồ sơ nghề nghiệp có thể lưu riêng tư hoặc công khai ở `/members/{userId}`. Người dùng chưa tham gia đội vẫn có thể công khai hồ sơ và nhận lượt thích. Khi tắt công khai, thông tin nghề nghiệp và portfolio được ẩn. Tên, đội tham gia và ghi nhận đã công khai qua quan hệ hợp tác vẫn giữ khả năng xem của các hồ sơ cộng đồng hiện có.

Dữ liệu nghề nghiệp được lưu tại Work service qua migration `V10__professional_member_profiles.sql`. Thông tin đăng nhập, tên tài khoản, ảnh đại diện và bảo mật tiếp tục được quản lý trong tab **Tài khoản & bảo mật**.

## Kỹ thuật và kiểm tra

Migration `V9__teams_and_verified_reviews.sql` bổ sung các bảng trong Work database. Flyway chạy migration khi Work service được triển khai.

Gateway và Work service cần cùng được cập nhật để nhận diện các API cộng đồng. Các trang mới là `/teams`, `/teams/{id}` và `/members/{userId}`.

Kiểm thử MySQL tách biệt và HTTP qua Gateway chạy bằng Java 21 sau khi đóng gói các JAR.

```sh
./mvnw -pl services/work-service,platform/api-gateway -am package
python3 scripts/test-community.py
```

Bài kiểm thử sử dụng container MySQL tạm và Identity giả lập hợp đồng API. Nó kiểm tra migration, quyền truy cập, lời mời, lượt thích đồng thời, luồng nghiệm thu, đánh giá, phản hồi, ghi nhận và riêng tư tên dự án.

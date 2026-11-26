# Thiết lập tài khoản theo mục đích sử dụng

## Luồng sử dụng

1. Khi đăng ký, người dùng chọn **Khách hàng**, **Lập trình viên / Thành viên đội dev**, **Cả hai**, hoặc **Để sau**. Lựa chọn được lưu cùng tài khoản. Xác nhận email và đăng nhập vẫn dùng quy trình hiện có.
2. Người đã chọn mục đích được đưa đến bước thông tin cá nhân sau lần đăng nhập đầu tiên, không phải trả lời lại câu hỏi. Người chọn Để sau ở đăng ký vào hệ thống bình thường.
3. Hướng dẫn có bốn bước: mục đích, thông tin/ảnh tài khoản, thông tin hợp tác theo mục đích, xem lại và hoàn tất. Khách hàng bổ sung nhu cầu và doanh nghiệp; Dev bổ sung chuyên môn, giới thiệu và kỹ năng; Cả hai có cả hai nhóm.
4. **Lưu và tiếp tục** hoặc **Để sau** lưu nội dung bước hiện tại lên Identity database. Để sau giữ nguyên bước đã lưu, không tạo hồ sơ nghề nghiệp rỗng và không tự mở lại hướng dẫn khi đăng nhập lần sau. Có thể tiếp tục từ Hồ sơ cá nhân.
5. Hoàn tất Dev/Cả hai lưu hồ sơ nghề nghiệp vào Work service rồi hoàn tất thiết lập tài khoản. Mặc định hồ sơ riêng tư; chỉ công khai khi người dùng chọn. Portfolio, kinh nghiệm và liên kết đã có được giữ lại. Khách hàng không bị tạo thêm một hồ sơ Dev.
6. Đích dự án/đội đang mở được giữ lại khi đi qua hướng dẫn. Nếu xuất phát từ dashboard, Khách hàng được đưa đến yêu cầu của mình, Dev đến cơ hội tham gia đội; Cả hai về dashboard.

Mục đích sử dụng phục vụ cá nhân hóa, không phải vai trò phân quyền. Tất cả người dùng vẫn có thể mở cả Làm việc và Khám phá. Người dùng hiện có được mặc định Để sau để không bị ép vào hướng dẫn khi cập nhật hệ thống.

## Avatar và trạng thái chưa thiết lập

- Hồ sơ nghề nghiệp dùng ảnh từ Identity, cùng nguồn với tài khoản và header; không lưu ảnh riêng trong Work.
- Người chưa có hồ sơ nghề nghiệp thấy trạng thái trống và nút **Thiết lập hồ sơ nghề nghiệp**, không có form tự điền sẵn.
- Người dùng chọn riêng việc cho phép hiển thị avatar công khai. Endpoint ảnh công khai chỉ trả ảnh của tài khoản đã xác nhận email và đã bật lựa chọn này; mặc định tắt. Tắt công khai trả 404; ảnh riêng của chính người dùng vẫn dùng được.
- Ảnh công khai đọc ảnh hiện hành từ kho avatar tài khoản, không dùng bản sao. Response dùng `no-store`. Các component ảnh của chính người dùng cập nhật theo phiên bản tài khoản.

## API và tính nhất quán

Migration Identity `V6__account_purpose_and_onboarding.sql` bổ sung mục đích, trạng thái, bước, nháp JSON riêng tư và lựa chọn avatar công khai.

- `GET/PUT /api/identity/onboarding`: dùng danh tính đã xác thực, giới hạn tần suất, kiểm tra Origin và phiên bản để tránh ghi đè giữa hai thiết bị. Nháp không được đưa vào session hay directory công khai.
- `GET /api/identity/public/avatars/{id}`: ảnh công khai có kiểm tra opt-in; không trả thông tin tài khoản.
- Quy trình hoàn tất qua hai service không giả định giao dịch chung: Work lưu thành công nhưng Identity lỗi thì giao diện báo lỗi và cho tải lại/tiếp tục. Lần thử lại tải phiên bản hồ sơ hiện hành trước khi lưu.

## Kiểm tra

`scripts/test-schema.py --service-startup` dùng MySQL riêng để kiểm tra đăng ký theo mục đích, lưu nháp/để sau, phiên bản cũ, hoàn tất, ảnh canonical/opt-in và giữ tiến độ qua khởi động lại service. Unit test kiểm tra quyền, mục đích hợp lệ và hợp nhất dữ liệu khi tiếp tục. Kiểm thử trình duyệt bao phủ đăng ký, Khách hàng/Dev/Cả hai, để sau–đăng nhập lại–tiếp tục, trạng thái trống và cập nhật avatar giữa tài khoản/header/hồ sơ nghề nghiệp.

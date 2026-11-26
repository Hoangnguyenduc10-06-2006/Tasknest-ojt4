# Giao diện quên mật khẩu

Nhánh này chuẩn hóa và kiểm tra email ở ForgotPasswordForm theo cùng chính sách đăng ký/đăng nhập: trim, lowercase, local part tối đa 64 ký tự và tổng tối đa 255 ký tự. Giữ các trường hợp email không hợp lệ ở trạng thái lỗi, không hiển thị thông báo biểu mẫu hợp lệ.

Trang và route `/forgot-password` đã có ở lịch sử gốc; commit này không tạo lại hoặc nhận là triển khai mới toàn bộ trang. Kiểm thử đặt cạnh module validation.

Backend gửi mail và đặt lại mật khẩu chưa được triển khai. Biểu mẫu tiếp tục ghi rõ chưa gửi email; không có API giả hoặc thông báo gửi thành công khi chưa gọi được máy chủ. Việc hoàn thiện backend cần token một lần, thời hạn, chống dò email, rate limit, thu hồi phiên và luồng mail tương ứng.

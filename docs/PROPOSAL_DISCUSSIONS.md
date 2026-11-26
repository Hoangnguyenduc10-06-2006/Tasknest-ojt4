# Trao đổi trước khi chọn đội

Trong trang chi tiết yêu cầu dự án, mỗi đề xuất có mục **Trao đổi riêng**. Khách hàng đăng yêu cầu và chủ đội gửi đề xuất có thể hỏi đáp về phạm vi, cách thực hiện, lịch và điều kiện bàn giao trước khi quyết định hợp tác.

- Mỗi đề xuất có lịch sử riêng. Thành viên khác của đội, đội cạnh tranh và người chưa đăng nhập không được đọc hoặc gửi tin nhắn.
- Tin nhắn lưu tên người gửi và thời điểm; nội dung được hiển thị dạng văn bản, không chạy HTML và không sửa hoặc xóa lịch sử.
- Lịch sử phân trang theo mã tin nhắn, tránh trùng hoặc bỏ sót do có tin mới. Mỗi trang hiển thị tối đa 30 tin.
- Hệ thống chống tạo trùng khi gửi lại do lỗi mạng. Dùng lại mã thao tác với nội dung khác bị từ chối.
- Trạng thái đã đọc tiến về phía trước; xem lại lịch sử không làm mất mốc đã đọc mới hơn.
- Tin chưa đọc được đếm theo người xem, không tính tin tự gửi. Danh sách đề xuất cập nhật khi người dùng tải lại hoặc mỗi 15 giây khi trang đang hiển thị. Cuộc trao đổi đang mở cập nhật mỗi 10 giây khi ở trang tin mới nhất và đang hiển thị.
- Chỉ gửi khi yêu cầu đang mở và đề xuất đang được xét. Sau khi rút đề xuất, tạm dừng/đóng yêu cầu hoặc chọn đội, các bên chỉ xem lại lịch sử. Công việc sau lựa chọn tiếp tục trong không gian dự án.
- Nội dung trao đổi không tự thay đổi ngân sách hoặc kế hoạch đề xuất. Đội cần sửa và gửi lại đề xuất nếu hai bên thay đổi thỏa thuận.

Migration `V14__proposal_discussions.sql` thêm bảng tin nhắn và mốc đã đọc. API nằm dưới `/api/work/community/requests/{request}/proposals/{proposal}/messages`. Không mở thêm API công khai và chưa gửi email/push cho tin trao đổi.

Kiểm thử thực hiện bằng `scripts/test-community.py` trên MySQL riêng, kiểm tra quyền hai bên, cách ly đội cạnh tranh, gửi lại thao tác, đếm tin chưa đọc, mốc đã đọc, phân trang và khóa gửi sau khi rút/chọn đội. Bài `scripts/test-schema.py --service-startup` kiểm tra toàn bộ chuỗi migration và khởi động lại các service.

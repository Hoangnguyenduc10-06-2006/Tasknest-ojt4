# Nhắn tin trong TaskNest

## Luồng sử dụng

Bấm biểu tượng ở góc dưới bên phải để mở cửa sổ chat nhanh mà vẫn ở trang hiện tại. Chọn một cuộc trò chuyện gần đây, rồi bấm **Mở toàn trang** để tiếp tục đúng phòng trong trang Tin nhắn. Trang Tin nhắn cũng có trong menu Làm việc và Kết nối của tôi. Chọn **Cuộc trò chuyện mới** để tìm một tài khoản đã xác nhận email hoặc mở phòng của đội, dự án đang tham gia. Có thể mở chat từ hồ sơ thành viên, danh sách thành viên dự án, hồ sơ đội và nút **Trao đổi dự án** trong trang dự án.

Trong cả hai giao diện, bấm biểu tượng đính kèm để chọn một ảnh PNG hoặc JPEG tối đa 5 MiB. Xem trước, bỏ ảnh hoặc thêm lời nhắn trước khi gửi. Tin có thể chỉ chứa ảnh. Bấm vào ảnh đã gửi để xem lớn hoặc tải xuống.

Mỗi tin hiển thị giờ theo múi giờ Việt Nam. Các tin trong cùng một khoảng 15 phút được gom thành một cụm; khi sang ngày mới hoặc cách nhau từ 15 phút, giao diện đặt mốc như **Hôm nay, 09:30** hoặc **Hôm qua, 18:10**. Danh sách phòng hiển thị giờ ngắn gọn. Trên máy tính, đưa chuột lên biểu tượng đồng hồ của tin; trên điện thoại, bấm biểu tượng đó để xem ngày và giờ gửi đầy đủ.

Tin do bạn gửi hiển thị **Đã gửi** cho tới khi người nhận xem qua tin đó, sau đó đổi thành **Đã xem**. Trong phòng nhiều người, giao diện hiển thị số người đã xem. Trạng thái được lấy từ mốc đọc của từng thành viên trong phòng và tự cập nhật khi lịch sử tin nhắn làm mới.

Ô soạn tin dùng chung cho cửa sổ chat nhanh và trang Tin nhắn, hỗ trợ xem trước ảnh, bỏ ảnh, đếm ký tự ở giao diện đầy đủ và gửi nhanh bằng Enter; dùng Shift + Enter để xuống dòng.

- **Trò chuyện riêng:** chỉ hai tài khoản được xem. Một cặp tài khoản có duy nhất một cuộc trò chuyện. Mỗi bên có thể chặn/bỏ chặn tin nhắn riêng; không bên nào bỏ chặn thay người còn lại.
- **Nội bộ đội:** chỉ thành viên hiện tại của đội được xem và gửi tin.
- **Trao đổi dự án:** thành viên hiện tại của dự án và khách hàng đã xác nhận hợp tác (ACTIVE hoặc COMPLETED) được xem. Dự án lưu trữ chỉ xem lại lịch sử.

Vai trò khách hàng/dev là theo từng dự án, không phụ thuộc nhu cầu đã chọn khi thiết lập tài khoản. Phòng được tạo khi lần đầu mở; hệ thống không tạo tài khoản hoặc tin nhắn mẫu. Đề xuất trước khi chọn đội vẫn sử dụng trao đổi riêng giữa khách hàng và trưởng đội, không tự động chia sẻ với cả đội.

## Lưu trữ và đồng bộ

Flyway V15 tạo các bảng `chat_conversations`, `chat_messages`, `chat_reads`, `chat_blocks`. Không sửa hoặc xoá dữ liệu nghiệp vụ hiện tại. Quyền được kiểm tra lại từ bảng thành viên/quan hệ hợp tác trên mỗi lần đọc, gửi, đánh dấu đã đọc và chặn. Tham gia phòng không cấp thêm quyền vào đội hoặc dự án.

Tin nhắn văn bản tối đa 4.000 ký tự, hiển thị dưới dạng văn bản an toàn. Danh sách cuộc trò chuyện phân trang 30 mục; lịch sử phân trang theo ID, mỗi trang 40 tin. Mốc đã đọc chỉ tiến về phía trước và phải thuộc đúng phòng. Chỉ đánh dấu đã đọc khi tab đang hiển thị, người dùng ở cuối trang tin mới nhất. Bản đang soạn, kể cả ảnh đã chọn, được giữ trong bộ nhớ khi chuyển phòng hoặc mở toàn trang trong cùng tab; tải lại trang hoặc đăng xuất sẽ xoá bản chưa gửi.

Flyway V16 thêm lưu trữ ảnh riêng cho chat. Lịch sử và danh sách phòng chỉ trả cờ `has_image`; trình duyệt tải ảnh qua endpoint có xác thực. Work kiểm tra quyền của phòng và liên kết giữa ảnh, tin nhắn và phòng mỗi lần tải. Ảnh nằm trong database của Work và được sao lưu cùng dữ liệu chat.

Mỗi lần gửi mang `clientId` UUID. Gửi lại cùng nội dung/mã trả về tin đã lưu; cùng mã nhưng đổi nội dung hoặc ảnh trả 409. Khoá phòng cùng transaction READ_COMMITTED xử lý an toàn các yêu cầu gửi lại đồng thời. Có giới hạn gửi 60 lần/phút, trong đó tối đa 10 lần gửi ảnh, và mở phòng 30 lần/phút/tài khoản qua WorkRequestBudget.

Thông báo dùng transactional outbox, sự kiện `work.notification.created` với type `discovery.chat.message`, resource `CONVERSATION`. Thông báo chỉ ghi lời nhắc chung và `/messages?conversation=<id>`, không sao chép nội dung chat và không gửi email. Consumer loại bỏ thông báo trùng và phát thay đổi inbox đến WebSocket cá nhân. Giao diện tải lại khi có sync/focus, đồng thời kiểm tra phòng đang mở mỗi 8 giây khi tab hiển thị; trạng thái đã đọc của người khác cũng được cập nhật qua lần kiểm tra này. Badge Tin nhắn dùng số chưa đọc thực tế của các phòng hiện còn quyền truy cập.

## API (yêu cầu tài khoản đã xác nhận email)

Base: `/api/work/community/chat`.

- `GET ?page=0`: danh sách phòng, số chưa đọc và `hasMore`.
- `GET /unread`: tổng tin chưa đọc.
- `GET /spaces`: đội và dự án có thể mở phòng (tối đa 100 mỗi loại; dự án/đội khác vẫn mở từ trang chi tiết).
- `GET /people?search=...`: tìm tài khoản theo tên/email, chỉ trả ID và tên, tối đa 20 kết quả.
- `POST` với `{kind: DIRECT|TEAM|PROJECT, target: <userUUID|teamID|projectID>}`: mở hoặc lấy phòng đã có.
- `GET /<id>?before=<messageID>`: thông tin phòng, thành viên, lịch sử và mốc đã đọc.
- `POST /<id>/messages` với JSON `{body, clientId}`: gửi văn bản. Dùng multipart với `file`, `clientId` và `body` tùy chọn để gửi một ảnh.
- `GET /<id>/messages/<messageId>/image`: tải ảnh đính kèm của một tin trong phòng.
- `PUT /<id>/read` với `{messageId}`: cập nhật đã đọc.
- `PUT /<id>/block` với `{blocked}`: chặn/bỏ chặn chat riêng.

Phòng không thuộc quyền của người gọi trả 404. Lỗi mạng giữ bản đang soạn để gửi lại; mất quyền 401/403/404 loại nội dung đã tải khỏi giao diện.

## Triển khai và kiểm thử

Phát hành notification-service có hỗ trợ type mới trước hoặc cùng work-service và frontend. Work tự áp dụng V15 và V16 khi khởi động nếu database chưa có các migration này. Khi rollback ứng dụng, giữ nguyên các bảng chat để không mất lịch sử. Sao lưu database trước khi áp dụng release.

Kiểm thử có trong `scripts/test-community.py` (MySQL/Gateway/Work thực), các test consumer và frontend. Không chạy các kiểm thử gieo dữ liệu vào database production; scripts sử dụng database/container tạm rồi dọn sau khi hoàn tất.

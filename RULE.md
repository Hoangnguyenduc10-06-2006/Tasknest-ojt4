# Bộ quy tắc Hệ thống quản lý công việc và dự án

- Phiên bản: 2.0 — bình luận có ảnh, phản hồi, nhắc tên và tài liệu dự án.
- Ngày cập nhật: 28/10/2026.
- Thời gian phát triển dự án: 4 tuần, từ 19/10/2026 đến hết 15/11/2026 (suy ra theo 28 ngày lịch).
- Phạm vi tài liệu: nghiệp vụ, phân quyền, Kanban, dashboard, biểu đồ, giao diện Sáng/Tối, bình luận/ảnh/phản hồi/nhắc tên, tài liệu và liên kết dự án, ghi giờ làm, tiến độ, lời mời, yêu cầu tham gia và thông báo.

## 1. Cơ sở và trạng thái quyết định

Tên làm việc: TaskNest. Repository mới đã được người dùng cung cấp: [KHANHAN007/TaskNest---OJT4](https://github.com/KHANHAN007/TaskNest---OJT4). [Figma](https://www.figma.com/design/RJQ7mMCNWhOWSUYlhlAjBR/TaskNest---OJT?node-id=0-1) và [Jira](https://khanhanke.atlassian.net/jira/software/projects/SCRUM/boards/1) là liên kết nhóm cung cấp; chưa đối chiếu nội dung trực tiếp. Bảng phân công là dự thảo để người dùng tự thêm Jira, không tự chỉnh board.

Repository cũ là nguồn tham khảo nghiệp vụ và bộ rule. Lark QuickShop và file đề cương Word chỉ là mẫu về cấu trúc đặc tả, trình bày và lập kế hoạch; không mặc nhiên áp dụng đề tài, tính năng, công nghệ, nhân sự hoặc lịch trong hai mẫu.

Nguồn tham khảo:

- [Repository cũ](https://github.com/KHANHAN007/PTIT_CNTT3_IT104_Project/tree/master), bản đã phân tích tại commit `bc84277390fee86c2b2ce465caca474bfd2da120`.
- [Mẫu đặc tả Lark](https://psg3319iyvnv.sg.larksuite.com/wiki/Nmj9wV8BlietB0kgd9pltICAgVg).
- Mẫu đề cương: `Bao_Cao_De_Cuong_Du_An_Project_Proposal.docx` do người dùng cung cấp.

Tài liệu tổng hợp bộ rule v1 đã được người dùng đánh giá hợp lý và các điều chỉnh tiếp theo. Các lựa chọn nền tảng về ba vai trò, luồng duyệt công việc và lưu trữ được giữ làm cơ sở của bản này. Các yêu cầu được xác nhận rõ qua trao đổi gồm:

- Ghi giờ bằng Bắt đầu/Dừng, hỗ trợ bổ sung giờ thủ công, bắt buộc có thời gian ước tính và cảnh báo tại ngưỡng 80%.
- Đồng bộ thay đổi trong ứng dụng theo thời gian thực.
- Xác nhận email khi đăng ký; thông báo trong ứng dụng kết hợp gửi email.
- Lời mời trực tiếp gắn với tài khoản: người nhận chấp nhận là tham gia, không cần duyệt thêm.
- Link/QR dùng chung: người dùng gửi yêu cầu và phải được Owner hoặc Manager duyệt.
- Hai chế độ Danh sách/Kanban, dashboard cá nhân và dự án, biểu đồ tiến độ, tìm kiếm/lọc/sắp xếp, phân trang và bình luận.
- Lịch dự kiến của dự án; đánh giá đúng hạn theo lần gửi chờ duyệt được chấp nhận; cờ Đang bị chặn.
- Bình luận thông thường thông báo trong ứng dụng; phản hồi và @thành viên kết hợp thông báo trong ứng dụng với email. Có thời gian chờ gửi lại yêu cầu tham gia sau khi bị từ chối.
- Hỗ trợ dark mode trong ứng dụng; hành vi giao diện được quy định tại mục 16.
- Phiên bản đầu hỗ trợ ảnh trong bình luận/phản hồi nhiệm vụ, @thành viên và tệp/liên kết cấp dự án. Tệp tùy ý trong bình luận nhiệm vụ, Gantt, phụ thuộc nhiệm vụ, công việc lặp và quản lý ngân sách nằm ngoài phạm vi bắt buộc.

Người dùng đã xác nhận toàn bộ 12 điểm bổ sung và tham số nghiệp vụ ngày 22/10/2026. Mục 19 tổng hợp các giá trị đã chốt. JWT đã được chốt cùng nhóm bảo mật ở mục 21. Stack đã được cập nhật tại mục 22 theo lựa chọn trực tiếp của người dùng. Tài liệu mẫu chỉ tham khảo rule; không dùng làm căn cứ chọn công nghệ hoặc công cụ. Ranh giới dịch vụ, cấu hình còn thiếu và đề xuất chưa duyệt được phân biệt rõ; chưa triển khai mã nguồn ứng dụng.

## 2. Thuật ngữ và nguyên tắc chung

| Mã | Quy tắc |
|---|---|
| GEN-01 | Hệ thống quản lý tài khoản, dự án, thành viên, nhiệm vụ, phiên ghi giờ, lời mời, yêu cầu tham gia và thông báo. |
| GEN-02 | Một người dùng được tham gia nhiều dự án và có thể giữ vai trò khác nhau ở từng dự án. |
| GEN-03 | Người dùng chỉ được truy cập dữ liệu nội bộ của dự án mà mình đang là thành viên. Người đang được mời hoặc chờ duyệt chỉ được xem thông tin tối thiểu trên trang tham gia. |
| GEN-04 | Công việc cá nhân là danh sách nhiệm vụ được giao cho người dùng trong các dự án, không phải một loại nhiệm vụ độc lập. |
| GEN-05 | Backend phải kiểm tra quyền và điều kiện nghiệp vụ cho mọi thao tác. Ẩn hoặc vô hiệu hóa nút trên giao diện không thay thế việc kiểm tra quyền. |
| GEN-06 | Mốc thời gian do máy chủ xác định. Ngày và giờ nghiệp vụ được hiển thị, diễn giải theo múi giờ Việt Nam (`Asia/Ho_Chi_Minh`). |

## 3. Tài khoản và xác nhận email

| Mã | Quy tắc |
|---|---|
| ACC-01 | Đăng ký gồm họ tên, email, mật khẩu và xác nhận mật khẩu. |
| ACC-02 | Họ tên có nội dung sau khi bỏ khoảng trắng đầu/cuối. Độ dài 2–100 ký tự. |
| ACC-03 | Email đúng định dạng, bỏ khoảng trắng đầu/cuối, chuyển về chữ thường trước khi kiểm tra và lưu; duy nhất trong hệ thống. |
| ACC-04 | Mật khẩu tối thiểu 8 ký tự; xác nhận mật khẩu phải khớp. Mật khẩu được lưu dưới dạng băm và không được trả về qua API. |
| ACC-05 | Người dùng chỉ được sửa hồ sơ của mình. Trong phiên bản đầu, email đăng nhập không được thay đổi. |
| ACC-06 | Có chức năng yêu cầu email đặt lại mật khẩu khi quên mật khẩu. Phản hồi không tiết lộ email có tồn tại; luồng không tự đăng nhập hoặc đổi mật khẩu chỉ từ email nhập vào. |
| ACC-07 | Đặt lại mật khẩu phải xác minh token hợp lệ, dùng một lần; mật khẩu mới/xác nhận tuân ACC-04. Hạn token và giới hạn gửi được chốt ở cấu hình kỹ thuật. |
| ACC-08 | Người dùng đã đăng nhập có chức năng đổi mật khẩu của mình; không thay đổi email hoặc tài khoản người khác qua chức năng này. Cách xác minh lại và xử lý các phiên sau đổi/reset được đề xuất riêng trước triển khai. |
| ACC-09 | Có ảnh đại diện cá nhân và ảnh đại diện dự án. Người dùng chỉ đổi ảnh của mình; Owner/Manager đổi ảnh dự án theo quyền sửa dự án. Không có ảnh thì hiển thị ảnh mặc định. |
| ACC-10 | Các ảnh tải lên phải đáp ứng SEC-12. Ảnh trong bình luận/phản hồi tuân COMMENT-07–COMMENT-15; tài liệu dự án tuân FILE-01–FILE-14. Việc hỗ trợ ảnh không bổ sung tệp tùy ý trong bình luận nhiệm vụ. |
| VERIFY-01 | Đăng ký hợp lệ tạo tài khoản Chưa xác nhận email và gửi email chứa liên kết xác nhận. |
| VERIFY-02 | Chỉ tài khoản đã xác nhận email được sử dụng chức năng dự án. Tài khoản chưa xác nhận chỉ được thực hiện luồng xác nhận, gửi lại email và đăng xuất. |
| VERIFY-03 | Liên kết xác nhận có hiệu lực 24 giờ, chỉ dùng thành công một lần; gửi lại vô hiệu hóa liên kết cũ. |
| VERIFY-04 | Gửi lại email xác nhận sau ít nhất 60 giây, tối đa 5 lần/giờ cho một tài khoản. |
| VERIFY-05 | Gửi email thất bại không xóa tài khoản đã tạo. Giao diện hiển thị tình trạng chưa xác nhận và hỗ trợ gửi lại. |

## 4. Vai trò và phân quyền theo dự án

Ba vai trò quyền hạn: **Owner — Chủ dự án**, **Manager — Quản lý dự án**, **Member — Thành viên**. Frontend, Backend, Fullstack, Designer và Tester là thông tin chuyên môn, không tạo thêm quyền.

| Thao tác | Owner | Manager | Member |
|---|---|---|---|
| Xem dự án, danh sách thành viên và mọi nhiệm vụ trong dự án | Có | Có | Có |
| Sửa thông tin dự án | Có | Có | Không |
| Lưu trữ hoặc mở lại dự án | Có | Không | Không |
| Chỉ định hoặc thay đổi Manager | Có | Không | Không |
| Mời trực tiếp với vai trò Member | Có | Có | Không |
| Quản lý link/QR dùng chung | Có | Có | Không |
| Duyệt hoặc từ chối yêu cầu tham gia | Có | Có | Không |
| Xóa thành viên khỏi dự án | Có | Không | Không |
| Tạo nhiệm vụ và giao cho thành viên bất kỳ | Có | Có | Không |
| Tạo nhiệm vụ cho chính mình | Có | Có | Có |
| Sửa nội dung, phân công lại hoặc hủy nhiệm vụ | Có | Có | Không |
| Cập nhật trạng thái thực hiện theo luồng cho phép | Có | Có | Chỉ nhiệm vụ được giao |
| Duyệt hoàn thành, yêu cầu làm lại hoặc mở lại nhiệm vụ | Có | Có | Không |
| Bắt đầu/Dừng ghi giờ | Chỉ nhiệm vụ được giao | Chỉ nhiệm vụ được giao | Chỉ nhiệm vụ được giao |
| Xem giờ làm của thành viên trong dự án | Có | Có | Chỉ giờ làm của mình |
| Xem Kanban, danh sách và dashboard dự án | Có | Có | Có, theo quyền dữ liệu |
| Bình luận nhiệm vụ | Có | Có | Có |
| Sửa bình luận/phản hồi và ảnh kèm theo | Chỉ của mình | Chỉ của mình | Chỉ của mình |
| Xóa bình luận/phản hồi | Mọi bình luận trong dự án | Mọi bình luận trong dự án | Chỉ của mình |
| Thêm tài liệu/liên kết dự án | Có | Có | Có |
| Sửa/xóa tài liệu hoặc liên kết dự án | Mọi mục trong dự án | Mọi mục trong dự án | Chỉ mục của mình |
| Bật cờ Đang bị chặn | Chỉ nhiệm vụ được giao | Chỉ nhiệm vụ được giao | Chỉ nhiệm vụ được giao |
| Gỡ cờ Đang bị chặn (bắt buộc lý do) | Có | Có | Chỉ nhiệm vụ được giao |

| Mã | Quy tắc |
|---|---|
| ROLE-01 | Mỗi dự án có đúng một Owner và tối đa một Manager. Dự án được phép chưa có Manager. |
| ROLE-02 | Owner và Manager là hai người khác nhau. Một người chỉ có một bản ghi thành viên và một vai trò trong cùng dự án. |
| ROLE-03 | Không đổi hoặc xóa Owner; chưa hỗ trợ chuyển quyền sở hữu trong phiên bản đầu. |
| ROLE-04 | Quyền được xác định từ vai trò hiện tại trong dự án; chức danh chuyên môn không làm tăng quyền. |
| ROLE-05 | Owner chỉ định Manager từ thành viên đã tham gia. Khi thay Manager, Manager cũ trở thành Member. |

## 5. Dự án

| Mã | Quy tắc |
|---|---|
| PRJ-01 | Tài khoản đã xác nhận email được tạo dự án và tự động trở thành Owner. Có thể tạo dự án chỉ gồm Owner rồi bổ sung thành viên sau. |
| PRJ-02 | Tên dài 3–100 ký tự, mô tả dài 10–500 ký tự sau khi bỏ khoảng trắng đầu/cuối. Ảnh không bắt buộc. |
| PRJ-03 | Tên không trùng giữa các dự án chưa lưu trữ của cùng Owner, không phân biệt chữ hoa/thường và khoảng trắng đầu/cuối. |
| PRJ-04 | Dự án có hai trạng thái: Đang hoạt động và Đã lưu trữ. |
| PRJ-05 | Dự án đã lưu trữ chỉ được xem lại; không sửa dữ liệu, ghi giờ, mời, nhận yêu cầu hoặc duyệt thêm thành viên. Owner được mở lại dự án. |
| PRJ-06 | Phiên bản đầu dùng lưu trữ thay cho xóa vĩnh viễn dự án để giữ lịch sử. |
| PRJ-07 | Không được lưu trữ dự án khi còn phiên ghi giờ đang chạy; phải kết thúc các phiên trước. |
| PRJ-08 | Bắt buộc nhập ngày bắt đầu và ngày kết thúc dự kiến khi tạo dự án; ngày kết thúc không trước ngày bắt đầu. Cho phép ngày bắt đầu trong quá khứ để nhập dự án đang triển khai. |
| PRJ-09 | Nếu deadline nhiệm vụ nằm ngoài khoảng thời gian dự kiến của dự án, hiển thị cảnh báo để Owner/Manager xem xét; không tự chặn việc lưu nhiệm vụ. |
| PRJ-10 | Thay đổi lịch dự án không tự thay ngày bắt đầu hoặc deadline từng nhiệm vụ. |

## 6. Lời mời trực tiếp bằng tài khoản và email

Lời mời trực tiếp dành riêng cho một tài khoản. Đây là quyết định mời của Owner/Manager nên không có bước phê duyệt bổ sung sau khi người nhận chấp nhận.

| Mã | Quy tắc |
|---|---|
| INV-01 | Owner/Manager nhập email để mời tài khoản đã đăng ký và xác nhận email vào dự án đang hoạt động. |
| INV-02 | Lời mời gắn với đúng tài khoản được mời, xuất hiện trong ứng dụng và gửi tới email đã xác nhận của tài khoản đó. |
| INV-03 | Mở liên kết trong email chỉ mở trang lời mời. Người dùng phải đăng nhập đúng tài khoản và chủ động Chấp nhận hoặc Từ chối. Chuyển tiếp liên kết không chuyển quyền nhận lời mời cho người khác. |
| INV-04 | Chấp nhận hợp lệ sẽ thêm người nhận với vai trò Member ngay, không cần Owner/Manager duyệt lại. |
| INV-05 | Không mời người đã là thành viên hoặc đã có lời mời trực tiếp đang chờ và còn hiệu lực trong cùng dự án. |
| INV-06 | Chỉ người nhận được chấp nhận/từ chối; người gửi được hủy lời mời đang chờ. |
| INV-07 | Trạng thái gồm Chờ phản hồi, Đã chấp nhận, Đã từ chối, Đã hủy và Hết hạn. Chỉ lời mời đang chờ, còn hiệu lực mới được chấp nhận. |
| INV-08 | Lời mời trực tiếp có hiệu lực 7 ngày. |

## 7. Link và mã QR dùng chung

Link và QR là hai cách mở cùng một trang yêu cầu tham gia. Chúng được nhiều người sử dụng, không tiêu hao sau lần tham gia đầu tiên. Người dùng đi qua link/QR dùng chung phải chờ duyệt, kể cả khi chính Owner/Manager là người chia sẻ link.

| Mã | Quy tắc |
|---|---|
| JOIN-01 | Mỗi dự án có một liên kết mời dùng chung và mã QR biểu diễn chính liên kết đó. Owner/Manager được xem, sao chép và chia sẻ. |
| JOIN-02 | Liên kết chứa mã khó đoán; QR không chứa mật khẩu hoặc thông tin xác thực tài khoản. |
| JOIN-03 | Mở link hoặc quét QR hiển thị thông tin tối thiểu: tên dự án, người tạo link và nút Yêu cầu tham gia. Chưa cấp quyền xem dữ liệu nội bộ. |
| JOIN-04 | Phải đăng nhập và xác nhận email trước khi gửi yêu cầu. Người chưa có tài khoản được đăng ký/xác nhận rồi quay lại trang yêu cầu tham gia. |
| JOIN-05 | Gửi yêu cầu tạo trạng thái Chờ duyệt; chưa tạo thành viên. Owner hoặc Manager được Chấp nhận/Từ chối. Chấp nhận mới tạo thành viên với vai trò Member. |
| JOIN-06 | Một người chỉ có tối đa một yêu cầu đang chờ trong cùng dự án; người gửi được hủy trước khi có quyết định. |
| JOIN-07 | Người đã là thành viên mở link/QR được chuyển vào dự án, không tạo yêu cầu hoặc thành viên trùng. |
| JOIN-08 | Nếu người đang chờ duyệt chấp nhận một lời mời trực tiếp hợp lệ, hệ thống thêm thành viên và đóng yêu cầu chờ với lý do Đã tham gia bằng lời mời trực tiếp. |
| JOIN-09 | Link/QR không tự hết hạn. Owner/Manager được tắt hoặc tạo lại. Tạo lại làm cả link và QR cũ mất hiệu lực. |
| JOIN-10 | Link bị tắt, bị thay thế hoặc thuộc dự án đã lưu trữ không nhận yêu cầu mới. |
| JOIN-11 | Tắt/tạo lại link không hủy các yêu cầu đã gửi; Owner/Manager tiếp tục xử lý khi dự án đang hoạt động. |
| JOIN-12 | Yêu cầu có trạng thái Chờ duyệt, Đã chấp nhận, Đã từ chối, Đã hủy và Đã đóng. Sau khi bị từ chối, chỉ được gửi lại qua link còn hiệu lực sau 24 giờ tính từ thời điểm bị từ chối; khoảng chờ áp dụng theo người dùng và dự án. Lời mời trực tiếp mới từ Owner/Manager vẫn được chấp nhận ngay. Sau khi tự hủy, được gửi lại nếu thỏa các điều kiện hiện hành. |
| JOIN-13 | Trang gửi yêu cầu hỗ trợ ghi lý do muốn tham gia, không bắt buộc, tối đa 500 ký tự. Owner/Manager xem danh sách yêu cầu đang chờ và lý do để quyết định. |
| JOIN-14 | Backend kiểm tra khoảng chờ khi gửi lại sau khi bị từ chối, kể cả đổi link, tab hoặc thiết bị; giao diện hiển thị thời điểm được gửi lại. |

## 8. Thành viên

| Mã | Quy tắc |
|---|---|
| MEM-01 | Thành viên được tạo sau khi chấp nhận lời mời trực tiếp hoặc sau khi yêu cầu tham gia được duyệt. |
| MEM-02 | Không xóa thành viên còn giữ nhiệm vụ chưa Hoàn thành/Đã hủy. Owner phải phân công lại hoặc xử lý các nhiệm vụ đó trước. |
| MEM-03 | Xóa thành viên làm mất quyền truy cập và nhận cập nhật của dự án ngay. Giữ thông tin người thực hiện trong lịch sử nhiệm vụ và giờ làm. |
| MEM-04 | Mọi lần thay đổi vai trò hoặc xóa thành viên phải được kiểm tra quyền và ghi lịch sử. |
| MEM-05 | Người đã bị xóa khỏi dự án không được dùng lại lời mời đã chấp nhận hoặc yêu cầu cũ để tự tham gia. Muốn quay lại phải có lời mời trực tiếp mới hoặc gửi yêu cầu mới và được duyệt. |

## 9. Nhiệm vụ

| Mã | Quy tắc |
|---|---|
| TASK-01 | Mỗi nhiệm vụ thuộc đúng một dự án và có đúng một người phụ trách đang là thành viên dự án khi được phân công. |
| TASK-02 | Tên dài 3–100 ký tự, không trùng trong cùng dự án sau khi bỏ khoảng trắng đầu/cuối và không phân biệt chữ hoa/thường. |
| TASK-03 | Bắt buộc có tên, người phụ trách, ưu tiên, ngày bắt đầu, deadline và thời gian ước tính lớn hơn 0. Mô tả không bắt buộc. |
| TASK-04 | Ưu tiên gồm Thấp, Trung bình, Cao; mặc định Trung bình. |
| TASK-05 | Khi tạo, ngày bắt đầu là hôm nay hoặc tương lai; deadline bằng hoặc sau ngày bắt đầu. Khi sửa nhiệm vụ cũ, được giữ ngày bắt đầu trong quá khứ. |
| TASK-06 | Member chỉ tạo nhiệm vụ cho chính mình. Owner/Manager được tạo và phân công lại cho thành viên bất kỳ. |
| TASK-07 | Nhiệm vụ mới luôn ở trạng thái Chưa bắt đầu. Lưu người tạo, thời điểm tạo và cập nhật gần nhất. |
| TASK-08 | Owner/Manager được sửa nội dung, ước tính và deadline của nhiệm vụ chưa Hoàn thành/Đã hủy; thay đổi phải lưu lịch sử. |

### Luồng trạng thái

Luồng chính: **Chưa bắt đầu → Đang thực hiện → Chờ duyệt → Hoàn thành**.

| Chuyển trạng thái | Người thực hiện | Điều kiện |
|---|---|---|
| Chưa bắt đầu → Đang thực hiện | Người phụ trách | Dự án đang hoạt động |
| Đang thực hiện → Chờ duyệt | Người phụ trách, Owner, Manager | Có ghi chú kết quả; kết thúc phiên ghi giờ đang chạy |
| Chờ duyệt → Hoàn thành | Owner, Manager | Xác nhận kết quả đạt yêu cầu |
| Chờ duyệt → Đang thực hiện | Owner, Manager | Có lý do yêu cầu làm lại |
| Hoàn thành → Đang thực hiện | Owner, Manager | Có lý do mở lại |
| Chưa bắt đầu/Đang thực hiện/Chờ duyệt → Đã hủy | Owner, Manager | Có lý do hủy; kết thúc phiên ghi giờ đang chạy |

| Mã | Quy tắc |
|---|---|
| FLOW-01 | Không chuyển trạng thái ngoài các đường đi cho phép. |
| FLOW-02 | Lưu riêng thời điểm gửi chờ duyệt và thời điểm/người duyệt hoàn thành. Khi mở lại, xóa mốc hoàn thành hiện tại và liên kết lần nộp được chấp nhận hiện tại nhưng giữ lịch sử các lần nộp, duyệt và mở lại. |
| FLOW-03 | Nhiệm vụ Hoàn thành/Đã hủy không được sửa nội dung trực tiếp. Hoàn thành phải mở lại trước; phiên bản đầu chưa khôi phục nhiệm vụ Đã hủy. |
| FLOW-04 | Owner/Manager được duyệt nhiệm vụ của chính mình; hệ thống vẫn ghi người duyệt. |
| FLOW-05 | Dùng hủy nhiệm vụ thay cho xóa vĩnh viễn trong phiên bản đầu. |
| FLOW-06 | Mỗi lần gửi chờ duyệt tạo một mốc nộp kết quả. Nếu bị yêu cầu làm lại, lần gửi sau tạo mốc mới. Khi duyệt, ghi nhận đúng lần nộp dẫn tới kết quả được chấp nhận. |
| FLOW-07 | Chỉ người đang được giao nhiệm vụ được gửi kết quả Chờ duyệt. Owner/Manager không được gửi thay thành viên; chỉ được gửi khi chính họ là người phụ trách. Giao diện và API đều phải kiểm tra điều kiện này. |
| FLOW-08 | Khi yêu cầu làm lại từ Chờ duyệt, Owner/Manager phải nhập lý do, deadline giao lại từ hôm nay và không trước ngày bắt đầu, giữ nguyên giờ ước tính ban đầu, không bổ sung hoặc thay đổi giờ ước tính khi giao lại. Cập nhật kế hoạch và chuyển trạng thái trong cùng giao dịch; giữ người phụ trách, giờ đã ghi và lịch sử nộp/duyệt. Không tự khởi động lại timer. |

| FLOW-09 | Khi gửi Chờ duyệt, người phụ trách phải chọn một hình thức: một tệp kết quả (tối đa 20 MiB, theo định dạng được phép của tài liệu dự án) hoặc liên kết HTTP/HTTPS, kèm ghi chú kết quả. Mỗi lần nộp lưu riêng kết quả; tệp kiểm tra nội dung/quyền tại backend và tính vào hạn mức dự án. Người duyệt xem kết quả trước khi quyết định. Các lần nộp cũ trước thay đổi vẫn được giữ. |

### Công việc đang bị chặn

| Mã | Quy tắc |
|---|---|
| BLOCK-01 | Nhiệm vụ hỗ trợ cờ Đang bị chặn và lý do, ví dụ chờ API, thiếu tài liệu hoặc chờ quyết định. Đây là thuộc tính bổ sung, không phải trạng thái hoặc cột Kanban mới. |
| BLOCK-02 | Chỉ người đang được giao nhiệm vụ được bật cờ bị chặn. Người phụ trách, Owner hoặc Manager được gỡ cờ đang chặn trên nhiệm vụ chưa Hoàn thành/Đã hủy trong dự án đang hoạt động. Mỗi lần bật/gỡ cờ bắt buộc có lý do từ 1 đến 2000 ký tự và lưu người thao tác, thời điểm, thay đổi cùng lý do trong lịch sử. Owner/Manager không được bật cờ thay thành viên. |
| BLOCK-03 | Cờ bị chặn hiển thị trên thẻ Kanban, danh sách, chi tiết và dashboard; không tự đổi trạng thái hoặc deadline. Khi bật cờ, hệ thống kết thúc phiên ghi giờ đang chạy của nhiệm vụ trong cùng giao dịch. |
| BLOCK-04 | Nhiệm vụ đang bị chặn không được bắt đầu ghi giờ; backend phải từ chối cả yêu cầu gọi trực tiếp API. Chỉ sau khi gỡ cờ, người phụ trách mới có thể bắt đầu phiên mới nếu nhiệm vụ đang thực hiện và đáp ứng các rule TIME. Không tự khởi động lại timer; thời gian bị chặn không được tự cộng vào giờ làm. |

## 10. Ghi nhận giờ làm

Giờ làm là thời gian người dùng chủ động ghi nhận, không phải phép đo hoạt động trên máy tính và không phải phần trăm hoàn thành.

| Mã | Quy tắc |
|---|---|
| TIME-01 | Chỉ người phụ trách được Bắt đầu/Dừng ghi giờ trên nhiệm vụ của mình đang Đang thực hiện, thuộc dự án đang hoạt động. |
| TIME-02 | Mỗi người chỉ có một phiên đang chạy trên toàn hệ thống, kể cả khi mở nhiều tab/thiết bị. |
| TIME-03 | Phiên lưu nhiệm vụ, người thực hiện, thời điểm bắt đầu/kết thúc. Tổng giờ làm bằng tổng thời lượng các phiên hợp lệ. |
| TIME-04 | Máy chủ xác định thời gian; đồng hồ phía giao diện chỉ hiển thị, không quyết định thời lượng được lưu. |
| TIME-05 | Tải lại, đóng tab hoặc mất kết nối không tự kết thúc phiên. Khi quay lại, khôi phục phiên đang chạy để người dùng dừng hoặc điều chỉnh. |
| TIME-06 | Thao tác chưa được máy chủ xác nhận hiển thị Chưa đồng bộ, không báo đã lưu thành công. |
| TIME-07 | Chuyển sang Chờ duyệt, hủy hoặc phân công lại phải kết thúc phiên đang chạy tại thời điểm máy chủ xác nhận thao tác. Giờ đã ghi vẫn thuộc người đã thực hiện. |
| TIME-08 | Người dùng được bổ sung giờ quên ghi hoặc sửa phiên của mình trước khi nhiệm vụ hoàn thành; bắt buộc có lý do. Không tạo thời gian trùng với phiên khác của chính mình hoặc nằm trong tương lai. |
| TIME-09 | Mọi điều chỉnh giữ giá trị trước/sau, người sửa và lý do. Owner/Manager không được âm thầm sửa giờ của người khác. |
| TIME-10 | Không bổ sung/sửa giờ trên nhiệm vụ Đã hủy hoặc dự án Đã lưu trữ. |
| TIME-11 | Phiên đăng nhập hết hạn, Refresh Token hết hạn/bị thu hồi hoặc đăng xuất không tự kết thúc phiên ghi giờ. Khi đăng nhập lại hợp lệ, khôi phục phiên ghi giờ theo TIME-05; không cho truy cập dữ liệu khi chưa xác thực. |

## 11. Tiến độ và cảnh báo

| Mã | Quy tắc |
|---|---|
| PROG-01 | Deadline có hiệu lực đến cuối ngày theo múi giờ Việt Nam. Nhiệm vụ Chưa bắt đầu/Đang thực hiện là Quá hạn khi đã qua deadline. Nhiệm vụ Chờ duyệt hiển thị riêng Chờ duyệt sau deadline nếu đã qua hạn; không mặc nhiên kết luận người thực hiện nộp trễ. |
| PROG-02 | Khi được duyệt hoàn thành, đánh giá Đúng hạn/Trễ hạn theo lần gửi chờ duyệt gần nhất dẫn đến kết quả được chấp nhận, so với deadline có hiệu lực tại lần nộp đó. Lưu deadline tại lần nộp để tránh thay đổi lịch làm sai lệch đánh giá lịch sử. Quản lý duyệt muộn không làm lần nộp đúng hạn thành trễ hạn. |
| PROG-03 | Tỷ lệ hoàn thành dự án = số nhiệm vụ Hoàn thành / tổng nhiệm vụ không bị hủy × 100%. Không có nhiệm vụ hợp lệ thì hiển thị Chưa có nhiệm vụ. |
| PROG-04 | Thời gian sử dụng gồm các phiên đã kết thúc và thời gian đang chạy của phiên hiện tại. |
| PROG-05 | Nhiệm vụ chưa Hoàn thành/Đã hủy sử dụng từ 80% đến hết 100% ước tính được cảnh báo Có rủi ro vượt ước tính; lớn hơn 100% hiển thị Vượt thời gian ước tính. |
| PROG-06 | Ghi giờ, đồng hồ đang chạy và cảnh báo thời gian là chức năng thuộc phạm vi triển khai; thay thế việc để chức năng này ngoài phạm vi ở bản v1. |
| PROG-07 | Quá hạn và vượt ước tính là hai đánh giá riêng, có thể xuất hiện đồng thời. Không dùng giờ làm để suy ra phần trăm hoàn thành công việc. |
| PROG-08 | Sửa ước tính hoặc giờ làm phải tính lại cảnh báo và lưu lịch sử. |
| PROG-09 | Nếu bị yêu cầu làm lại, đánh giá hạn của lần nộp được xét tiếp theo theo mốc gửi lại. Tỷ lệ hoàn thành dự án chỉ tính nhiệm vụ đã được duyệt Hoàn thành. |

## 12. Đồng bộ thời gian thực

| Mã | Quy tắc |
|---|---|
| RT-01 | Danh sách, Kanban, chi tiết, dashboard và biểu đồ liên quan tự cập nhật khi nhiệm vụ được tạo/sửa/đổi trạng thái/phân công lại, đổi cờ bị chặn, phiên ghi giờ bắt đầu/kết thúc, bình luận/phản hồi/nhắc tên hoặc thông báo thay đổi, tài liệu/liên kết dự án được thêm/sửa/xóa; không cần tải lại trang. Chỉ gửi sự kiện đến người còn quyền truy cập. |
| RT-02 | Đồng hồ tự hiển thị thời gian tăng dần; không yêu cầu ghi cơ sở dữ liệu hoặc gửi sự kiện mỗi giây. |
| RT-03 | Cảnh báo cập nhật khi vượt ngưỡng ước tính hoặc deadline dù không có thao tác mới của người dùng. |
| RT-04 | Chỉ tài khoản có quyền được nhận dữ liệu tương ứng. Xóa thành viên làm mất quyền nhận dữ liệu dự án ngay, bao gồm các kết nối đang mở. |
| RT-05 | Khi kết nối lại, tải trạng thái mới nhất để bù cập nhật bị bỏ lỡ; không cộng giờ hoặc áp dụng sự kiện hai lần. |
| RT-06 | Hai người sửa cùng nhiệm vụ từ dữ liệu cũ phải được phát hiện xung đột; không âm thầm ghi đè. Người thao tác cần tải dữ liệu mới trước khi lưu lại. |
| RT-07 | Khi có kết nối ổn định, cập nhật đến phiên đang kết nối trong 2 giây; cảnh báo theo thời gian xuất hiện trong 60 giây sau khi vượt ngưỡng. Cấu hình môi trường và tải kiểm thử được thống nhất ở bước kỹ thuật. |

## 13. Thông báo trong ứng dụng và email

| Mã | Quy tắc |
|---|---|
| NOTI-01 | Lời mời, yêu cầu tham gia, kết quả xử lý và các cảnh báo nghiệp vụ được thông báo trong ứng dụng kết hợp gửi email theo bảng người nhận bên dưới. Bình luận thông thường chỉ thông báo trong ứng dụng; người được phản hồi hoặc @nhắc tên nhận cả thông báo trong ứng dụng và email theo COMMENT-04, COMMENT-11 và COMMENT-12. |
| NOTI-02 | Thông báo trong ứng dụng được lưu, có Chưa đọc/Đã đọc, bộ đếm chưa đọc và liên kết tới nội dung phù hợp với quyền người nhận. |
| NOTI-03 | Người đang kết nối nhận thông báo tự động. Người chưa mở ứng dụng xem được thông báo khi đăng nhập lại. |
| NOTI-04 | Email gửi đến địa chỉ đã xác nhận của tài khoản; riêng email xác nhận đăng ký gửi đến địa chỉ đang chờ xác nhận. |
| NOTI-05 | Chỉ tạo thông báo sau khi nghiệp vụ được lưu thành công. Lỗi gửi email không làm thất bại nghiệp vụ đã lưu. Theo dõi trạng thái gửi và thử lại lỗi tạm thời. |
| NOTI-06 | Xử lý lại cùng sự kiện không tạo thông báo trong ứng dụng hoặc chủ động gửi email trùng. Người trùng vai trò chỉ nhận một thông báo cho cùng sự kiện. |
| NOTI-07 | Đã đọc trong ứng dụng không đồng nghĩa đã đọc email. Email được đưa vào hàng đợi ngay sau sự kiện; thời điểm đến hộp thư phụ thuộc dịch vụ email. |
| NOTI-08 | Mỗi loại cảnh báo rủi ro, vượt ước tính và quá hạn chỉ thông báo một lần cho mỗi nhiệm vụ trong phiên bản đầu; nhãn cảnh báo vẫn tính lại theo dữ liệu hiện tại. Nếu một lần cập nhật nhảy thẳng từ dưới 80% lên trên 100%, chỉ gửi cảnh báo Vượt thời gian ước tính cho lần đó. |

| Sự kiện | Người nhận trong ứng dụng và email |
|---|---|
| Lời mời trực tiếp mới | Tài khoản được mời |
| Lời mời trực tiếp được chấp nhận/từ chối | Người gửi lời mời |
| Yêu cầu tham gia mới qua link/QR | Owner và Manager |
| Yêu cầu tham gia được chấp nhận/từ chối | Người gửi yêu cầu |
| Được giao hoặc phân công lại nhiệm vụ | Người phụ trách mới; người cũ nếu bị thay |
| Nhiệm vụ được gửi Chờ duyệt | Owner và Manager |
| Nhiệm vụ được duyệt, yêu cầu làm lại, mở lại hoặc hủy | Người phụ trách |
| Nhiệm vụ chạm ngưỡng rủi ro, vượt ước tính hoặc quá hạn thực hiện | Người phụ trách, Owner và Manager |
| Nhiệm vụ vẫn Chờ duyệt khi qua deadline | Owner và Manager; nội dung nhắc duyệt, không kết luận người thực hiện nộp trễ |
| Vai trò thay đổi hoặc bị xóa khỏi dự án | Thành viên liên quan |
| Phản hồi bình luận | Tác giả bình luận được phản hồi còn quyền xem nhiệm vụ |
| @thành viên trong bình luận/phản hồi | Người được nhắc tên còn quyền xem nhiệm vụ; chỉ gửi khi được nhắc mới, theo COMMENT-12 |

Email xác nhận đăng ký thuộc luồng AUTH, không yêu cầu người nhận đã có quyền truy cập chức năng dự án. Thông báo xóa thành viên chỉ nêu việc thay đổi quyền, không cấp lại quyền truy cập dữ liệu nội bộ.

| Sự kiện chỉ thông báo trong ứng dụng | Người nhận |
|---|---|
| Bình luận/phản hồi mới trên nhiệm vụ | Người phụ trách và người tạo nhiệm vụ còn quyền xem; loại người vừa thao tác và người nhận trùng. Nếu đồng thời là người được phản hồi/nhắc tên, gộp thành một thông báo trong ứng dụng và một email theo nhóm sự kiện tương ứng |

## 14. Tính nhất quán và lịch sử

| Mã | Quy tắc |
|---|---|
| DATA-01 | Tạo dự án và tạo quyền Owner phải cùng thành công hoặc cùng thất bại. |
| DATA-02 | Chấp nhận lời mời/duyệt yêu cầu phải đồng thời cập nhật trạng thái và tạo thành viên; xử lý lặp hoặc đồng thời không tạo bản ghi trùng. |
| DATA-03 | Chỉ có một nguồn dữ liệu chính xác định vai trò; không để lệch giữa thông tin Manager của dự án và vai trò thành viên. |
| DATA-04 | Kiểm tra quyền, trạng thái dự án, hiệu lực lời mời/link và trạng thái thành viên tại thời điểm ghi dữ liệu, không chỉ khi mở giao diện. |
| DATA-05 | Ghi lịch sử phân công, đổi trạng thái, các lần nộp/duyệt, deadline, lịch dự án, ước tính, điều chỉnh giờ, cờ bị chặn, vai trò và xóa thành viên; gồm người thao tác, thời gian, thay đổi và lý do khi bắt buộc. |
| DATA-06 | Thao tác bị từ chối trả thông báo cụ thể, ví dụ Không thể xóa thành viên vì còn 2 nhiệm vụ đang phụ trách. |

## 15. Danh sách và Kanban board

| Mã | Quy tắc |
|---|---|
| BOARD-01 | Mỗi dự án có hai chế độ Danh sách và Kanban, dùng chung dữ liệu nhiệm vụ và bộ lọc. |
| BOARD-02 | Kanban gồm bốn cột Chưa bắt đầu, Đang thực hiện, Chờ duyệt, Hoàn thành. Nhiệm vụ Đã hủy được xem bằng bộ lọc riêng trong danh sách, không có cột hoạt động trên Kanban. |
| BOARD-03 | Thẻ hiển thị tên, người phụ trách, ưu tiên, deadline, nhãn cảnh báo và cờ Đang bị chặn nếu có; mở thẻ để xem chi tiết. |
| BOARD-04 | Kéo thả chỉ đổi trạng thái theo quyền và luồng FLOW. Nếu cần ghi chú kết quả hoặc lý do, phải hoàn tất hộp nhập trước khi lưu. Không được kéo thả để vượt qua bước duyệt. |
| BOARD-05 | Di chuyển thẻ chỉ được coi là thành công khi máy chủ xác nhận; nếu thất bại thì quay về trạng thái đã lưu và hiển thị lý do. Xử lý xung đột theo RT-06. |
| BOARD-06 | Trên điện thoại hoặc khi không dùng kéo thả, có nút đổi trạng thái với cùng quyền và điều kiện nghiệp vụ. |
| BOARD-07 | Dự án đã lưu trữ vẫn xem được Danh sách/Kanban nhưng không thao tác thay đổi nhiệm vụ. |

## 16. Tìm kiếm, lọc, sắp xếp và trạng thái giao diện

| Mã | Quy tắc |
|---|---|
| VIEW-01 | Nhiệm vụ hỗ trợ tìm kiếm theo tên; lọc theo người phụ trách, trạng thái, ưu tiên, khoảng deadline, cảnh báo và cờ bị chặn. Có thao tác xóa bộ lọc. |
| VIEW-02 | Danh sách nhiệm vụ hỗ trợ sắp xếp theo deadline, ưu tiên, ngày tạo hoặc tên. Lọc/tìm kiếm được áp dụng trước phân trang và thống kê kết quả. |
| VIEW-03 | Giữ điều kiện tìm kiếm và bộ lọc tương thích khi chuyển Danh sách/Kanban. Nếu đang lọc Đã hủy thì không chuyển sang Kanban một cách âm thầm bỏ điều kiện; giải thích và cho phép xóa điều kiện trước khi chuyển. |
| VIEW-04 | Danh sách dự án hỗ trợ tìm kiếm tên, lọc theo trạng thái/vai trò của mình và sắp xếp theo tên, ngày tạo hoặc cập nhật. Chỉ trả dữ liệu được phép truy cập. |
| VIEW-05 | Công việc cá nhân hỗ trợ lọc theo dự án và các điều kiện nhiệm vụ phù hợp; chỉ hiển thị nhiệm vụ được giao cho người đang đăng nhập. |
| VIEW-06 | Danh sách nhiệm vụ, thành viên và thông báo được phân trang. Mặc định 20 bản ghi/trang, được chọn 10/20/50. Hiển thị tổng số kết quả và trang hiện tại; thay điều kiện lọc đưa về trang đầu. |
| VIEW-07 | Mỗi màn hình có trạng thái rõ khi đang tải, chưa có dữ liệu, không có kết quả lọc, lỗi tải hoặc mất kết nối. Không hiển thị lỗi tải thành số liệu 0. |
| VIEW-08 | Dữ liệu realtime cập nhật mà không tự xóa bộ lọc. Nhiệm vụ không còn khớp điều kiện rời khỏi tập kết quả; cập nhật tổng số và xử lý trang không còn hợp lệ. |

### Chế độ giao diện Sáng và Tối

| Mã | Quy tắc |
|---|---|
| THEME-01 | Ứng dụng hỗ trợ ba lựa chọn Sáng, Tối (dark mode) và Theo hệ thống. Khi chưa có lựa chọn được lưu, mặc định Theo hệ thống. |
| THEME-02 | Người dùng được đổi chế độ từ vị trí dễ tìm trên giao diện, kể cả ở màn hình đăng nhập/đăng ký; thay đổi có hiệu lực ngay, không cần tải lại trang. |
| THEME-03 | Lưu lựa chọn trên trình duyệt đang sử dụng và khôi phục khi tải lại hoặc mở lại ứng dụng. Nếu không thể lưu, vẫn cho đổi chế độ trong phiên hiện tại. Phiên bản đầu không yêu cầu đồng bộ lựa chọn giữa các thiết bị. |
| THEME-04 | Khi chọn Theo hệ thống, giao diện theo chế độ sáng/tối của thiết bị và cập nhật khi thiết bị đổi chế độ. Khi người dùng chọn Sáng hoặc Tối, ưu tiên lựa chọn đó. |
| THEME-05 | Chế độ áp dụng nhất quán cho toàn bộ giao diện ứng dụng: xác thực, dự án, Danh sách/Kanban, dashboard, biểu đồ, bình luận, thông báo, biểu mẫu, hộp thoại và các trạng thái tải/trống/lỗi. |
| THEME-06 | Chữ, nền, đường viền, nút, trạng thái vô hiệu hóa và dấu hiệu focus phải dễ phân biệt ở cả hai chế độ. Nhãn ưu tiên, trạng thái và cảnh báo giữ nguyên ý nghĩa, có chữ hoặc biểu tượng hỗ trợ thay vì chỉ phân biệt bằng màu. |
| THEME-07 | Biểu đồ điều chỉnh màu nền, trục, nhãn, chú giải và tooltip theo chế độ; các nhóm dữ liệu vẫn phân biệt được. Không đảo màu ảnh đại diện, ảnh dự án hoặc mã QR; QR giữ tương phản rõ để quét được. |
| THEME-08 | Đổi chế độ không làm mất nội dung đang nhập, bộ lọc, vị trí công việc, phiên ghi giờ hoặc kết nối realtime. Áp dụng chế độ đã xác định sớm khi mở trang để hạn chế chớp nền sai chế độ. |
| THEME-09 | Kiểm tra các màn hình chính ở cả Sáng/Tối trên máy tính và điện thoại; nội dung không bị mất, khó đọc hoặc che khuất. Quy tắc theme áp dụng cho ứng dụng; email vẫn phải đọc được trong trình đọc thư nhưng không đồng bộ theo lựa chọn theme của ứng dụng. |

## 17. Dashboard và biểu đồ

| Mã | Quy tắc |
|---|---|
| DASH-01 | Dashboard cá nhân hiển thị nhiệm vụ được giao: đang làm, sắp đến hạn, quá hạn thực hiện và Chờ duyệt. Tách mục Cần duyệt cho nhiệm vụ của người khác đang chờ duyệt trong dự án đang hoạt động mà người dùng làm Owner/Manager; không tính nhiệm vụ của chính mình vào mục này. Hai mục có số đếm và danh sách riêng, mở được chi tiết nhiệm vụ. |
| DASH-02 | Dashboard dự án hiển thị lịch dự kiến, tổng nhiệm vụ, hoàn thành, chờ duyệt, quá hạn thực hiện, chờ duyệt sau deadline, đang bị chặn và tỷ lệ hoàn thành theo PROG-03. |
| DASH-03 | Số liệu và nhãn tách rõ Quá hạn thực hiện với Chờ duyệt sau deadline; không quy trách nhiệm nộp muộn từ thời điểm quản lý duyệt. |
| DASH-04 | Biểu đồ trạng thái thể hiện số nhiệm vụ theo trạng thái; nhiệm vụ Đã hủy được ghi riêng, không tính vào mẫu số tỷ lệ hoàn thành. |
| DASH-05 | Biểu đồ tiến độ thể hiện số nhiệm vụ hoàn thành theo ngày/tuần; mốc ghi nhận là lúc được duyệt. Phân biệt số hoàn thành trong kỳ với tỷ lệ hoàn thành hiện tại. |
| DASH-06 | Biểu đồ khối lượng thành viên thể hiện số nhiệm vụ chưa hoàn thành/chưa hủy theo người phụ trách, kèm số quá hạn thực hiện và bị chặn. |
| DASH-07 | So sánh giờ ước tính với giờ đã ghi nhận theo nhiệm vụ; Owner/Manager xem toàn dự án, Member chỉ xem thời gian của mình trên nhiệm vụ được giao. Giờ đã ghi của người phụ trách cũ vẫn được giữ và không tính thành giờ cá nhân của người mới. |
| DASH-08 | Biểu đồ phải ghi rõ phạm vi dữ liệu, khoảng thời gian, đơn vị, chú giải và cách tính. Không có dữ liệu thì hiển thị Chưa có dữ liệu. Số nhiệm vụ hoặc số giờ không được tự diễn giải thành năng suất thành viên. |
| DASH-09 | Số liệu dựa trên dữ liệu nghiệp vụ và lịch sử đã lưu, không phụ thuộc trang nhiệm vụ đang được tải. Số hoàn thành trong mỗi kỳ đếm nhiệm vụ phân biệt, tránh cộng trùng do xử lý sự kiện lặp. |
| DASH-10 | Mở lại nhiệm vụ làm giảm số hoàn thành hiện tại; giữ lịch sử từng lần duyệt để biểu đồ theo kỳ có thể giải thích được. Dashboard không suy ra phần trăm hoàn thành từ giờ đã sử dụng. |
| DASH-11 | Nhấp chỉ số hoặc phần biểu đồ mở danh sách theo điều kiện tương ứng trong phạm vi quyền của người xem. Cập nhật realtime giữ nguyên phạm vi/khoảng thời gian đang chọn. |
| DASH-12 | Sắp đến hạn là nhiệm vụ Chưa bắt đầu/Đang thực hiện có deadline từ hôm nay đến hết 3 ngày tiếp theo theo múi giờ Việt Nam. Nhiệm vụ Chờ duyệt hiển thị riêng. |

## 18. Bình luận, phản hồi, lịch sử và tài liệu dự án

### 18.1. Bình luận và phản hồi nhiệm vụ

| Mã | Quy tắc |
|---|---|
| COMMENT-01 | Thành viên hiện tại được đọc bình luận trên nhiệm vụ mình có quyền xem và thêm bình luận trong dự án đang hoạt động. Nội dung tối đa 2.000 ký tự sau khi bỏ khoảng trắng đầu/cuối; được gửi văn bản, ảnh hoặc cả hai. Nếu không có ảnh, nội dung phải có ít nhất một ký tự; không chấp nhận bình luận trống. |
| COMMENT-02 | Người viết được sửa nội dung/thêm/bỏ ảnh và xóa bình luận hoặc phản hồi của mình. Owner/Manager được xóa bình luận/phản hồi trong dự án mình quản lý, không được sửa nội dung thay tác giả. Nội dung đã sửa hiển thị Đã chỉnh sửa. Xóa giữ vị trí với nhãn Bình luận đã bị xóa, ẩn nội dung/ảnh/nhắc tên và giữ các phản hồi còn lại; không được phản hồi mới vào bình luận đã xóa. |
| COMMENT-03 | Bình luận hiển thị tác giả và thời gian; phân biệt với lịch sử hoạt động do hệ thống tạo. Thành viên không được sửa lịch sử nghiệp vụ. |
| COMMENT-04 | Bình luận/phản hồi mới tạo thông báo trong ứng dụng cho người phụ trách và người tạo nhiệm vụ còn quyền xem. Tác giả bình luận được phản hồi và người được @nhắc tên nhận thêm email. Loại người vừa thao tác, hợp nhất người nhận theo ID và gộp các lý do thành một thông báo/một email cho cùng lần gửi; không gửi email cho người chỉ theo dõi do vai trò tạo/phụ trách nhiệm vụ. |
| COMMENT-05 | Dự án đã lưu trữ chỉ cho xem lại bình luận và lịch sử, không thêm/sửa/xóa bình luận. Người đã rời hoặc bị xóa khỏi dự án không còn quyền truy cập. |
| COMMENT-06 | Bình luận và lịch sử nằm trong trang chi tiết nhiệm vụ để người giao, người thực hiện và người duyệt theo dõi cùng ngữ cảnh. |
| COMMENT-07 | Mỗi bình luận hoặc phản hồi có tối đa 5 ảnh, mỗi ảnh tối đa 5 MiB (5 × 1.024 × 1.024 byte); chấp nhận PNG/JPG/JPEG có nội dung ảnh thực tế hợp lệ. Không nhận SVG, GIF, tệp thực thi hoặc tệp chỉ đổi đuôi thành ảnh. |
| COMMENT-08 | Chỉ hỗ trợ một cấp phản hồi: mỗi phản hồi thuộc một bình luận gốc trong cùng nhiệm vụ; không tạo cây lồng sâu. Khi trả lời một phản hồi, liên kết tới bình luận gốc và chỉ rõ người được trả lời bằng @thành viên nếu cần. Backend kiểm tra quan hệ nhiệm vụ/bình luận gốc. |
| COMMENT-09 | Hiển thị ảnh thu nhỏ, mở ảnh lớn và tải xuống có kiểm tra quyền. Luồng trao đổi có phân trang theo VIEW-06; hiển thị số phản hồi và tải phản hồi theo yêu cầu, giữ vị trí đọc khi cập nhật realtime. |
| COMMENT-10 | Gõ @ mở danh sách tìm theo tên thành viên còn quyền xem nhiệm vụ; hiển thị thông tin đủ phân biệt người trùng tên. Lưu liên kết theo user ID, không suy ra người nhận chỉ từ tên hoặc chuỗi văn bản. Tối đa 10 người khác nhau trong một bình luận/phản hồi; backend kiểm tra lại quyền tại thời điểm lưu. |
| COMMENT-11 | Sau khi lưu phản hồi thành công, thông báo cho tác giả bình luận gốc còn quyền xem. Trả lời một phản hồi bằng @ sẽ thông báo thêm cho người được nhắc tên. Người rời dự án không nhận nội dung nội bộ qua thông báo hoặc email; kiểm tra lại quyền trước khi gửi. |
| COMMENT-12 | Khi sửa bình luận/phản hồi, chỉ người được thêm @ mới được xem xét gửi thông báo/email; mỗi người chỉ nhận một lần thông báo nhắc tên cho cùng một bình luận/phản hồi trong toàn bộ lịch sử chỉnh sửa. Bỏ rồi thêm lại @ hoặc chỉ sửa nội dung không gửi lại. Dùng khóa chống trùng bền vững; không suy ra lịch sử gửi chỉ từ danh sách @ hiện tại. |
| COMMENT-13 | Các thao tác thêm/sửa/xóa và cập nhật ảnh, phản hồi, @ được đồng bộ theo RT-01. Bản sửa dùng version/điều kiện cập nhật để tránh ghi đè âm thầm; gửi lại cùng yêu cầu không tạo thêm bình luận, ảnh hoặc thông báo. |
| COMMENT-14 | Ảnh tải lên có trạng thái đang tải/thất bại/thử lại và có thể bỏ trước khi gửi. Chỉ công bố bình luận sau khi các ảnh đã chọn được lưu và kiểm tra thành công; lỗi tải giữ bản nhập tại giao diện, không tạo bình luận thiếu ảnh ngoài ý muốn. |
| COMMENT-15 | Ảnh thuộc một bình luận/phản hồi và một dự án xác định; không gắn ảnh của người khác hoặc dự án khác bằng cách thay ID. Dự án lưu trữ chỉ cho xem/tải theo quyền; không thêm/sửa/xóa hoặc nhắc tên mới. Xóa ảnh làm mất quyền tải ngay, kể cả qua URL đã biết. |

### 18.2. Tài liệu và liên kết dự án

| Mã | Quy tắc |
|---|---|
| FILE-01 | Mỗi dự án có khu vực Tài liệu & Liên kết riêng, cho phép thêm tệp hoặc liên kết phục vụ dự án. Mỗi mục có ID, loại mục, tên hiển thị 1–150 ký tự, mô tả tùy chọn tối đa 500 ký tự, người thêm và thời điểm thêm/cập nhật. Tệp có thêm tên gốc, định dạng và dung lượng. |
| FILE-02 | Thành viên hiện tại được xem/tải và thêm mục trong dự án đang hoạt động. Người thêm được sửa/xóa mục của mình; Owner/Manager được sửa thông tin hoặc xóa mọi mục của dự án, kể cả mục của người đã rời. Không thay người thêm hoặc chuyển mục sang dự án khác. Thay nội dung tệp thực hiện bằng xóa mục cũ và thêm mục mới; chưa hỗ trợ lịch sử phiên bản tệp. |
| FILE-03 | Mỗi tệp tối đa 20 MiB (20 × 1.024 × 1.024 byte). Cho phép PDF, DOCX, XLSX, PPTX, TXT, CSV, ZIP, PNG, JPG, JPEG; kiểm tra đuôi, loại nội dung và cấu trúc thực tế phù hợp. Không nhận tệp Office có macro, HTML, SVG, tệp thực thi hoặc script. ZIP chỉ được tải xuống, không giải nén hoặc thực thi tại máy chủ. |
| FILE-04 | Tổng dung lượng ảnh bình luận/phản hồi và tệp tài liệu tối đa 500 MiB/dự án; không tính avatar, metadata hoặc liên kết. Kiểm tra và giữ chỗ dung lượng nguyên tử khi tải đồng thời, không để vượt giới hạn bằng nhiều yêu cầu song song. Hiển thị đã dùng/còn lại; vượt giới hạn bị từ chối nhưng vẫn được xem, tải và xóa dữ liệu hiện có. |
| FILE-05 | Liên kết dài tối đa 2.048 ký tự, là URL tuyệt đối dùng http hoặc https và không chứa thông tin đăng nhập trong URL. Không nhận javascript:, data:, file: hoặc giao thức khác. Hiển thị tên và hostname đích, mở tab mới bằng rel=noopener noreferrer. Backend không tự truy cập, tạo bản xem trước hoặc tải nội dung từ liên kết. |
| FILE-06 | Danh sách hỗ trợ tìm theo tên, lọc Tất cả/Tệp/Liên kết, phân trang theo VIEW-06 và sắp xếp mới nhất mặc định. Tệp trùng tên được phép, được phân biệt bằng người thêm/thời gian/ID. Link truy cập bên ngoài vẫn chịu quyền của dịch vụ đích; lưu link không cấp quyền vào Figma/GitHub hoặc dịch vụ đó. |
| FILE-07 | Backend kiểm tra tư cách thành viên và trạng thái dự án khi tải lên, xác nhận gắn tệp, sửa, xóa, xem hoặc tải xuống. Không dùng URL công khai cố định. Người rời/bị xóa khỏi dự án mất quyền tải ngay; email, realtime và log không chứa đường dẫn bỏ qua xác thực. Tệp đã tải về thiết bị không thể thu hồi từ xa. |
| FILE-08 | Phiên bản đầu lưu ảnh bình luận và tệp dự án trong vùng lưu trữ riêng do Work Service quản lý, gắn Docker volume bền vững; lưu metadata/tham chiếu trong database của service. Frontend truy cập qua Gateway và endpoint kiểm tra quyền, không mở thư mục lưu trữ công khai. Chưa bổ sung dịch vụ lưu trữ hay microservice mới; sao lưu/khôi phục đồng bộ database với volume tệp. |
| FILE-09 | Sinh khóa lưu trữ ngẫu nhiên tại backend, không dùng tên tệp người dùng làm đường dẫn và không cho phép duyệt đường dẫn. Tệp được trả với Content-Type đúng, X-Content-Type-Options: nosniff; tệp tài liệu tải xuống bằng Content-Disposition: attachment. Ảnh bình luận chỉ xem nội tuyến sau khi được xác thực và kiểm tra hợp lệ. |
| FILE-10 | Tệp đang tải chưa được công bố cho dự án. Lỗi giữa lưu tệp và lưu metadata phải hoàn tác hoặc được đối soát/dọn dẹp; tệp tạm không được xác nhận sau 24 giờ được xóa và hoàn lại dung lượng giữ chỗ. Thử lại cùng yêu cầu không tạo thêm mục hoặc tính dung lượng hai lần. |
| FILE-11 | Xóa là ẩn mục và chặn tải ngay, giải phóng dung lượng đúng một lần; tệp vật lý được dọn trong tối đa 24 giờ và có thử lại nếu lỗi. Không xóa tệp còn được mục hợp lệ khác tham chiếu. Lưu log metadata tối thiểu gồm ID/tên mục, người thao tác, thời điểm và loại thao tác; không giữ nội dung tệp trong log. |
| FILE-12 | Thêm/sửa/xóa tài liệu hoặc liên kết cập nhật realtime danh sách và dung lượng trong phạm vi dự án. Các thao tác này ghi lịch sử hoạt động; không mặc định phát email hoặc thông báo tới toàn bộ thành viên. |
| FILE-13 | Dự án đã lưu trữ chỉ được xem danh sách, mở link hoặc tải tệp theo quyền; không thêm/sửa/xóa tài liệu/liên kết. Owner mở lại dự án trước khi thay đổi. |
| FILE-14 | Tệp tùy ý chỉ được đính kèm ở cấp dự án; bình luận/phản hồi nhiệm vụ chỉ nhận ảnh theo COMMENT-07. Người dùng có thể dán liên kết tài liệu dự án vào nội dung bình luận; khi mở vẫn phải kiểm tra quyền của tài liệu đích, không sao chép hoặc công khai quyền của tệp. |

## 19. Các quyết định và tham số đã chốt

Các tham số nền tảng được xác nhận ngày 22/10/2026; phạm vi bình luận, phản hồi, nhắc tên và tài liệu dự án được bổ sung ngày 28/10/2026 theo yêu cầu của người dùng:

| STT | Nội dung | Giá trị hoặc hành vi đã chốt |
|---|---|---|
| 1 | Họ tên | 2–100 ký tự; bỏ khoảng trắng đầu/cuối, hỗ trợ tiếng Việt. |
| 2 | Xác nhận email | Link 24 giờ, dùng một lần; gửi lại sau 60 giây, tối đa 5 lần/giờ/tài khoản; link mới vô hiệu hóa link cũ. |
| 3 | Lời mời trực tiếp | Hiệu lực 7 ngày; hết hạn phải gửi lời mời mới. |
| 4 | Link/QR chung | Không tự hết hạn; có thể tắt/tạo lại; không hủy yêu cầu đã gửi khi tắt/thay link. |
| 5 | Gửi lại sau khi bị từ chối | Chờ 24 giờ theo người dùng và dự án; đổi link không bỏ qua; lời mời trực tiếp mới vẫn được chấp nhận ngay. |
| 6 | Tự duyệt của quản lý | Owner/Manager được duyệt nhiệm vụ của chính mình; ghi nhận người nộp/người duyệt. Member không được tự duyệt. |
| 7 | Điều chỉnh giờ | Không sửa giờ trên nhiệm vụ Đã hủy hoặc dự án Đã lưu trữ. Mở lại dự án trước khi sửa; nhiệm vụ Đã hủy giữ nguyên lịch sử. |
| 8 | Realtime và cảnh báo | Cập nhật trong 2 giây, cảnh báo theo thời gian trong 60 giây khi kết nối ổn định; môi trường/tải kiểm thử xác định ở bước kỹ thuật. |
| 9 | Sắp đến hạn | Deadline từ hôm nay đến hết 3 ngày tiếp theo, chỉ Chưa bắt đầu/Đang thực hiện. |
| 10 | Lịch dự án | Bắt buộc ngày bắt đầu/kết thúc dự kiến; cho phép bắt đầu trong quá khứ. |
| 11 | Lý do tham gia | Không bắt buộc, tối đa 500 ký tự. |
| 12 | Bình luận và phân trang | Văn bản tối đa 2.000 ký tự; phải có nội dung hoặc ảnh. Tối đa 5 ảnh × 5 MiB, phản hồi một cấp, tối đa 10 người được @; trang mặc định 20, lựa chọn 10/20/50. |
| 13 | Tài liệu dự án (bổ sung 28/10/2026) | Thành viên được thêm tệp/link; quản lý mục theo FILE-02. Tệp tối đa 20 MiB; tổng ảnh bình luận và tệp dự án tối đa 500 MiB. |

## 20. Ranh giới của bước hiện tại

Trong phạm vi phiên bản đầu: quản lý dự án/thành viên/nhiệm vụ, lịch dự kiến, Danh sách/Kanban, dashboard và các biểu đồ ở mục 17, chế độ Sáng/Tối/Theo hệ thống, tìm kiếm/lọc/sắp xếp/phân trang, bình luận có ảnh/phản hồi/@thành viên/lịch sử, tài liệu và liên kết dự án, ghi giờ, cảnh báo, realtime, xác nhận email, thông báo và hai luồng tham gia dự án.

Tệp tùy ý trong bình luận nhiệm vụ, lịch sử phiên bản tệp, Gantt, phụ thuộc nhiệm vụ, công việc lặp và quản lý ngân sách chưa thuộc phạm vi bắt buộc bốn tuần. Ảnh bình luận/phản hồi và tệp/liên kết dự án thuộc phiên bản đầu theo cập nhật ngày 28/10/2026.

Đã chốt JWT và các yêu cầu bảo mật tại mục 21; stack, microservice và công cụ tại mục 22. Brevo, TypeScript, tính năng tài khoản/ảnh và mốc bắt đầu đã chốt; ranh giới dịch vụ, bộ công cụ bổ sung và các cấu hình còn thiếu được đề xuất riêng tại TECH_PROPOSAL.md và mục 22.3. Khi thay đổi nghiệp vụ, cập nhật tài liệu này và kiểm tra lại các rule liên quan trước khi triển khai.

## 21. Bảo mật JWT API và vận hành

Nhóm rule này được người dùng chốt ngày 22/10/2026. Các rule nghiệp vụ trước đó giữ nguyên. Để tránh trùng mã, nhóm xác nhận email trước đây AUTH-01–AUTH-05 đổi tên thành VERIFY-01–VERIFY-05, không đổi nội dung. AUTH-01–AUTH-08 dưới đây là nhóm JWT. Lưu lựa chọn theme trong trình duyệt không thuộc lệnh cấm lưu token trong localStorage.

### 21.1. Đăng nhập và quản lý JWT

| Mã | Rule |
|---|---|
| AUTH-01 | Đăng nhập thành công cấp Access Token để truy cập API và Refresh Token để gia hạn đăng nhập. Tài khoản chưa xác nhận email vẫn bị giới hạn theo VERIFY-02. |
| AUTH-02 | Access Token có hạn 15 phút; phiên đăng nhập có hạn tuyệt đối 7 ngày tính từ lúc đăng nhập. Refresh Token được rotation nhưng không gia hạn vượt mốc này; Access Token mới không được có hiệu lực sau mốc hết phiên. Hết 7 ngày phải đăng nhập lại. Không tự thêm thời hạn không hoạt động ngắn hơn khi chưa chốt. |
| AUTH-03 | Backend kiểm tra chữ ký, thuật toán được cho phép, thời hạn, bên phát hành và đối tượng nhận của Access Token trước khi xử lý yêu cầu. |
| AUTH-04 | Access Token chỉ giữ trong bộ nhớ ứng dụng; Refresh Token lưu trong cookie HttpOnly, Secure, SameSite phù hợp. Không lưu token trong localStorage. Cookie và CSRF phải được cấu hình theo mô hình tên miền triển khai. |
| AUTH-05 | Refresh Token được thay mới sau mỗi lần sử dụng; token cũ mất hiệu lực. Phát hiện dùng lại token cũ thì thu hồi chuỗi phiên liên quan và yêu cầu đăng nhập lại. |
| AUTH-06 | Backend lưu thông tin phiên và bản băm Refresh Token phục vụ thu hồi; không lưu Refresh Token nguyên dạng. |
| AUTH-07 | Đăng xuất thu hồi phiên tương ứng, xóa cookie và đóng kết nối realtime của phiên đó. Access Token thuộc phiên đã thu hồi không được tiếp tục truy cập API; backend phải kiểm tra trạng thái thu hồi bên cạnh xác thực JWT. |
| AUTH-08 | JWT không chứa mật khẩu hoặc dữ liệu nhạy cảm. JWT có chữ ký không đồng nghĩa nội dung đã được mã hóa. |
| AUTH-09 | Cho phép một tài khoản đăng nhập trên nhiều thiết bị; mỗi lần đăng nhập tạo phiên riêng. Đăng xuất một phiên không tự thu hồi phiên khác. |
| AUTH-10 | Người dùng xem danh sách phiên đăng nhập của mình và thu hồi từng phiên, gồm nhận biết phiên hiện tại. Không xem/thu hồi phiên của người khác; mọi thao tác thu hồi có hiệu lực theo AUTH-07. |
| AUTH-11 | Có chức năng đăng xuất tất cả thiết bị: thu hồi toàn bộ phiên của tài khoản, kết thúc quyền API/realtime tương ứng và yêu cầu đăng nhập lại. Không tự dừng ghi giờ theo TIME-11. |

Chỉ xóa token phía trình duyệt không đáp ứng AUTH-07. Đăng xuất phải được xác nhận bằng thao tác thu hồi phía máy chủ; khi mất mạng, giao diện không báo đã thu hồi thành công nếu máy chủ chưa xác nhận. Phiên ghi giờ và phiên đăng nhập là hai thực thể độc lập theo TIME-11.

### 21.2. Phân quyền bảo vệ API dữ liệu và vận hành

| Mã | Rule |
|---|---|
| SEC-01 | Các API nghiệp vụ yêu cầu Access Token hợp lệ, trừ danh sách API công khai được xác định rõ, như đăng ký và đăng nhập. Các luồng xác nhận email, refresh và trang mời công khai chỉ cung cấp hành vi/dữ liệu tối thiểu theo thiết kế được duyệt. |
| SEC-02 | Backend kiểm tra vai trò và tư cách thành viên hiện tại trên từng dự án, nhiệm vụ và thao tác; không chỉ dựa vào vai trò ghi trong JWT. |
| SEC-03 | Thay ID trong yêu cầu không được giúp truy cập dữ liệu của người khác hoặc dự án không được phép. |
| SEC-04 | Backend chỉ nhận các trường được phép cập nhật; người dùng không thể tự đổi Owner, vai trò, người tạo hoặc tổng giờ làm bằng cách gửi thêm trường. |
| SEC-05 | Kiểm tra dữ liệu đầu vào tại backend, truy vấn dữ liệu an toàn và hiển thị nội dung người dùng nhập dưới dạng không thực thi mã. |
| SEC-06 | Giới hạn tần suất đăng nhập, làm mới token và các API nhạy cảm. Thông báo đăng nhập thất bại không tiết lộ email có tồn tại hay không. Ngưỡng cụ thể được chốt trong cấu hình bảo mật. |
| SEC-07 | Các endpoint sử dụng cookie, đặc biệt refresh và đăng xuất, phải được bảo vệ chống CSRF. Chỉ cho phép các nguồn frontend đã cấu hình truy cập. |
| SEC-08 | Mật khẩu được băm bằng thuật toán chuyên dụng; không lưu hoặc trả mật khẩu nguyên dạng. |
| SEC-09 | Khi triển khai, API dùng HTTPS; kết nối WebSocket nếu sử dụng phải dùng WSS. |
| SEC-10 | Khóa ký JWT, mật khẩu cơ sở dữ liệu và khóa API được quản lý ngoài mã nguồn; không commit vào Git hoặc đưa vào frontend. |
| SEC-11 | Log không chứa mật khẩu, token hoặc khóa bí mật. Lỗi trả về không làm lộ thông tin nội bộ máy chủ. |
| SEC-12 | Ảnh/tệp tải lên phải được kiểm tra quyền, loại tệp, nội dung và dung lượng tại backend, kể cả yêu cầu gửi trực tiếp không qua giao diện. Áp dụng cho avatar, ảnh bình luận/phản hồi và tài liệu dự án; giới hạn và lưu trữ theo COMMENT-07–COMMENT-15, FILE-01–FILE-14. Kiểm tra quyền lại khi tải xuống; không ghi token hoặc nội dung tệp vào log. |
| SEC-13 | Có sao lưu dữ liệu và kiểm tra khôi phục trước khi bàn giao. Tần suất, nơi lưu, thời gian lưu và mục tiêu khôi phục phải được chốt trong kế hoạch vận hành. |

### 21.3. Bảo mật realtime

| Mã | Rule |
|---|---|
| RT-SEC-01 | Kết nối realtime phải xác thực thành công trước khi nhận dữ liệu được bảo vệ; không đưa token vào URL. |
| RT-SEC-02 | Backend kiểm tra nguồn kết nối và quyền tham gia từng kênh dự án; kết nối thành công không đồng nghĩa được xem mọi dự án. |
| RT-SEC-03 | Khi Access Token hết hạn, phải xác thực lại bằng token mới hoặc đóng kết nối; không tiếp tục gửi dữ liệu bằng token hết hạn. |
| RT-SEC-04 | Khi đổi vai trò hoặc xóa thành viên, quyền thao tác và nhận dữ liệu được cập nhật ngay trên các kết nối đang mở. |
| RT-SEC-05 | Giới hạn kích thước và tần suất thông điệp realtime; dữ liệu nhận qua realtime cũng phải được kiểm tra tại backend. Ngưỡng cụ thể chờ cấu hình bảo mật. |

## 22. Công nghệ công cụ và quyết định còn mở

### 22.1. Các lựa chọn đã chốt

Chỉ lựa chọn được người dùng trực tiếp xác nhận được coi là đã chốt. Tài liệu mẫu chỉ tham khảo rule. Bộ công cụ và kiến trúc chi tiết do trợ lý đề xuất được tách tại TECH_PROPOSAL.md, chưa trở thành yêu cầu bắt buộc nếu chưa được duyệt.

| Mã | Quy tắc |
|---|---|
| TECH-01 | Backend dùng Java Spring Boot, cung cấp REST API. Phiên bản JDK/Spring Boot và công cụ build được đề xuất theo tính tương thích, cần chốt trước khởi tạo. |
| TECH-02 | Dữ liệu nghiệp vụ dùng MySQL. Phiên bản, sở hữu dữ liệu giữa service và migration được đề xuất riêng. |
| TECH-03 | Frontend dùng ReactJS, TypeScript và Tailwind CSS, tuân các rule giao diện/theme đã chốt. |
| TECH-04 | Frontend có quản lý state và tích hợp API; không mặc định Axios hoặc một thư viện state từ tài liệu mẫu. Token tuân AUTH-04. Công cụ bổ sung phải phù hợp nhu cầu rồi được xác nhận. |
| TECH-05 | Kiến trúc gồm ba service nghiệp vụ Identity, Work Management, Notification và ba ứng dụng hạ tầng API Gateway, Eureka Discovery, Config Server. Các ứng dụng chạy/triển khai độc lập, có hợp đồng API/sự kiện rõ ràng; RabbitMQ chuyển sự kiện giữa các service. |
| TECH-06 | Dùng Docker và Docker Compose; cấu hình không chứa bí mật thật và dữ liệu bền vững qua khởi động lại. |
| TECH-07 | Có CI/CD và SSH để triển khai trên hạ tầng/domain hiện có, ưu tiên tiết kiệm. Chưa chốt nền tảng pipeline, OS, proxy, registry hoặc trigger CD. |
| TECH-08 | Dùng monorepo tại https://github.com/KHANHAN007/TaskNest---OJT4, tách frontend/, platform/ (gateway/discovery/config), services/ (ba service nghiệp vụ), infra/ và docs/. Mỗi ứng dụng có build/cấu hình/kiểm thử riêng. Không tự đổi quyền repository. |
| TECH-09 | Dịch vụ email dùng Brevo cho xác minh tài khoản, đặt lại mật khẩu, lời mời và các email theo rule thông báo. Giao thức SMTP/API, sender/domain và retry còn cần cấu hình. Bình luận thông thường chỉ thông báo trong ứng dụng; phản hồi và @thành viên gửi thêm email theo COMMENT-04, COMMENT-11 và COMMENT-12. |

| TECH-10 | API Gateway dùng Spring Cloud Gateway làm điểm vào API và WebSocket từ frontend. Route allowlist tới service; xử lý JWT, CORS, giới hạn request và chuyển tiếp an toàn. Service vẫn xác thực và kiểm tra quyền nghiệp vụ; không tin header danh tính do client tự gửi. |
| TECH-11 | Eureka Discovery quản lý đăng ký/tìm service. Gateway và client nội bộ dùng service ID qua load balancer. Endpoint quản trị/discovery và cổng service không được công khai cho trình duyệt truy cập trực tiếp. |
| TECH-12 | Spring Cloud Config quản lý cấu hình theo môi trường có phiên bản. Secrets thật ở ngoài Git; bootstrap không tạo phụ thuộc vòng Config/Eureka. Thiếu cấu hình bắt buộc không được báo ready giả. |
| TECH-13 | RabbitMQ chuyển sự kiện từ outbox sau giao dịch nghiệp vụ. Có lưu bền vững, publisher confirm, consumer ACK sau lưu thành công, idempotency theo eventId, retry hữu hạn và dead-letter queue; redelivery không tạo trùng nghiệp vụ/thông báo. |
| TECH-14 | Gọi đồng bộ nội bộ qua HTTP Service Clients và Spring Cloud LoadBalancer, có timeout/circuit breaker Resilience4j. Gateway dùng HTTP client không blocking. Lỗi kiểm tra phiên/quyền phải từ chối truy cập, không fallback cấp quyền hoặc retry thao tác ghi thiếu idempotency. |
| TECH-15 | Có health/readiness, metrics qua Actuator/Micrometer và correlation ID để truy vết qua Gateway/service/sự kiện. Endpoint vận hành chỉ cấp quyền nội bộ; log tuân SEC-11. |
| TECH-16 | Mỗi service nghiệp vụ sở hữu database và tài khoản riêng trong MySQL; không truy vấn/join trực tiếp dữ liệu của service khác. Bất biến project/task/member/time được xử lý trong Work Service; tham chiếu liên dịch vụ xác minh qua hợp đồng. |

### 22.2. Tổ chức và kế hoạch đã xác nhận

- Nhóm 4 người giữ nguyên tên/năng lực tại SRS. Thành viên tự sắp thời gian để hoàn thành task; chưa áp giờ/ngày hoặc năng suất giả định.
- Bắt đầu 19/10/2026, thời lượng 4 tuần; mốc cuối suy ra là hết 15/11/2026. Lịch tuần, người phụ trách và thứ tự thực hiện trong bảng task là đề xuất, không phải tiến độ đã hoàn thành.
- Người dùng có Figma và Jira như mục 1; yêu cầu bảng task cục bộ để tự thêm Jira. Không tự tạo task hoặc gửi thông báo tới thành viên.

### 22.3. Nội dung chờ duyệt phương án kỹ thuật

Kiến trúc monorepo với Gateway, Discovery, Config, ba service nghiệp vụ, RabbitMQ, giao tiếp có resilience và quan sát hệ thống đã được người dùng xác nhận. TECH_PROPOSAL.md ghi chi tiết kiến trúc; phiên bản nền tảng, build/migration, thư viện frontend, cấu hình bảo mật, Git/review/CI/CD, tải kiểm thử và thông số vận hành vẫn phân biệt rõ đề xuất chưa duyệt. Không sao chép stack từ mẫu.

Các cấu hình bảo mật còn cần duyệt gồm thuật toán JWT/băm, issuer/audience, xử lý đổi/reset mật khẩu, giới hạn gửi/reset/rate limit, cookie/CSRF/origin, payload realtime và tải ảnh. Các yêu cầu AUTH/SEC/RT-SEC đã chốt vẫn bắt buộc.

Cần thông tin vận hành khi chuẩn bị triển khai: domain cụ thể, hệ điều hành/tài nguyên máy chủ, địa chỉ sender Brevo và quyền tài khoản GitHub/registry. Không yêu cầu cung cấp mật khẩu hoặc khóa bí mật trong hội thoại. Không cần chốt thêm giờ làm cá nhân để xây dựng bảng task.

## 23. Nền tảng AI — chặng 1

| Mã | Quy tắc |
| --- | --- |
| AI-01 | AI được cung cấp bởi `ai-service` qua API Gateway. Chặng 1 dùng Groq với `openai/gpt-oss-120b`; khóa chỉ lưu ở backend, không tự chuyển sang dịch vụ trả phí. |
| AI-02 | Gateway và AI Service kiểm tra phiên Identity hiện tại; phiên hết hạn/thu hồi và tài khoản chưa xác minh email không được gọi AI. ID người dùng lấy từ phiên, không nhận quyền do client tự khai. |
| AI-03 | AI đọc các trường trạng thái, lịch, ước tính và giờ được phép xem của một nhiệm vụ do người dùng chọn qua API Work bằng phiên hiện tại. Không có công cụ thực thi. Không gửi mô tả, bình luận, tệp, khóa, token, mật khẩu, bản băm hoặc thông tin phiên đến model. |
| AI-04 | Giới hạn 20 lượt/người/ngày, 100 lượt/hệ thống/ngày; thêm giới hạn phút/token. Bộ đếm bền vững và cập nhật nguyên tử. Các hạn mức áp dụng đồng thời; lỗi đã gửi provider vẫn tính lượt. |
| AI-05 | AI không sẵn sàng không ngăn hoạt động nghiệp vụ. Lỗi API không chứa thông tin bí mật hoặc nội dung lỗi thô của provider; không tự retry lời gọi Groq. |
| AI-06 | Không lưu prompt hoặc câu trả lời trong chặng 1; chỉ lưu counter sử dụng. Bật Zero Data Retention ở Groq trước khi dùng dữ liệu thật. |
| AI-07 | Nội dung AI là gợi ý; không được tuyên bố đã đọc dữ liệu hoặc thực hiện thao tác khi hệ thống chưa cung cấp khả năng đó. |
| AI-08 | Dashboard AI tự phân tích khi mở trang, khi dữ liệu nghiệp vụ thay đổi và kiểm tra lại mỗi 5 phút khi trang đang hiển thị; không cần nút kích hoạt, tách việc cá nhân/chờ duyệt của bản thân với việc cần duyệt của người khác theo vai trò hiện tại. Số liệu do backend tính; tối đa 3 nhiệm vụ tiêu biểu được gửi model. |
| AI-09 | Kết quả dashboard được cache trong bộ nhớ tối đa 5 phút theo tài khoản và snapshot. Luôn đọc lại quyền và dữ liệu trước khi dùng cache; không chia sẻ giữa người dùng. Không có việc phù hợp thì không gọi model; lỗi không tự retry. |

Hướng dẫn cấu hình, giới hạn và phạm vi kiểm thử: `docs/ai/GROQ_SETUP.md`.

### Ưu tiên và rủi ro nhiệm vụ
- Work-service tính điểm ưu tiên có thể giải thích từ deadline theo giờ Việt Nam, mức ưu tiên, cờ chặn và thời gian được phép xem. Điểm là thứ tự cần chú ý, không phải xác suất trễ hạn hay đánh giá năng suất.
- Dashboard dùng điểm để sắp xếp công việc cá nhân trong các dự án đang hoạt động; cùng điểm xét deadline rồi ID. Không đưa nhiệm vụ đã hoàn thành hoặc hủy vào danh sách cảnh báo.
- Nhiệm vụ chờ duyệt sau deadline được phân biệt với quá hạn thực hiện. Không tính giờ đã ghi thành tỷ lệ hoàn thành hoặc tự suy ra giờ còn lại.
- Thuật toán hoạt động độc lập với nhà cung cấp AI. Gợi ý AI không ghi đè quyền, trạng thái hoặc điểm nghiệp vụ.

# Yêu cầu dự án và đề xuất của đội

## Luồng sử dụng

1. Mở **Tìm dự án** ở `/requests`.
2. Khách hàng tạo yêu cầu với mục tiêu, phạm vi, kỹ năng, ngân sách VND, ngày mong muốn bàn giao và liên kết tham khảo.
3. Khách hàng có thể lưu nháp, đăng công khai, tạm dừng hoặc đóng yêu cầu. Bản nháp chỉ khách hàng xem được.
4. Chủ đội đang nhận việc chọn đội mình đại diện và gửi đề xuất với chi phí, ngày bắt đầu, ngày bàn giao và kế hoạch thực hiện.
5. Khách hàng xem và so sánh đề xuất. Nội dung, chi phí và kế hoạch chỉ được khách hàng và chủ đội gửi đề xuất xem.
6. Khách hàng xem lại đề xuất rồi chọn **Chọn đội & tạo dự án**.
7. Hệ thống tạo dự án thực tế. Chủ đội là Owner, khách hàng và các thành viên của đội tham gia dự án. Quan hệ đội–khách hàng được xác nhận để dùng tiếp luồng nghiệm thu và đánh giá.
8. Các bên mở dự án để chia nhiệm vụ, làm việc, bàn giao và nghiệm thu.

## Trạng thái và tính nhất quán

- Một đội có một đề xuất cho mỗi yêu cầu, có thể chỉnh sửa hoặc rút khi yêu cầu đang mở.
- Khi khách hàng sửa yêu cầu, các đề xuất cũ phải được đội gửi lại theo phiên bản mới.
- Đề xuất được chọn được giữ nguyên cùng yêu cầu. Các đề xuất đang chờ của đội khác chuyển sang trạng thái đã chọn đội khác.
- Gửi lại thao tác chọn cùng đội trả về dự án đã tạo. Các thao tác đồng thời được tuần tự hóa theo yêu cầu và chỉ có một dự án được tạo.
- Tạo dự án, thêm thành viên, khởi tạo dung lượng, liên kết khách hàng, cập nhật đề xuất và thông báo là một giao dịch. Nếu một bước thất bại, toàn bộ giao dịch được rollback.
- Chủ đội không thể gửi đề xuất cho yêu cầu của một thành viên trong chính đội mình.
- Chi phí là nội dung đề xuất để hai bên thỏa thuận. Bản này chưa xử lý thanh toán.
- Lịch và kế hoạch bàn giao được lưu trong đề xuất. Đội tạo nhiệm vụ chi tiết trong không gian dự án.

## Dữ liệu và kiểm tra

Migration `V11__customer_requests_and_team_proposals.sql` thêm hai bảng trong Work database.

API công khai là `GET /api/work/community/requests` và `GET /api/work/community/requests/{id}`. API bản nháp và đề xuất kiểm tra phiên đăng nhập thật.

Kiểm thử dùng MySQL tách biệt và đi qua Gateway.

```sh
./mvnw -pl services/work-service,platform/api-gateway -am package
python3 scripts/test-community.py
```

Các trường hợp kiểm tra gồm riêng tư bản nháp, đề xuất giữa hai đội, phiên bản yêu cầu, rút đề xuất, gửi lại lựa chọn đồng thời, quyền thành viên dự án mới và rollback khi khởi tạo dự án thất bại.

## Mốc bàn giao và nghiệm thu

Trong dự án đã liên kết khách hàng với đội, mở tab **Mốc bàn giao** (`?tab=milestones`).

1. Owner/Manager phía đội đề xuất tên mốc, ngày bàn giao, từng tiêu chí nghiệm thu và các nhiệm vụ liên kết thuộc dự án.
2. Khách hàng xác nhận kế hoạch. Sau xác nhận, tiêu chí và danh sách nhiệm vụ được giữ nguyên theo thỏa thuận.
3. Khi các nhiệm vụ liên kết đã hoàn thành hoặc hủy, đội gửi mô tả kết quả và liên kết bàn giao.
4. Khách hàng đánh dấu từng tiêu chí để chấp nhận, hoặc ghi rõ yêu cầu chỉnh sửa. Đội có thể nộp lại sau phản hồi.
5. Lịch sử giữ riêng từng lần nộp, người gửi, thời điểm, kết quả và phản hồi nghiệm thu. Các lần đã phản hồi không bị ghi đè.
6. Nghiệm thu toàn dự án chỉ được thực hiện khi mọi mốc đã được chấp nhận hoặc hủy. Các điều kiện hoàn thành nhiệm vụ hiện có vẫn áp dụng.

Đội có thể hủy kế hoạch chưa xác nhận; sau xác nhận, khách hàng quyết định hủy mốc và phải ghi lý do. Không hủy mốc đang chờ nghiệm thu hoặc đã được chấp nhận. Các thao tác ghi được kiểm tra quyền, phiên bản và trạng thái dự án; gửi lại cùng mã thao tác không tạo thêm mốc hoặc lần nộp. Thông báo được lưu vào outbox cùng giao dịch, không gửi email cho các thao tác này.

Migration `V12__milestone_delivery_and_customer_acceptance.sql` bổ sung ba bảng. API nằm dưới `/api/work/projects/{project}/milestones`, chỉ thành viên dự án được đọc; chỉ khách hàng được chỉ định trong quan hệ hợp tác được xác nhận kế hoạch và nghiệm thu. Dự án chưa liên kết khách hàng không mở thao tác bàn giao.

Kiểm thử `scripts/test-community.py` chạy MySQL riêng để kiểm tra quyền khách hàng/thành viên, liên kết nhiệm vụ cùng dự án, giữ nguyên kế hoạch đã xác nhận, gửi lại thao tác, yêu cầu sửa, lưu lịch sử và chặn nghiệm thu toàn dự án khi còn mốc chưa xử lý.


## Củng cố quyền và dữ liệu cộng tác — đợt 1

- `CUSTOMER` được suy ra từ quan hệ đội–khách hàng của từng dự án, không từ lựa chọn nhu cầu của tài khoản. Một người vẫn làm dev ở dự án khác. Khách hàng có màn hình tổng quan theo dõi tiến độ, bàn giao và nghiệm thu.
- Khách hàng không tạo/nhận task phát triển, đổi trạng thái task, sửa checklist/nhãn hoặc ghi giờ mới. Họ vẫn trao đổi, cung cấp tài liệu của mình và xử lý nghiệm thu đúng quyền. Quản lý không được xoá hoặc đổi vai trò của khách hàng qua API quản lý thành viên.
- Hợp tác ACTIVE/COMPLETED tiếp tục là căn cứ đọc dự án và đánh giá sau nghiệm thu, ngay cả khi membership cũ bị xoá. Quan hệ PROPOSED chưa được xác nhận không tự cấp quyền ngoài membership. Khách hàng không được nâng quyền quản lý dù có trường manager cũ.
- Flyway V19 tạo `task_organization`, lưu checklist và nhãn trên Work database. API `GET/PUT /api/work/projects/{project}/tasks/{task}/organization` kiểm tra task thuộc dự án, quyền người phụ trách/quản lý, trạng thái lưu trữ và version. Tối đa 100 bước, mỗi tiêu đề 200 ký tự; nhãn giới hạn theo danh mục. Timestamp do server tạo; phiên bản cũ trả 409.
- Giao diện checklist, nhãn, Kanban và bộ lọc Công việc của tôi sử dụng dữ liệu API chung. Không tự nhập checklist/nhãn localStorage cũ vì dữ liệu đó không ghi nhận được chủ tài khoản. Không xoá dữ liệu local cũ; ghim ưu tiên vẫn là tuỳ chọn cá nhân theo tài khoản trên trình duyệt.
- Matching lấy mặc định từ hồ sơ nghề nghiệp. Không tự gán kỹ năng hoặc giờ rảnh; tiêu chí tìm kiếm người dùng chỉnh riêng được lưu theo tài khoản. Alias kỹ năng được kiểm soát, Java không khớp JavaScript theo chuỗi con. Chưa có kỹ năng thì chưa đưa điểm phù hợp.

Đợt này chưa thay luồng chọn roster, trung tâm hợp tác, lịch sử phạm vi hay xếp hạng backend trước phân trang; các phần đó thuộc các đợt tiếp theo. Khi phát hành cần cập nhật cả frontend và Work service; V19 chỉ thêm bảng, không sửa/xoá dữ liệu dự án hiện tại.

### Kết nối hợp tác và khởi động dự án

- `Hợp tác của tôi` tổng hợp yêu cầu của khách hàng, đề xuất của các đội do người dùng quản lý và các dự án người dùng được phép truy cập; các đề xuất không được chọn không dẫn tới dự án của đội thắng.
- Chấp nhận đề xuất chỉ thêm chủ đội và khách hàng. Chủ đội xác nhận nhân sự thực hiện trước khi bắt đầu thao tác phát triển; thành viên đội không tự động có quyền xem dự án.
- Bản thỏa thuận lưu phạm vi, phiên bản yêu cầu, đề xuất, thời gian và chi phí tại thời điểm chọn đội. Chi phí và lịch sử trao đổi riêng chỉ dành cho chủ đội và khách hàng; phòng dự án có quyền theo thành viên dự án.
- Lịch sử phiên bản giữ các nội dung đã gửi, không đưa bản nháp yêu cầu cho đội. Có thể tạo một mốc bàn giao **DRAFT** từ kế hoạch đã chốt; không tự xác nhận kế hoạch hoặc nghiệm thu.
- V20 bổ sung thỏa thuận và lịch sử. Dự án đã hoạt động trước nâng cấp được giữ trạng thái đã khởi động; lịch sử cũ chưa lưu không được dựng lại thành các lần chỉnh sửa giả.
- Kiểm chứng: Work service 123 kiểm thử; frontend 274 kiểm thử, lint/build; integration Gateway/Work/MySQL riêng cho quyền, chọn nhân sự, phiên bản, bản nháp mốc và trung tâm hợp tác; browser kiểm tra luồng khởi động và bố cục 390px.

### Tìm cơ hội và giữ ghi nhận đóng góp

- Tin tuyển dụng được lọc, tính độ phù hợp, sắp thứ tự rồi mới phân trang trong MySQL. Điểm dùng alias kỹ năng chính xác như giao diện; thiếu kỹ năng thì điểm chưa xác định, thiếu quỹ giờ thì chỉ so kỹ năng. Java không khớp JavaScript. Có bộ lọc hình thức làm việc và điểm phù hợp tối thiểu; tổng kết quả theo đúng bộ lọc.
- Tiêu chí lấy từ hồ sơ thật hoặc lựa chọn riêng của tài khoản; xóa giờ rảnh không tự gán một số giờ giả. Thẻ yêu cầu dự án cũng dùng đúng tiêu chí theo tài khoản.
- Khi nghiệm thu, danh sách đóng góp tổng hợp người phụ trách nhiệm vụ hoàn thành, người phụ trách trong các lần nộp đã được duyệt và người có giờ làm trên các nhiệm vụ hoàn thành. Không phụ thuộc vào danh sách thành viên đội hiện tại. Khách hàng của dự án không được tự ghi nhận. Danh sách này được chốt theo dự án, giữ tên và dấu vết số nhiệm vụ/giờ làm, hỗ trợ hồ sơ của người đã rời đội.
- Người từng là khách hàng có thể gia nhập đội khi không còn hợp tác PROPOSED/ACTIVE với đội đó. Vai trò và đánh giá của các dự án đã kết thúc được giữ theo quan hệ khách hàng đã xác nhận.
- V21 thêm số liệu chứng cứ cho lần nghiệm thu mới. Các bản ghi nhận cũ được giữ nguyên; số liệu chứng cứ chưa được lưu trong quá khứ để NULL, không dựng lại số liệu giả.
- Kiểm chứng: 274 frontend tests; 123 Work tests; lint/build; real MySQL integration với 15 tin tuyển dụng để kiểm tra thứ tự toàn cục, trang không lặp, tổng theo bộ lọc, tiêu chí chưa xác định; nhiệm vụ đổi người và người làm cũ rời đội vẫn được ghi nhận; khách hàng cũ gia nhập đội vẫn giữ quyền đánh giá. Browser kiểm tra tiêu chí gửi lên máy chủ, bộ lọc, xóa giờ và bố cục 390px.

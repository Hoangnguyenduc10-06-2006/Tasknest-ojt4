# Điều hướng chung của TaskNest

TaskNest có hai khu vực trong cùng khung ứng dụng:

- **Làm việc:** tổng quan, công việc cá nhân, nhiệm vụ cần duyệt, dự án, giờ làm và lời mời.
- **Khám phá:** tìm dự án, hồ sơ đội phát triển, cơ hội tham gia; nhóm **Kết nối của tôi** chứa yêu cầu đã đăng, đội của tôi và đơn ứng tuyển.

Bộ chuyển khu vực nằm ngay dưới logo trong sidebar, dùng chung trên desktop và menu điện thoại. Thanh trên cùng giữ tài khoản, thông báo, bộ đếm giờ và lựa chọn giao diện. Breadcrumb thể hiện đúng trang hiện tại.

## Ranh giới và trạng thái

- Trang cộng đồng chỉ render nội dung. Không tạo thêm header, logo hoặc khung độc lập bên trong trang.
- Người đã đăng nhập xem các trang khám phá qua cùng `ProtectedRoute`, `WorkspaceProvider` và `AppLayout` như dashboard. Điều hướng nội bộ giữ khung, phiên đăng nhập và bộ đếm giờ đang dùng.
- Nội dung khám phá tải độc lập với dữ liệu dự án/công việc. Lỗi workspace không chặn việc xem đội hay yêu cầu dự án.
- Khách chưa đăng nhập vẫn dùng `AppLayout`, với menu khám phá công khai và nút đăng nhập; không dựng provider workspace hoặc trợ lý AI.
- Các URL cá nhân `/requests?view=mine`, `/teams?view=mine`, `/teams?view=applications` yêu cầu đăng nhập và giữ nguyên đích quay lại.
- Các nút chuyển danh sách cập nhật URL. Sidebar nhận diện cả pathname và query, nên refresh, Back/Forward hoặc mở liên kết trực tiếp giữ đúng trang và mục được chọn.

`frontend/src/app/layouts/navigation.ts` là nơi khai báo nhóm menu, ánh xạ mục được chọn và tên breadcrumb. Quyền API được giữ tại các service hiện có; ẩn/hiện menu không thay thế kiểm tra quyền.

## Kiểm tra

```sh
npm --prefix frontend run typecheck
npm --prefix frontend run lint
npm --prefix frontend test
npm --prefix frontend run build
```

Kiểm thử trình duyệt kiểm tra chuyển Làm việc ↔ Khám phá mà không dựng lại shell, menu theo query, menu điện thoại và Escape, chế độ tối, khách xem trang công khai, chuyển đăng nhập cho trang cá nhân và khả năng xem khám phá khi workspace lỗi.

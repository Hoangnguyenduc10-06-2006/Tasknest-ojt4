# Cấu trúc giao diện TaskNest

## Tổ chức source

- `app/`: routing, layout ứng dụng, sidebar, navbar và kết nối các feature.
- `features/<feature>/pages/`: màn hình theo route; gọi hook của feature và ghép component.
- `features/<feature>/components/`: thành phần nghiệp vụ, form và modal riêng của feature.
- `features/<feature>/hooks/`, `api/`, `model/`: trạng thái, kết nối backend và quy tắc nghiệp vụ.
- `shared/ui/`: thành phần trình bày dùng chung; không gọi API nghiệp vụ.
- `shared/theme/`: lựa chọn sáng, tối, theo hệ thống.
- `styles.css`: màu semantic và các quy tắc trình bày toàn ứng dụng.

## Component dùng chung

| Component | Cách sử dụng |
| --- | --- |
| `PageHeader` | Tiêu đề trang, eyebrow, mô tả, actions; `titleId` cho nhãn accessibility |
| `SectionHeader` | Tiêu đề khu vực và nhóm hành động |
| `Panel` | Card/khu vực nội dung có viền, nền và padding |
| `Tabs` | Chuyển nội dung trong trang; hỗ trợ phím trái/phải, Home, End |
| `Button` | `kind`: primary, secondary, ghost, danger; hỗ trợ icon, loading, disabled |
| `Badge` | Trạng thái semantic: neutral, blue, green, amber, red, purple |
| `Avatar` | Chữ viết tắt tên người dùng |
| `Icon` | Icon SVG chung, không dùng ký tự Unicode thay icon |
| `TextField` / `PasswordField` | Nhãn, hint, lỗi và trạng thái nhập liệu |
| `Modal` | Dialog có focus, Escape, khôi phục focus và khóa cuộn nền |
| `Pagination` | Phân trang với chỉ số bắt đầu từ 0 |
| `EmptyState` | Trạng thái danh sách rỗng và hành động tiếp theo |
| `AuthHeading` | Tiêu đề trên các form tài khoản |

## Quy tắc áp dụng

1. Dùng token `canvas`, `surface`, `field`, `panel`, `line`, `ink`, `muted`, `accent`, `success`, `warning`, `danger` thay màu nền/chữ riêng theo từng trang.
2. Form nằm trong feature sở hữu nghiệp vụ; modal của feature đặt tại `components/modals/`.
3. Modal và form giữ việc validate và submit hiện có. Component shared chỉ nhận props/callback.
4. Chuyển trang dùng routing hiện tại; tab cục bộ dùng `Tabs`. Không dùng tab cục bộ để thay liên kết route.
5. Trạng thái đếm, tiến độ, tên người dùng, vai trò và thông báo lấy từ dữ liệu backend. Dữ liệu trong mẫu chỉ là ví dụ trình bày.
6. Nút submit cần khai báo `type="submit"`; `Button` mặc định là `type="button"`.
7. Giao diện danh sách cần có trạng thái tải, lỗi và không có dữ liệu. Các thao tác bị giới hạn theo quyền tiếp tục kiểm tra tại feature và backend.

## Kiểm tra trước khi commit

```bash
npm --prefix frontend run lint
npm --prefix frontend test
npm --prefix frontend run build
```

Kiểm tra trực quan riêng ở cả sáng/tối và trên màn hình nhỏ. TypeScript/test không thay thế bước kiểm tra này.

# Luồng đăng ký TaskNest

Quy tắc áp dụng khi phát triển các màn hình mới: [FRONTEND_RULES.md](FRONTEND_RULES.md).

Trang `/` giới thiệu TaskNest. Đăng nhập và đăng ký dùng `AuthCardLayout` và gọi Identity API qua Gateway. Trang kiểm tra kết nối `/dev/services` chỉ có trong môi trường phát triển.

## Chạy và thử

```sh
npm --prefix frontend run dev
```

Mở `http://localhost:5173/register` khi Gateway đang chạy. Thử form trống, email sai, mật khẩu dưới 8 ký tự và xác nhận không khớp. Khi form lỗi, focus chuyển đến trường lỗi đầu tiên. Sau khi gửi thành công, TaskNest chuyển sang trang xác minh email.

## Đọc code theo thứ tự

| File | Trách nhiệm |
|---|---|
| `src/app/App.tsx` | Ghép trang đăng ký với bộ xử lý Identity API |
| `src/features/auth/pages/WelcomePage.tsx` | Trang giới thiệu và nút Bắt đầu ngay dẫn tới đăng nhập |
| `src/features/auth/pages/LoginPage.tsx` | Ghép thẻ đăng nhập từ AuthCardLayout và LoginForm |
| `src/features/auth/pages/ForgotPasswordPage.tsx` | Trang `/forgot-password` với form ở giữa, mở từ Quên mật khẩu tại đăng nhập |
| `src/features/auth/components/ForgotPasswordForm.tsx` | Kiểm tra email đầu vào và gửi yêu cầu đặt lại mật khẩu |
| `src/features/auth/components/AuthIntroPanel.tsx` | Phần giới thiệu bên trái chỉ xuất hiện ở trang chào mừng |
| `src/features/auth/components/AuthCardLayout.tsx` | Bố cục xác thực dạng thẻ ở giữa, header và theme |
| `src/features/auth/pages/RegisterPage.tsx` | Ghép AuthCardLayout và form đăng ký |
| `src/features/auth/components/RegisterForm.tsx` | Render form, gắn lỗi, gửi thao tác tới hook và focus trường lỗi |
| `src/features/auth/hooks/useRegisterForm.ts` | Quản lý giá trị/lỗi/pending/kết quả, chống gửi lặp, bỏ qua phản hồi sau unmount |
| `src/features/auth/model/register.validation.ts` | Hàm kiểm tra/chuẩn hóa dữ liệu độc lập React, có test |
| `src/features/auth/model/register.types.ts` | Kiểu dữ liệu và giao diện hàm xử lý đăng ký |
| `src/features/auth/api/auth.api.ts` | Gửi đăng ký tới Identity API |
| `src/shared/ui/*` | Button, TextField, PasswordField dùng lại ở các feature khác |
| `src/shared/theme/ThemeSwitcher.tsx` | Ba nút icon Sáng/Tối/Theo hệ thống, có nhãn truy cập và trạng thái được chọn, dùng hook hiện có |

Luồng: **Page → Form → Hook → validation → handler được truyền vào → kết quả UI**.

State biểu mẫu nằm tại hook của feature. Trạng thái hiện/ẩn mật khẩu nằm tại PasswordField vì chỉ liên quan component đó. TextField biết label/lỗi/giao diện; không biết quy tắc đăng ký. Không thêm thư viện hoặc store toàn cục cho form đơn lẻ này.

## Màu giao diện dùng chung

Các màu nằm trong `src/styles.css`, với giá trị cho Sáng và Tối. Component dùng các utility theo vai trò: `bg-canvas` (nền trang), `bg-surface` (thẻ), `bg-field` (ô nhập), `bg-panel` (vùng giới thiệu), `border-line`, `text-ink`, `text-muted`, `bg-accent`, `text-on-accent`, `hover:bg-accent-hover`. Màu lỗi dùng `danger`, trạng thái tích cực dùng `success`.

Giới thiệu, đăng nhập và đăng ký cùng dùng bộ màu này. Không đặt lại màu nút/nền riêng ở mỗi page hoặc hardcode mã hex vào component. Chỉnh palette tại styles.css sẽ cập nhật cả các màn hình sử dụng component chung; không cần chép cặp màu light/dark vào từng file.

## Kết nối backend

`registerAccount` gửi `fullName`, `email`, `password` và `confirmPassword` qua `POST /api/identity/auth/register`. Lỗi ở API được hiển thị tại form. Phản hồi yêu cầu xác minh dẫn tới trang xác minh email.

## Kiểm tra

```sh
npm --prefix frontend run typecheck
npm --prefix frontend run lint
npm --prefix frontend test
npm --prefix frontend run build
```

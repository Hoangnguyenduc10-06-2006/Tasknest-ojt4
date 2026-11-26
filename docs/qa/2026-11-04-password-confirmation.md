# Xác nhận và đổi mật khẩu

Nhánh độc lập từ main `083444e`. Commit: `fix(auth): validate password changes with the shared policy`.

## Phạm vi

- `frontend/src/features/auth/components/AccountSecurityPanel.tsx`
- `frontend/src/features/auth/pages/ResetPasswordPage.tsx`

## Kiểm tra

Frontend: typecheck, lint và toàn bộ test đạt trên riêng nhánh này.

Chưa kiểm thử MySQL/Docker hoặc trình duyệt trên deploy; Docker daemon chưa hoạt động.

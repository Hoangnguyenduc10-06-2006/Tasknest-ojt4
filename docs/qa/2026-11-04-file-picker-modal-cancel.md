# Hủy chọn tệp không đóng modal

Nhánh độc lập từ main `083444e`. Commit: `fix(ui): ignore file picker cancellation in parent dialogs`.

## Phạm vi

- `frontend/src/shared/ui/Modal.tsx`

## Kiểm tra

Frontend: typecheck, lint và toàn bộ test đạt trên riêng nhánh này.

Chưa kiểm thử MySQL/Docker hoặc trình duyệt trên deploy; Docker daemon chưa hoạt động.

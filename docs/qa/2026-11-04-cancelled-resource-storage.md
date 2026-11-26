# Hủy thêm tài liệu không chiếm storage

Nhánh độc lập từ main `083444e`. Commit: `fix(collaboration): defer document uploads until resource save`.

## Phạm vi

- `frontend/src/features/collaboration/api/collaboration.api.ts`
- `frontend/src/features/collaboration/components/ProjectResources.tsx`
- `frontend/src/features/collaboration/components/FilePicker.tsx`

## Kiểm tra

Frontend: typecheck, lint và toàn bộ test đạt trên riêng nhánh này.

Chưa kiểm thử MySQL/Docker hoặc trình duyệt trên deploy; Docker daemon chưa hoạt động.

# Giữ trạng thái link mời khi đồng bộ

Nhánh độc lập từ main `083444e`. Commit: `fix(projects): preserve invitation forms during background sync`.

## Phạm vi

- `frontend/src/features/projects/model/project.store.ts`
- `frontend/src/features/projects/model/project.store.test.ts`
- `frontend/src/app/App.tsx`

## Kiểm tra

Frontend: typecheck, lint và toàn bộ test đạt trên riêng nhánh này.

Chưa kiểm thử MySQL/Docker hoặc trình duyệt trên deploy; Docker daemon chưa hoạt động.

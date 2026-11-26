# Timeout upload tài liệu

Nhánh độc lập từ main `083444e`. Commit: `fix(infra): align document upload timeouts`.

## Phạm vi

- `frontend/src/shared/api/client.ts`
- `infra/config-repo/api-gateway.yml`
- `infra/reverse-proxy/default.conf`

## Kiểm tra

Frontend: typecheck, lint và toàn bộ test đạt trên riêng nhánh này.

Chưa kiểm thử MySQL/Docker hoặc trình duyệt trên deploy; Docker daemon chưa hoạt động.

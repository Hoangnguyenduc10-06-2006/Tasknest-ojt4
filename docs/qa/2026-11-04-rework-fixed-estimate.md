# Giữ nguyên giờ ước tính khi giao lại

Nhánh độc lập từ main `083444e`. Commit: `fix(work): preserve task estimates when requesting rework`.

## Phạm vi

- `frontend/src/features/tasks/components/modals/TaskTransitionModal.tsx`
- `services/work-service/src/main/java/vn/tasknest/workservice/application/workspace/TaskWorkflowService.java`
- `RULE.md`
- `scripts/task_workflow_checks.py`
- `services/work-service/src/test/java/vn/tasknest/workservice/TaskReworkEstimateTest.java`

## Kiểm tra

Frontend: typecheck, lint và toàn bộ test đạt trên riêng nhánh này.
Work Service: clean verify đạt, gồm test hồi quy riêng cho lỗi.

Chưa kiểm thử MySQL/Docker hoặc trình duyệt trên deploy; Docker daemon chưa hoạt động.

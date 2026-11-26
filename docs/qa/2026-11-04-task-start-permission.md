# Quyền bắt đầu nhiệm vụ

Nhánh độc lập từ main `083444e`. Commit: `fix(work): restrict task start to the assignee`.

## Phạm vi

- `SRS.md`
- `frontend/src/features/tasks/model/task-board.ts`
- `frontend/src/features/tasks/model/task-board.test.ts`
- `services/work-service/src/main/java/vn/tasknest/workservice/application/workspace/TaskWorkflowService.java`
- `RULE.md`
- `scripts/task_workflow_checks.py`
- `services/work-service/src/test/java/vn/tasknest/workservice/TaskStartPermissionTest.java`

## Kiểm tra

Frontend: typecheck, lint và toàn bộ test đạt trên riêng nhánh này.
Work Service: clean verify đạt, gồm test hồi quy riêng cho lỗi.

Chưa kiểm thử MySQL/Docker hoặc trình duyệt trên deploy; Docker daemon chưa hoạt động.

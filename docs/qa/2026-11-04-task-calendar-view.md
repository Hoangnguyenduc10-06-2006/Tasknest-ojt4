# Chế độ xem Lịch biểu nhiệm vụ (Task Calendar View)

Nhánh tính năng từ `main` `5bec7c5`. Commit: `feat(tasks): add calendar view for project tasks`.

## Phạm vi thay đổi

- `frontend/src/features/tasks/components/TaskCalendarView.tsx`: Component hiển thị lịch 7 cột (Thứ Hai – Chủ Nhật), điều hướng tháng, thẻ task theo deadline và ưu tiên, popup chi tiết ngày và khối việc chưa đặt deadline.
- `frontend/src/features/tasks/components/TaskFilters.tsx`: Bổ sung chế độ xem `'calendar'` vào bộ lọc nhiệm vụ dự án.
- `frontend/src/features/tasks/components/TaskBoard.tsx`: Tích hợp hiển thị `TaskCalendarView` khi chọn tab Lịch.
- `frontend/src/features/tasks/model/task-calendar.test.ts`: Kiểm thử logic nhóm deadline và loại trừ task đã hủy trên lịch.

## Kiểm tra

- TypeScript typecheck (`tsc -b frontend`): Đạt 100%, không phát sinh lỗi kiểu dữ liệu.
- Hoạt động mượt mà trên cả giao diện Sáng (Light) và Tối (Dark).


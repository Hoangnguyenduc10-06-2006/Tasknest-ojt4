# Biểu đồ tiêu hao Sprint (Project Burndown Chart)

Nhánh tính năng từ `main` (`eca3c6d`): `feat/project-burndown-chart`.

## 1. Mục tiêu tính năng
Cung cấp công cụ đo lường và theo dõi tiến độ chuẩn Scrum/Agile cho từng dự án, hỗ trợ người quản lý và thành viên đánh giá tốc độ hoàn thành công việc và dự báo nguy cơ trễ hạn.

## 2. Phạm vi thay đổi

- `frontend/src/features/projects/model/burndown.model.ts`:
  - Thuật toán tính toán đường lý tưởng (Ideal Guideline) và đường thực tế (Actual Line).
  - Tự động xác định biên độ thời gian Sprint từ ngày tạo sớm nhất đến deadline xa nhất.
  - Phân tích chỉ số sức khỏe Sprint (`AHEAD`, `ON_TRACK`, `BEHIND`).
  - Hỗ trợ 2 chế độ: Theo số lượng nhiệm vụ (`tasks`) và theo số giờ ước tính (`hours`).
  - Tính toán vận tốc (Velocity) và dự báo ngày hoàn thành (Forecast Completion Date).
- `frontend/src/features/projects/model/burndown.test.ts`:
  - Unit test kiểm thử độ chính xác của đường lý tưởng, đường thực tế, loại trừ task `CANCELLED` và chế độ giờ.
- `frontend/src/features/projects/components/overview/ProjectBurndownChart.tsx`:
  - Giao diện biểu đồ SVG tương tác mượt mà, hỗ trợ cả giao diện Sáng (Light) và Tối (Dark).
  - Khối KPI Cards hiển thị: Khối lượng còn lại, Tỷ lệ %, Vận tốc đốt việc, Dự báo ngày cán đích.
  - Chuyển đổi linh hoạt giữa 2 chế độ (Số task / Số giờ ước tính).
  - Tooltip tương tác khi rê chuột xem chi tiết từng ngày.
- `frontend/src/features/projects/components/overview/ProjectOverviewView.tsx`:
  - Tích hợp component `ProjectBurndownChart` vào trang Tổng quan của Dự án.

## 3. Kết quả kiểm thử
- TypeScript: `tsc -b frontend` đạt 100% không phát sinh lỗi kiểu dữ liệu.
- ESLint: `npm --prefix frontend run lint` đạt 100% không có cảnh báo.
- Unit Test: Kiểm thử logic tính toán đạt 100%.
- Tương thích tốt với mọi kích thước màn hình và tự động co giãn SVG.

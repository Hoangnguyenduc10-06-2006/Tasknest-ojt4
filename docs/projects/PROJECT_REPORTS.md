# Xuất báo cáo dự án CSV

## Sử dụng

Mở Dự án → Tổng quan → Xuất báo cáo CSV. Chọn loại báo cáo, Từ ngày và Đến ngày rồi bấm Tải CSV. Mặc định là 30 ngày gần nhất; khoảng tối đa 366 ngày tính cả hai đầu. CSV có UTF-8 BOM để mở tiếng Việt trong Excel, dấu phẩy phân cột, dấu chấm cho số thập phân.

- **Tiến độ nhiệm vụ theo deadline:** các nhiệm vụ có deadline trong khoảng ngày. Xuất trạng thái hiện tại, người phụ trách hiện tại, ưu tiên, ngày bắt đầu/deadline, tổng giờ ước tính và giờ đã ghi trong kỳ. Đây là ảnh chụp trạng thái lúc xuất, không tái dựng trạng thái lịch sử. Giờ ước tính không được chia theo kỳ; không dùng giờ làm để suy ra phần trăm hoàn thành.
- **Nhật ký giờ làm:** các phiên có phần thời gian giao với khoảng ngày. Phiên qua ngày chỉ tính phần trong kỳ; timer còn chạy chỉ tính đến thời điểm bắt đầu xuất. Ngày và giờ theo Asia/Ho_Chi_Minh; cột giờ có bốn chữ số thập phân.
- Owner/Manager được xuất toàn bộ nhiệm vụ và giờ làm của dự án. Member chỉ xuất nhiệm vụ hiện giao cho mình và giờ của chính mình. Nhật ký giờ vẫn cho Member xem giờ mình đã ghi trên nhiệm vụ đã giao lại; không bao gồm giờ của người phụ trách cũ/khác.
- Thành viên hiện tại vẫn được xuất dự án lưu trữ. Người ngoài/người đã bị xóa không được truy cập. Không nhận vai trò hoặc người xuất từ trình duyệt.
- Tối đa 10.000 dòng dữ liệu; vượt giới hạn trả lỗi, không cắt mất dữ liệu. Không có dữ liệu thì tải file chỉ có tiêu đề cột. Lỗi mạng/phân quyền hiển thị trong modal, không tạo file giả.

## API

`GET /api/work/projects/{projectId}/reports/export?type=TASKS|TIME&from=YYYY-MM-DD&to=YYYY-MM-DD`

Bắt buộc Bearer token và cả ba tham số. Kết quả `text/csv;charset=UTF-8`, `Content-Disposition: attachment`, `Cache-Control: no-store`. Tên file: `tasknest-project-{id}-{type}-{from}-{to}.csv`.

Khoảng ngày là `[00:00 ngày đầu, 00:00 ngày sau ngày cuối)` theo giờ Việt Nam. Với giờ làm, chặn ngày kết thúc tại thời điểm xuất nếu đang ở tương lai; các phiên kết thúc đúng đầu kỳ hoặc bắt đầu đúng cuối kỳ không được tính.

Lỗi: 400 khi loại/khoảng ngày không hợp lệ; 401 khi chưa xác thực; 404 khi không còn quyền dự án; 422 `REPORT_TOO_LARGE` khi vượt số dòng. Lỗi Identity directory trả 503. Tên hiển thị lấy từ Identity; thiếu hồ sơ thì dùng UUID. CSV escape dấu phẩy/ngoặc kép/xuống dòng và vô hiệu hóa tiền tố công thức bảng tính trong dữ liệu văn bản.

Không thêm dependency, migration hoặc biến môi trường. Build lại frontend và Work Service để triển khai.

## Kiểm tra

```powershell
npm --prefix frontend run typecheck
npm --prefix frontend run lint
npm --prefix frontend test
npm --prefix frontend run build
.\mvnw.cmd -B -pl services/work-service verify
python scripts/test-workspace-data.py
```

Unit/API tests kiểm tra quyền theo vai trò, giới hạn kỳ/số dòng, clipping giờ Việt Nam và timer, CSV tiếng Việt/công thức, HTTP authentication và download headers. Frontend tests kiểm tra kỳ, hợp đồng request, định dạng file và lỗi tải.

`scripts/report_export_checks.py` được nối vào fixture MySQL/Gateway/Work riêng của `test-workspace-data.py`, bao gồm truy vấn thật, giờ riêng tư, giao lại nhiệm vụ, Manager đổi vai trò, dự án lưu trữ và thành viên bị xóa. Bộ này cần Docker; không sử dụng database đang chạy của nhóm.

## Tình trạng nghiệm thu ngày 05/11/2026

- Work Service: `verify` đạt, 62 test không có failure/error/skipped.
- Frontend: typecheck, lint, 134 test trên 30 file và production build đạt.
- Các script tích hợp đã qua kiểm tra cú pháp Python.
- Chưa chạy bộ MySQL/Gateway/Work riêng do Docker daemon chưa hoạt động trên máy kiểm tra. Chưa nghiệm thu tải file trên trình duyệt của bản deploy và mở file trong Excel thực tế. Có script hoặc unit test đạt không thay thế các bước nghiệm thu này.

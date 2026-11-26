# Đối chiếu bảng phân công TaskNest — 30/10/2026

> Cập nhật sau rà soát: trưởng nhóm đã xác nhận toàn bộ 18 task Sprint 1 hoàn thành. Phân loại dưới đây giữ nguyên làm bản ghi bằng chứng kỹ thuật tại thời điểm rà soát trước xác nhận. Trạng thái Sprint 1 mới nhất nằm trong [báo cáo Sprint 1](../reports/SPRINT_1_REPORT.md).

Nguồn kế hoạch: `local/JIRA_TASKS.md` (61 task). Đánh giá trên working tree nhánh `feat/rule-completion`, bao gồm code chưa commit/push. Không phải trạng thái Jira và không chứng nhận cá nhân đã hoàn tất công việc.

“Đạt cục bộ” là triển khai/chức năng chính có code và bằng chứng kiểm thử liên quan; không đồng nghĩa nghiệm thu production, mọi browser hay mọi điều kiện lỗi. Khi một tiêu chí còn thiếu, task được xếp Một phần. Không dùng số lượng tests để thay số task.

| Trạng thái | Số task |
|---|---:|
| Đạt cục bộ | 37 |
| Một phần | 20 |
| Chưa hoàn tất | 3 |
| Chưa đủ bằng chứng | 1 |
| Tổng | 61 |

**Tỷ lệ đạt cục bộ: 37/61 = 60,7%.** Không cộng task một phần vào tỷ lệ này và không ước tính phần trăm giờ công.

## Theo người phụ trách trong kế hoạch

Các con số thể hiện phạm vi đã phân công, không xác định ai thực tế viết code hoặc đo năng suất cá nhân.

| Phụ trách theo kế hoạch | Đạt cục bộ | Một phần | Chưa hoàn tất | Thiếu bằng chứng | Tổng |
|---|---:|---:|---:|---:|---:|
| Đặng Khánh An | 6 | 6 | 2 | 0 | 14 |
| Đoàn Việt Anh | 8 | 6 | 0 | 1 | 15 |
| Hoàng Nguyên Đức | 13 | 3 | 0 | 0 | 16 |
| Nguyễn Duy Mạnh | 10 | 5 | 1 | 0 | 16 |

## Từng task

| Mã | Công việc | Phụ trách kế hoạch | Đánh giá | Bằng chứng / còn thiếu |
|---|---|---|---|---|
| TN-001 | Chốt service, API contract và quy tắc giao tiếp | Đặng Khánh An | Một phần | Hợp đồng API/event cần cập nhật theo endpoint và kiến trúc realtime hiện tại; chưa có dấu xác nhận bàn giao contract. |
| TN-002 | Thiết kế ERD và migration Work Service | Nguyễn Duy Mạnh | Đạt cục bộ | Flyway, dữ liệu liên service và schema: 98 assertions/migration/startup đạt. |
| TN-003 | Thiết kế dữ liệu Identity và Notification | Hoàng Nguyên Đức | Đạt cục bộ | Flyway, dữ liệu liên service và schema: 98 assertions/migration/startup đạt. |
| TN-004 | Khởi tạo cấu trúc repo và quy ước PR | Đặng Khánh An | Đạt cục bộ | Cấu trúc repo, Compose/CI/config; infrastructure/smoke và integration tương ứng đạt. Gateway WS được kiểm tra qua browser local. |
| TN-005 | Môi trường Docker Compose local | Đặng Khánh An | Đạt cục bộ | Cấu trúc repo, Compose/CI/config; infrastructure/smoke và integration tương ứng đạt. Gateway WS được kiểm tra qua browser local. |
| TN-006 | Pipeline kiểm tra PR và build | Đặng Khánh An | Đạt cục bộ | Cấu trúc repo, Compose/CI/config; infrastructure/smoke và integration tương ứng đạt. Gateway WS được kiểm tra qua browser local. |
| TN-007 | Đối chiếu Figma với màn hình và trạng thái nghiệp vụ | Đoàn Việt Anh | Chưa đủ bằng chứng | Không có biên bản/checklist đối chiếu đầy đủ Figma trong repo; không kết luận rằng thành viên chưa làm. |
| TN-008 | Layout, component dùng chung và theme | Đoàn Việt Anh | Một phần | Đã có layout/theme/primitives chung; chưa nghiệm thu đồng nhất toàn bộ màn hình theo thiết kế. |
| TN-009 | Routing và lớp API có xử lý lỗi/xác thực | Nguyễn Duy Mạnh | Đạt cục bộ | Auth API/UI, account security, phiên/token và các kiểm thử auth/mail thực trên stack riêng đạt. |
| TN-010 | Đăng ký và xác minh email | Hoàng Nguyên Đức | Đạt cục bộ | Auth API/UI, account security, phiên/token và các kiểm thử auth/mail thực trên stack riêng đạt. |
| TN-011 | JWT, refresh rotation và phiên 7 ngày | Hoàng Nguyên Đức | Đạt cục bộ | Auth API/UI, account security, phiên/token và các kiểm thử auth/mail thực trên stack riêng đạt. |
| TN-012 | Đăng ký, xác minh và đăng nhập | Đoàn Việt Anh | Đạt cục bộ | Auth API/UI, account security, phiên/token và các kiểm thử auth/mail thực trên stack riêng đạt. |
| TN-013 | Khung gửi email Brevo và cấu hình sender | Nguyễn Duy Mạnh | Một phần | Có worker Brevo, outbox/retry và integration; chưa xác nhận sender/domain thực tế của môi trường triển khai. |
| TN-014 | Rà soát RULE SRS và backlog cùng nhóm | Đặng Khánh An | Một phần | RULE/SRS/backlog đã có nhưng một số mô tả cũ chưa đồng bộ; chưa đủ bằng chứng rà soát cuối cùng cùng nhóm. |
| TN-015 | Danh sách phiên, thu hồi và logout mọi thiết bị | Hoàng Nguyên Đức | Đạt cục bộ | Auth API/UI, account security, phiên/token và các kiểm thử auth/mail thực trên stack riêng đạt. |
| TN-016 | Quên, đặt lại và đổi mật khẩu | Hoàng Nguyên Đức | Đạt cục bộ | Auth API/UI, account security, phiên/token và các kiểm thử auth/mail thực trên stack riêng đạt. |
| TN-017 | API avatar và ảnh dự án, kiểm tra tệp | Nguyễn Duy Mạnh | Đạt cục bộ | Profile/project avatar API; kiểm tra ảnh, quyền và persistence trong integration đạt. |
| TN-018 | Hồ sơ, mật khẩu và quản lý thiết bị | Đoàn Việt Anh | Một phần | Đủ trang/profile/reset/phiên; UI thao tác thu hồi phiên/đăng xuất tất cả chưa có bước xác nhận riêng theo tiêu chí task. |
| TN-019 | CRUD dự án và vai trò Owner/Manager | Hoàng Nguyên Đức | Đạt cục bộ | Project/member/invitation/QR API và giao diện; integration phân quyền, stale/concurrency/archive đạt. |
| TN-020 | Thành viên và điều kiện xóa khỏi dự án | Hoàng Nguyên Đức | Đạt cục bộ | Project/member/invitation/QR API và giao diện; integration phân quyền, stale/concurrency/archive đạt. |
| TN-021 | Danh sách/chi tiết dự án và thành viên | Đoàn Việt Anh | Đạt cục bộ | Project/member/invitation/QR API và giao diện; integration phân quyền, stale/concurrency/archive đạt. |
| TN-022 | Lời mời trực tiếp qua email tài khoản | Hoàng Nguyên Đức | Đạt cục bộ | Project/member/invitation/QR API và giao diện; integration phân quyền, stale/concurrency/archive đạt. |
| TN-023 | Link QR chung và yêu cầu chờ duyệt | Nguyễn Duy Mạnh | Đạt cục bộ | Project/member/invitation/QR API và giao diện; integration phân quyền, stale/concurrency/archive đạt. |
| TN-024 | Giao diện mời, QR và duyệt yêu cầu | Đoàn Việt Anh | Đạt cục bộ | Project/member/invitation/QR API và giao diện; integration phân quyền, stale/concurrency/archive đạt. |
| TN-025 | CRUD task, phân công, tìm kiếm và phân trang | Nguyễn Duy Mạnh | Đạt cục bộ | Task CRUD/workflow/Kanban và version; integration và model tests đạt. |
| TN-026 | Luồng nộp, duyệt, làm lại và bị chặn | Nguyễn Duy Mạnh | Đạt cục bộ | Task CRUD/workflow/Kanban và version; integration và model tests đạt. |
| TN-027 | Danh sách, chi tiết và form nhiệm vụ | Đoàn Việt Anh | Một phần | Có danh sách/form/chi tiết; chi tiết chưa hiển thị đầy đủ khối lần nộp/reviewer và phiên giờ như thiết kế. |
| TN-028 | Kanban và thao tác chuyển trạng thái thay thế | Đoàn Việt Anh | Đạt cục bộ | Task CRUD/workflow/Kanban và version; integration và model tests đạt. |
| TN-029 | Hộp thông báo và trạng thái đọc | Nguyễn Duy Mạnh | Đạt cục bộ | Inbox theo người nhận/quyền, read state, client badge; WebSocket thật dưới 2 giây và revoke closure đạt. |
| TN-030 | Outbox và hợp đồng sự kiện giữa service | Đặng Khánh An | Một phần | Có transactional outbox, confirm, dedup/ACK/DLQ; chưa đủ bằng chứng nghiệm thu event version/order ở mọi tình huống. |
| TN-031 | WebSocket xác thực và kiểm soát kênh | Nguyễn Duy Mạnh | Đạt cục bộ | Inbox theo người nhận/quyền, read state, client badge; WebSocket thật dưới 2 giây và revoke closure đạt. |
| TN-032 | Trung tâm thông báo và badge chưa đọc | Đoàn Việt Anh | Đạt cục bộ | Inbox theo người nhận/quyền, read state, client badge; WebSocket thật dưới 2 giây và revoke closure đạt. |
| TN-033 | API bắt đầu dừng và khôi phục đồng hồ | Hoàng Nguyên Đức | Đạt cục bộ | Timer/manual time, khôi phục và kiểm tra overlap/concurrency/quyền/lịch sử đạt. |
| TN-034 | Bổ sung và điều chỉnh thời gian thủ công | Hoàng Nguyên Đức | Đạt cục bộ | Timer/manual time, khôi phục và kiểm tra overlap/concurrency/quyền/lịch sử đạt. |
| TN-035 | Timer, khôi phục và nhật ký giờ làm | Đoàn Việt Anh | Đạt cục bộ | Timer/manual time, khôi phục và kiểm tra overlap/concurrency/quyền/lịch sử đạt. |
| TN-036 | Scheduler cảnh báo estimate và deadline | Hoàng Nguyên Đức | Một phần | Đã có TaskAlertScheduler; thiếu bộ test trực tiếp ngưỡng 80/100, nhảy vượt, dedup và deadline/lần nộp trong 60 giây. |
| TN-037 | API dashboard, biểu đồ và công việc cá nhân | Nguyễn Duy Mạnh | Đạt cục bộ | Workspace/analytics, selectors/filter và API scope; đã kiểm tra số liệu tổng quan trên browser local. |
| TN-038 | Dashboard và các biểu đồ tiến độ | Đoàn Việt Anh | Một phần | Dashboard/analytics có dữ liệu thật; cần nghiệm thu đủ biểu đồ, loading/error và các trường hợp không được xem giờ. |
| TN-039 | Hoàn thiện tìm kiếm lọc và công việc cá nhân | Đoàn Việt Anh | Đạt cục bộ | Workspace/analytics, selectors/filter và API scope; đã kiểm tra số liệu tổng quan trên browser local. |
| TN-040 | Bình luận và lịch sử hoạt động | Hoàng Nguyên Đức | Đạt cục bộ | Comment/history API, ownership/tombstone/mentions/attachments; gửi và tải lại comment/history thật trên browser đạt. Áp dụng RULE mới. |
| TN-041 | Bình luận và dòng lịch sử nhiệm vụ | Đoàn Việt Anh | Đạt cục bộ | Comment/history API, ownership/tombstone/mentions/attachments; gửi và tải lại comment/history thật trên browser đạt. Áp dụng RULE mới. |
| TN-042 | Đồng bộ realtime toàn bộ màn hình | Nguyễn Duy Mạnh | Một phần | Có invalidate/refetch chung và kiểm tra realtime; chưa kiểm thử đầy đủ reconnect/mất mạng/stale form trên mọi màn hình. |
| TN-043 | Phân quyền liên service và chống truy cập chéo | Đặng Khánh An | Đạt cục bộ | Kiểm tra auth boundary/Origin/CSRF/IDOR/stale/mass assignment và regression theo các lỗi đã sửa đạt. |
| TN-044 | Kiểm thử JWT, rotation, reset và nhiều thiết bị | Hoàng Nguyên Đức | Một phần | Đã test reset/rotation/revoke/CSRF; chưa đủ bằng chứng đầy đủ ma trận hết hạn 7 ngày/nhiều thiết bị/WS/timer theo task. |
| TN-045 | Kiểm thử rule công việc và giao dịch cạnh tranh | Nguyễn Duy Mạnh | Một phần | Đã test nhiều race bằng MySQL thật; thiếu ma trận tự động đầy đủ cho cảnh báo estimate/deadline và số liệu dashboard. |
| TN-046 | Kiểm thử realtime, mạng lỗi và lỗi email | Nguyễn Duy Mạnh | Một phần | Có test dưới 2 giây, revoke, lỗi mail/DLQ; thiếu đo 60 giây và ngắt/phục hồi Gateway/broker/service toàn bộ luồng. |
| TN-047 | Kiểm tra responsive, dark mode và khả năng thao tác | Đoàn Việt Anh | Một phần | Đã quan sát một số trang sáng/tối; chưa có ma trận mọi màn hình mobile/desktop/keyboard/browser. |
| TN-048 | Kiểm thử xuyên suốt luồng demo và quyền | Đặng Khánh An | Một phần | Có báo cáo và các luồng E2E riêng; chưa nghiệm thu trọn kịch bản demo liên tục với mọi vai trò và điều kiện lỗi. |
| TN-049 | Hoàn thiện API docs và dữ liệu demo | Hoàng Nguyên Đức | Một phần | Có tài liệu API từng phần và fixture; thiếu tài liệu đồng bộ cho toàn bộ endpoint mới và dữ liệu demo bàn giao. |
| TN-050 | Kiểm thử tải demo và theo dõi sức khỏe | Đặng Khánh An | Chưa hoàn tất | Chưa có báo cáo benchmark tải, latency, CPU/RAM và môi trường/tập tải đã duyệt. |
| TN-051 | CD qua SSH, HTTPS và phương án rollback | Đặng Khánh An | Chưa hoàn tất | Chưa có CD qua SSH/HTTPS production và diễn tập rollback; workflow hiện chỉ là CI. |
| TN-052 | Sao lưu MySQL ảnh và thử khôi phục | Đặng Khánh An | Một phần | Có SQL backup và bài kiểm tra nâng cấp/khôi phục DB riêng; chưa có lịch/off-host và diễn tập khôi phục DB + volume tệp. |
| TN-053 | Kiểm tra email và liên kết trên domain thật | Nguyễn Duy Mạnh | Chưa hoàn tất | Chưa có domain/môi trường thực để nghiệm thu email và các link HTTPS. |
| TN-054 | Sửa lỗi giao diện sau QA và kiểm tra lại | Đoàn Việt Anh | Một phần | Đã sửa các lỗi frontend phát hiện; chưa đóng vòng QA toàn bộ màn hình và mọi lỗi còn lại. |
| TN-055 | Sửa lỗi backend sau QA và kiểm tra lại | Hoàng Nguyên Đức | Đạt cục bộ | Kiểm tra auth boundary/Origin/CSRF/IDOR/stale/mass assignment và regression theo các lỗi đã sửa đạt. |
| TN-056 | Rà soát cuối và chuẩn bị báo cáo demo | Đặng Khánh An | Một phần | Có báo cáo QA; chưa hoàn tất deploy/load/backup/domain và gói bàn giao cuối cùng. |
| TN-057 | Spring Cloud Gateway cho API và WebSocket | Đặng Khánh An | Đạt cục bộ | Cấu trúc repo, Compose/CI/config; infrastructure/smoke và integration tương ứng đạt. Gateway WS được kiểm tra qua browser local. |
| TN-058 | Eureka Server và đăng ký các service | Hoàng Nguyên Đức | Đạt cục bộ | Cấu trúc repo, Compose/CI/config; infrastructure/smoke và integration tương ứng đạt. Gateway WS được kiểm tra qua browser local. |
| TN-059 | Config Server và cấu hình theo môi trường | Đặng Khánh An | Đạt cục bộ | Cấu trúc repo, Compose/CI/config; infrastructure/smoke và integration tương ứng đạt. Gateway WS được kiểm tra qua browser local. |
| TN-060 | RabbitMQ và hợp đồng queue exchange DLQ | Nguyễn Duy Mạnh | Đạt cục bộ | Cấu trúc repo, Compose/CI/config; infrastructure/smoke và integration tương ứng đạt. Gateway WS được kiểm tra qua browser local. |
| TN-061 | Health metrics và correlation ID xuyên service | Nguyễn Duy Mạnh | Một phần | Có health/readiness/correlation; chưa đủ bằng chứng metrics có quyền và trace xuyên HTTP/RabbitMQ end-to-end. |

## Lưu ý khi cập nhật Jira

- TN là mã kế hoạch, không phải Jira issue key. Chưa cập nhật trạng thái Jira trong lần rà soát này.
- Bảng gốc còn mô tả comment chỉ thông báo trong app và WebSocket tại Notification. RULE mới đã mở rộng email cho mention/reply và implementation dùng Work WebSocket gửi invalidation theo người dùng; nên cập nhật mô tả task trước nghiệm thu. Không coi việc tuân thủ RULE mới là lỗi chỉ vì bảng cũ chưa sửa.
- Ưu tiên phần còn thiếu của TN-027/036/038/042, đóng ma trận QA TN-044–048; đồng bộ tài liệu TN-001/014/049; sau đó TN-050–053/056 khi có hạ tầng.
- Hồ sơ kiểm tra gần nhất: [Pre-deploy review](2026-10-30-pre-deploy-review.md). Bằng chứng: 114 frontend tests, 129 Java tests, 98 schema assertions, các bộ integration và browser local đã ghi trong báo cáo; đây là coverage thực tế, không bảo đảm mọi tiêu chí đã được test đầy đủ.

# Khung backend dự án — TaskNest

## Phần đã triển khai

Work Service có entity/repository dự án và thành viên, DTO dùng chung, kiểm tra quyền hiện tại và API tạo, đọc danh sách/chi tiết, sửa thông tin dự án. Dùng schema Flyway hiện tại đến Work V4; không sửa migration cũ, không tạo lại database và Work V4 bổ sung dữ liệu tài nguyên/bình luận theo RULE v2.0; API tạo khởi tạo hàng hạn mức 500 MiB cùng transaction.

- `POST /api/work/projects` tạo dự án ACTIVE, bản ghi thành viên ACTIVE của Owner , hàng project_storage_usage và lịch sử PROJECT_CREATED trong cùng transaction. Lỗi bất kỳ bước nào hoàn tác toàn bộ.
- `GET /api/work/projects` trả `data: { content, page, size, totalElements, totalPages }`; hỗ trợ q/status/role/sort và phân trang 10/20/50. Offset vượt giới hạn JPA trả 400. Vai trò trên API là OWNER/MANAGER/MEMBER.
- `GET /api/work/projects/index` trả mảng đầy đủ các dự án có membership ACTIVE của người đăng nhập, gồm dự án đã lưu trữ. Endpoint dùng cùng kiểm tra phiên/email đã xác nhận và membership; không công khai dữ liệu dự án ngoài quyền.
- Frontend `listProjects` lấy `/index` cho cache dùng chung của dashboard, điều hướng, tên dự án và kiểm tra tên trùng; `listProjectPage` là hợp đồng phân trang riêng, không gắn metadata vào mảng và không thay cache bằng một trang kết quả.
- Giao diện Dự án của tôi lọc/tìm kiếm/sắp xếp trên catalog đầy đủ rồi mới chia trang 10/20/50, giữ sắp xếp theo tiến độ dựa trên workspace thật. Đổi điều kiện hoặc kích thước trang đưa về trang đầu; thống kê tổng thể không bị giới hạn bởi trang đang hiển thị.
- Trang chi tiết gọi API theo ID độc lập với catalog. Có trạng thái tải, 404 thực và lỗi có thể thử lại; cache rỗng hoặc chưa tải xong không đồng nghĩa dự án không tồn tại. Phản hồi cũ bị bỏ khi đổi dự án/tài khoản.
- `GET /api/work/projects/{id}` kiểm tra membership hiện tại, trả 404 cho người ngoài hoặc thành viên bị xóa.
- `PUT /api/work/projects/{id}` chỉ cho Owner/Manager của dự án ACTIVE; kiểm tra version, tăng version và ghi lịch sử cùng transaction. Phiên bản cũ trả 409 và không ghi đè.
- Owner lấy từ phiên được Identity xác thực, không nhận owner/role từ request. ID tài khoản là UUID; ID dự án tiếp tục là BIGINT/Long.
- Tên/mô tả bỏ khoảng trắng đầu/cuối; tên 3–100 ký tự, mô tả 10–500 ký tự. Hai ngày bắt buộc, ngày kết thúc không trước ngày bắt đầu; được bắt đầu trong quá khứ.
- Kiểm tra trước trùng tên theo Owner/dự án ACTIVE; unique index hiện có `uq_project_active_name` bảo vệ cả khi gửi đồng thời. Cùng tên khác Owner được phép. So sánh tên dùng collation hiện tại của MySQL, không tự đổi sang bộ quy tắc so sánh khác.
- Bản ghi mới không có Manager hay avatar; dùng ảnh mặc định. API tải ảnh là phần triển khai tiếp theo.

## Cấu trúc và trách nhiệm

```text
services/work-service/src/main/java/vn/tasknest/workservice/
  api/
    WorkResponse.java, PageResponse.java, WorkExceptionHandler.java
    project/ProjectController.java
    project/CreateProjectRequest.java, UpdateProjectRequest.java
    project/ProjectListQuery.java, ProjectResponse.java
  application/
    project/CreateProjectService.java, ReadProjectService.java, UpdateProjectService.java
    security/WorkActor.java, IdentitySessionVerifier.java
    security/ProjectPermissionService.java, ProjectAccess.java
    WorkException.java
  domain/project/
    Project.java, ProjectMembership.java, MembershipId.java
    ProjectStatus.java, ProjectRole.java, MembershipStatus.java
  infrastructure/
    persistence/ProjectRepository.java, ProjectMembershipRepository.java
    persistence/ProjectActivityRepository.java
    identity/IdentitySessionClient.java
  config/
    SecurityConfiguration.java, ProjectConfiguration.java, WorkBearerFilter.java
```

Controller nhận DTO, xác định actor qua `@AuthenticationPrincipal`, gọi application service và trả response. Application service giữ transaction và điều phối quyền; repository chỉ truy cập database của Work Service. Không import entity/repository của Identity hoặc truy vấn chéo database. Không trả JPA entity trực tiếp ra API.

Không thêm role vào `project_memberships`: Owner/Manager lấy từ `projects.owner_user_id`/`manager_user_id`, người còn lại là MEMBER. Chức danh chuyên môn không cấp quyền.

## Lưu trữ và khôi phục dự án

- `POST /api/work/projects/{id}/archive` và `POST /api/work/projects/{id}/reopen` nhận `{ "version": 0 }`; trả `ProjectResponse` cùng phiên bản mới để cập nhật cache dùng chung.
- Chỉ Owner có membership ACTIVE được thực hiện. Backend khóa hàng dự án trước khi kiểm tra quyền, phiên bản và timer, cùng thứ tự khóa với thao tác bắt đầu ghi giờ.
- Lưu trữ bị từ chối nếu bất kỳ thành viên nào còn timer đang chạy trong dự án. Manager cũng không được lưu trữ hoặc khôi phục. Giao diện có thể cảnh báo từ timer hiện thấy, nhưng backend kiểm tra toàn dự án.
- Khôi phục kiểm tra tên trùng với các dự án ACTIVE của cùng Owner, xóa `archived_at`/`archived_by`, giữ nguyên nhiệm vụ và lịch sử. Lưu trữ/khôi phục tăng version và ghi activity trong cùng transaction.
- Danh sách giữ phân trang 10/20/50 và catalog đầy đủ từ `/index`; tab Nhiệm vụ tiếp tục dùng Kanban/Danh sách. Trạng thái lưu trữ cập nhật qua project store để khóa/mở thao tác trên giao diện.
- Bài kiểm thử `scripts/project_archive_checks.py` được gọi bởi cả `python3 scripts/test-project-foundation.py` và `python3 scripts/test-workspace-data.py`. Chạy trên MySQL riêng, qua gateway và Identity stub; kiểm tra quyền, timer của thành viên khác, trùng tên khi mở lại, metadata/lịch sử, phiên bản cũ và cuộc đua lưu trữ/bắt đầu timer. Không đọc `.env` hoặc sửa database đang dùng.

## Xác thực và kiểm tra quyền

Trình duyệt → Gateway → Work Service. Cả Gateway và Work kiểm tra phiên qua `GET /api/identity/auth/session`, dùng chính Authorization Bearer của yêu cầu. Identity đang chịu trách nhiệm kiểm tra chữ ký/thuật toán JWT, issuer, audience, hạn token và trạng thái phiên. Work đọc UUID/emailVerified từ phản hồi hợp lệ; không tự giải mã rồi tin JWT chưa xác minh, không tin X-User-Id/X-Role và không cache kết quả phiên.

Dùng service ID `identity-service` qua Spring Cloud LoadBalancer/Eureka. Có timeout hữu hạn; Identity không truy cập được thì từ chối với 503, không tạo dự án hoặc giả phiên hợp lệ. Work yêu cầu email đã xác nhận trước thao tác dự án.

Hiện mỗi yêu cầu dự án đi qua Gateway kiểm tra Identity hai lần, ở hai ranh giới. Đây là lựa chọn đơn giản để không phụ thuộc header tin cậy hoặc bản sao trạng thái thu hồi. Nếu tối ưu sau này, phải giữ hiệu lực thu hồi phiên; không bỏ lần kiểm tra bằng cách tin header từ trình duyệt.

Khu vực `/api/work/projects` và các đường dẫn con đã được bảo vệ tại Gateway/Work. Các endpoint tạo, đọc và sửa đã có implementation. Khi thêm controller phải tiếp tục kiểm tra quyền đối tượng, không chỉ dựa vào việc đã qua xác thực.

API dự án chỉ xác thực qua header Authorization, không lấy token từ cookie, vì vậy được miễn CSRF riêng cho khu vực này. Refresh/logout/profile của Identity giữ cơ chế CSRF hiện tại. Không lưu Access Token trong localStorage, không đưa token vào URL.

### API quyền dùng chung

| Phương thức | Mục đích |
|---|---|
| `requireVerified(actor)` | Yêu cầu phiên và email đã xác nhận |
| `requireMember(projectId, actor)` | Đọc dự án, kể cả đã lưu trữ; yêu cầu membership ACTIVE |
| `requireWritable(projectId, actor)` | Ghi trong dự án ACTIVE; lấy khóa ghi project |
| `requireManager(projectId, actor)` | Ghi quản lý trong dự án ACTIVE, chỉ OWNER/MANAGER |
| `requireOwner(projectId, actor)` | Khóa project và yêu cầu OWNER; cho phép dự án ARCHIVED để mở lại |

Các phương thức ghi yêu cầu transaction của service gọi (`Propagation.MANDATORY`). Không gọi một lần ở controller rồi ghi trong transaction khác. Mọi thay đổi Manager/thành viên cũng phải khóa hàng project trước khi cập nhật, cùng thứ tự project → membership → dữ liệu con, để kiểm tra quyền và thay đổi vai trò không chạy lệch nhau. Kiểm tra quyền lại cho từng yêu cầu; không ghi role theo dự án vào JWT làm nguồn quyền.

Ví dụ cho chức năng sửa do Mạnh triển khai:

```java
@Transactional
public ProjectResponse update(Long id, WorkActor actor, UpdateProjectRequest request) {
    ProjectAccess access = permissions.requireManager(id, actor);
    Project project = access.project();
    // So sánh request.version với project.getVersion(); lệch trả 409.
    // Bổ sung domain method cập nhật tên/mô tả/ngày/updatedAt.
    // Kiểm tra tên trùng có loại chính project này, flush và ghi lịch sử cùng transaction.
    // Trả ProjectResponse.from(project, access.role()).
}
```

Ví dụ trên là hướng dẫn, không phải endpoint đã triển khai. `@Version` đã có trên Project; application phải kiểm tra version client gửi, và ánh xạ lỗi optimistic locking thành 409 khi làm API sửa. Owner lưu trữ/mở lại dùng `requireOwner`; lưu trữ phải kiểm tra không còn timer đang chạy. Không triển khai chuyển quyền Owner trong phiên bản đầu.

## Hợp đồng tạo dự án

```http
POST /api/work/projects
Authorization: Bearer <access-token>
Content-Type: application/json
```

```json
{
  "name": "TaskNest",
  "description": "Hệ thống quản lý công việc và dự án",
  "startsOn": "2026-10-19",
  "endsOn": "2026-11-15"
}
```

Thành công: **201 Created**, header `Location: /api/work/projects/<id>`. Response gồm `success`, `message`, `data`, `errors`, `code`, `httpStatus`. `data` là ProjectResponse:

```json
{
  "success": true,
  "message": "Tạo dự án thành công.",
  "data": {
    "id": 12,
    "name": "TaskNest",
    "description": "Hệ thống quản lý công việc và dự án",
    "ownerUserId": "00000000-0000-4000-8000-000000000001",
    "managerUserId": null,
    "status": "ACTIVE",
    "role": "OWNER",
    "startsOn": "2026-10-19",
    "endsOn": "2026-11-15",
    "hasAvatar": false,
    "version": 0,
    "createdAt": "2026-10-28T06:00:00Z",
    "updatedAt": "2026-10-28T06:00:00Z"
  },
  "errors": null,
  "code": "PROJECT_CREATED",
  "httpStatus": "CREATED"
}
```

Ngày là ngày lịch; Instant lưu/trao đổi UTC và hiển thị theo Asia/Ho_Chi_Minh. Frontend ánh xạ `startDate/endDate` và nhãn Owner/Manager/Member sang `startsOn/endsOn` và `OWNER/MANAGER/MEMBER`. Điều hướng theo ID dự án, không dùng tên để suy ID hoặc tự tính role.

| HTTP | Trường hợp |
|---|---|
| 400 | Thiếu/sai dữ liệu, ngày không hợp lệ; `VALIDATION_ERROR` hoặc `INVALID_REQUEST` |
| 401 | Thiếu Access Token hoặc Identity từ chối token/phiên |
| 403 | Email chưa xác nhận; quyền quản lý không đủ khi thêm các API quản lý |
| 404 | Không có dự án hoặc không có membership ACTIVE khi dùng ProjectPermissionService |
| 409 | `PROJECT_NAME_EXISTS` hoặc `DATA_CONFLICT`; khi thêm API ghi dự án đã lưu trữ trả `PROJECT_ARCHIVED` |
| 503 | Không xác minh được phiên với Identity; không fallback sang mock |

Các trường client không có trong CreateProjectRequest không được dùng để gán entity, kể cả ownerUserId, managerUserId, status và role. Version/createdAt/updatedAt do máy chủ quản lý. `Location` là định danh tài nguyên và đã có GET tương ứng. Gửi lặp cùng tên/Owner được bảo vệ bằng unique index; chưa có hợp đồng Idempotency-Key.

## Phần việc giao tiếp theo

| Người | Triển khai tiếp | Dùng lại |
|---|---|---|
| Đặng Khánh An | Duy trì khung, tạo dự án, quyền dùng chung; review thay đổi quyền | WorkActor, CreateProjectService, ProjectPermissionService |
| Hoàng Nguyên Đức | Mở rộng GET danh sách với tìm kiếm/lọc/sắp xếp/phân trang | ProjectListQuery, PageResponse, ProjectResponse, repository, requireMember |
| Nguyễn Duy Mạnh | Lưu trữ/mở lại, upload/thay/xem ảnh; lịch sử và test xung đột/quyền/timer | UpdateProjectRequest, @Version, requireManager/requireOwner, ProjectActivityRepository |
| Đoàn Việt Anh | Hoàn thiện UI và nối API qua Gateway; xử lý 400/401/403/409/503, giữ form khi lỗi | Hợp đồng DTO ở trên, shared/api, router chung |

Danh sách: query q/status/role/page/size/sort; page bắt đầu 0, size 20 mặc định và chỉ nhận 10/20/50. Sort UPDATED_DESC/NAME_ASC/NAME_DESC, phải thêm ID làm thứ tự phụ ổn định. Chỉ trả dự án có membership ACTIVE của actor; không lấy tất cả rồi lọc ở frontend. DTO phân trang là hợp đồng chuẩn bị sẵn; API danh sách hiện trả mảng trong `data`, chỉ truy vấn các dự án có membership ACTIVE, chưa xử lý các tham số phân trang/lọc này.

Chưa triển khai: phân trang danh sách, archive/avatar, quản lý thành viên/lời mời, outbox/realtime cho nghiệp vụ dự án, tài liệu dự án và bình luận/@thành viên. Không tạo endpoint giả thành công cho các phần này. API tạo hiện lưu lịch sử nhưng chưa phát sự kiện realtime; nhóm cần bổ sung outbox theo rule trước khi nghiệm thu luồng realtime đầy đủ.

## Chạy và kiểm tra

Chạy bằng Java 21; không đổi mật khẩu .env hay môi trường Docker của người khác. Work Service thực tế cần MySQL, Config Server và Eureka/Identity hoạt động theo cấu hình dự án.

```sh
./mvnw -B -pl services/work-service,platform/api-gateway -am verify
python3 scripts/test-project-foundation.py
```

Script tích hợp chỉ tạo MySQL tạm, chạy Gateway/Work JAR bằng cổng ngẫu nhiên và Identity stub cục bộ. Không đọc .env, không sửa container/database đang dùng và không gửi email. Kiểm tra gán Owner từ phiên, dữ liệu không hợp lệ, tên trùng khác hoa/thường, tên trùng khác Owner, cạnh tranh đồng thời, rollback khi tạo membership thất bại và sự thống nhất project/membership/lịch sử. Stub kiểm tra hợp đồng xác thực; nó không thay kiểm thử mật mã JWT hoặc logout trên Identity thật.

## Tích hợp frontend tạo/sửa

Danh sách, ID, role, version và thông tin dự án lấy từ API qua Gateway. Frontend không tạo ID giả hoặc lấy role từ dữ liệu mẫu. Sau POST/PUT thành công, cache dùng nguyên phản hồi máy chủ; cache tách theo tài khoản và bỏ phản hồi danh sách đã lỗi thời. Tải lại trang đọc lại dữ liệu đã lưu.

Form sửa giữ nội dung khi version thay đổi; lỗi 409 giữ nội dung, đọc phiên bản hiện tại và yêu cầu xác nhận trước khi nạp đè. Trong lúc lưu không cho đóng modal hoặc gửi lặp. Form tạo chờ POST thành công mới đóng; lỗi giữ nguyên dữ liệu nhập. Chưa hiển thị thao tác archive hoặc chọn ảnh dự án vì chưa có API lưu tương ứng. Công việc/lời mời/thống kê còn là giao diện mẫu.

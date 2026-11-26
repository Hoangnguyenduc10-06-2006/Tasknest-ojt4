# Quy tắc tổ chức và phát triển frontend TaskNest

Áp dụng cho React, TypeScript và Tailwind CSS trong thư mục `frontend/`. Tài liệu quy định cách chia source dựa trên các trang giới thiệu, đăng nhập, đăng ký và quên mật khẩu hiện có. Không thay đổi yêu cầu nghiệp vụ trong RULE/SRS hoặc tự lựa chọn thêm thư viện.

Đây là quy ước để lập trình và review; việc tạo tài liệu không tự bổ sung bộ kiểm tra kiến trúc vào ESLint/CI.

## 1. Ba khu vực chính

| Khu vực | Trách nhiệm | Ví dụ |
|---|---|---|
| `src/app` | Khởi tạo, ghép các feature, điều hướng và bố cục toàn ứng dụng | `App.tsx`, `router`, AppLayout khi triển khai |
| `src/features/<feature>` | Màn hình, giao diện và logic của một phân hệ | auth, projects, tasks, time-tracking |
| `src/shared` | UI và hạ tầng dùng chung, không chứa nghiệp vụ của một feature | Button, TextField, HTTP client, theme |

**FE-ORG-01:** Giữ tên `features`; không tạo thêm `modules` để tổ chức cùng một nhóm chức năng.

**FE-ORG-02:** Tổ chức theo nghiệp vụ. Không gom mọi page, form, hook hoặc API của toàn ứng dụng vào các thư mục chung cùng tên ở gốc `src`.

**FE-ORG-03:** Chỉ tạo thư mục/file khi có nhu cầu thực tế. Feature nhỏ không bắt buộc có đủ mọi lớp; form đơn giản có thể giữ state ngay trong component.

**FE-ORG-04:** Code có một trách nhiệm rõ ràng. Tách khi một phần có nghiệp vụ riêng, có thể tái sử dụng, cần kiểm thử độc lập hoặc làm file hiện tại khó đọc. Không tách máy móc theo số dòng.

## 2. Cấu trúc chuẩn

Cây dưới đây là mẫu mở rộng; các file về task, modal, layout toàn ứng dụng và realtime là ví dụ, chưa phải chức năng đã được triển khai.

```text
src/
├── app/
│   ├── App.tsx
│   ├── router/
│   ├── layouts/                     # Bố cục toàn ứng dụng khi cần
│   └── providers/                   # Khởi tạo context/hạ tầng khi cần
├── features/
│   ├── auth/
│   │   ├── pages/                   # LoginPage, RegisterPage...
│   │   ├── components/              # LoginForm, AuthCardLayout...
│   │   ├── hooks/                   # useRegisterForm...
│   │   ├── model/                   # Types, validation, logic thuần
│   │   ├── mocks/                   # Dữ liệu/hàm xử lý mẫu
│   │   └── index.ts
│   └── tasks/
│       ├── pages/                   # ProjectTasksPage, TaskDetailPage
│       ├── components/
│       │   ├── TaskCard.tsx
│       │   ├── TaskForm.tsx
│       │   ├── TaskBoard.tsx
│       │   └── modals/
│       │       ├── CreateTaskModal.tsx
│       │       └── ReviewTaskModal.tsx
│       ├── hooks/                   # useTasks, useCreateTask...
│       ├── api/                     # tasks.api.ts, tasks.dto.ts
│       ├── model/                   # task.types, validation, permissions
│       ├── realtime/                # Xử lý sự kiện nghiệp vụ task
│       ├── mocks/
│       └── index.ts
├── shared/
│   ├── ui/                          # Button, TextField, Modal...
│   ├── api/                         # HTTP client, lỗi API chung
│   ├── theme/                       # useTheme, ThemeSwitcher
│   ├── realtime/                    # Hạ tầng kết nối khi triển khai
│   ├── hooks/                       # Hook không phụ thuộc nghiệp vụ
│   ├── utils/                       # Format ngày/giờ, helper chung
│   └── types/                       # Kiểu thực sự dùng chung
├── assets/                          # Logo, font, tài nguyên dùng chung
├── styles.css                       # Tailwind và bảng màu chung
└── main.tsx
```

**FE-ORG-05:** Dùng `shared/ui` thống nhất; không tạo song song `shared/components` cho cùng nhóm Button/Input/Modal.

**FE-ORG-06:** Types/helper chỉ dùng ở một component được đặt ngay file đó. Khi nhiều file cùng feature cần dùng, chuyển vào `model`; chỉ đưa vào `shared` khi dùng chung ngoài feature và không phụ thuộc nghiệp vụ riêng.

## 3. Quyết định một thành phần nằm ở đâu

| Thành phần | Vị trí | Quy tắc |
|---|---|---|
| Page | `features/<feature>/pages` | Một màn hình tương ứng URL, ghép layout và component |
| Form | `features/<feature>/components` | Các trường nhập, lỗi, thao tác gửi của một nghiệp vụ |
| Component nghiệp vụ | `features/<feature>/components` | Biết về task/project/member của feature |
| Modal nghiệp vụ | `features/<feature>/components/modals` | Ví dụ CreateTaskModal, InviteMemberModal |
| Khung Modal chung | `shared/ui/Modal.tsx` | Chỉ quản lý hiển thị, focus và đóng/mở; không biết task/project |
| Layout của riêng feature | `features/<feature>/components` | AuthCardLayout dùng cho các trang xác thực |
| Layout toàn ứng dụng | `app/layouts` | Sidebar, Topbar, vùng nội dung chung khi triển khai |
| Hook nghiệp vụ | `features/<feature>/hooks` | Dữ liệu, thao tác hoặc state phức tạp của feature |
| API nghiệp vụ | `features/<feature>/api` | Method/path, request/response và ánh xạ lỗi của feature |
| Validation/quyền/kiểu nghiệp vụ | `features/<feature>/model` | Logic thuần, có thể kiểm thử không cần render React |
| UI tái sử dụng | `shared/ui` | Button, TextField, PasswordField, EmptyState... |
| Test | Cạnh file được kiểm tra | `register.validation.test.ts`, `client.test.ts` |

Không cần thư mục `forms` riêng lúc chỉ có vài form. Khi `components` của một feature có nhiều form, có thể nhóm thành `components/forms`; thống nhất trong feature thay vì để cùng loại file ở nhiều nơi.

## 4. Page, layout và component

**FE-PAGE-01:** Page chủ yếu ghép màn hình: đọc tham số điều hướng, gọi hook cần thiết, hiển thị các trạng thái và kết nối component. Không nhét toàn bộ form, modal, bảng và HTTP vào page.

**FE-PAGE-02:** `App.tsx` chỉ ghép route/page và các thành phần khởi tạo. Không chứa chi tiết form hay nghiệp vụ của từng màn hình.

**FE-PAGE-03:** URL quyết định màn hình. Không dùng một biến `view` độc lập với URL cho toàn ứng dụng. Điều hướng phải hoạt động khi mở URL trực tiếp, tải lại, Quay lại và Tiến tới. Cơ chế route hiện tại là tạm thời; bổ sung thư viện router phải thống nhất trong nhóm.

**FE-PAGE-04:** Layout chỉ cung cấp khung và nhận nội dung qua `children`/props. Không tự gửi form hoặc gọi API của màn hình con.

**FE-PAGE-05:** Trang giới thiệu dùng bố cục hai bên và nút Bắt đầu ngay. Đăng nhập, đăng ký, quên mật khẩu dùng AuthCardLayout với một thẻ form ở giữa.

**FE-COMP-01:** Component nghiệp vụ nhận dữ liệu và callback qua props, hoặc dùng hook của chính feature khi cần. Component chung chỉ nhận props tổng quát, không gọi API nghiệp vụ.

**FE-COMP-02:** Dùng lại Button/TextField/PasswordField và component chung trước khi tạo phiên bản mới. Khi cần biến thể, bổ sung props có ý nghĩa thay vì sao chép cả component hoặc truyền class màu để ghi đè tùy từng màn hình.

## 5. Form và hook

**FE-FORM-01:** Form quản lý các trường nhập, gắn lỗi đúng trường và phát thao tác submit. Logic validation tách vào `model` khi có nhiều quy tắc hoặc cần tái sử dụng/kiểm thử.

**FE-FORM-02:** Form đơn giản như ForgotPasswordForm có thể dùng state cục bộ và validation HTML. Khi có validation nhiều trường, pending, lỗi máy chủ và nhiều nhánh xử lý như đăng ký, tách hook `use...Form`. Không bắt buộc tạo một hook chỉ để bọc một `useState`.

**FE-FORM-03:** Chuẩn hóa theo hợp đồng: trim họ tên/email khi phù hợp; không trim hoặc đổi hoa/thường mật khẩu. Validation frontend phục vụ trải nghiệm; backend vẫn kiểm tra lại.

**FE-FORM-04:** Khi gọi API thật, ngăn gửi lặp trong lúc pending. Chỉ báo thành công sau phản hồi hợp lệ. Lỗi phải giữ các giá trị không nhạy cảm để người dùng sửa hoặc thử lại.

**FE-FORM-05:** Input có label liên kết, `autoComplete` phù hợp; thông báo lỗi gắn qua `aria-describedby` và `aria-invalid` khi dùng lỗi tùy chỉnh. Không chỉ đổi màu viền để thông báo lỗi. Nút trong form phải có `type` rõ ràng.

**FE-FORM-06:** Đổi giao diện không làm mất nội dung form. Không ghi mật khẩu/token vào browser storage, URL hoặc log. Luồng quên mật khẩu thật không tiết lộ email có tồn tại.

**FE-HOOK-01:** Hook giữ logic liên quan React: tải dữ liệu, state, lifecycle và thao tác nghiệp vụ. Hàm format/validation thuần không cần đặt tên `use...` hoặc biến thành hook.

**FE-HOOK-02:** Cleanup listener/subscription khi unmount; hủy hoặc bỏ qua phản hồi cũ khi đổi điều kiện/unmount. Không để phản hồi cũ ghi đè dữ liệu mới.

## 6. Modal và drawer

**FE-MODAL-01:** Modal chung đặt ở `shared/ui`. Modal nghiệp vụ nằm trong feature. Ví dụ `shared/ui/Modal.tsx` không biết task; `features/tasks/components/modals/CreateTaskModal.tsx` ghép Modal với TaskForm và xử lý tạo nhiệm vụ.

**FE-MODAL-02:** State mở/đóng và đối tượng được chọn đặt tại component cha gần nhất điều khiển thao tác, thường là page hoặc component danh sách. Không đưa mọi modal lên App hoặc store toàn cục.

**FE-MODAL-03:** Modal nhận `open`, `onClose` và dữ liệu cần thiết qua props. Không tự đổi route hoặc tự tìm đối tượng đang chọn bằng biến toàn cục. Drawer nghiệp vụ áp dụng cùng cách phân chia.

**FE-MODAL-04:** Form có thể dùng trong page hoặc modal khi hành vi giống nhau. Khung modal không chứa lại toàn bộ các field. Nếu tạo/sửa khác nhau, dùng mode và props rõ ràng; không suy đoán từ tên URL hoặc nội dung nút.

**FE-MODAL-05:** Modal có tiêu đề, tên truy cập, focus ban đầu, giữ focus trong modal, trả focus về nút mở khi đóng và không cho thao tác nền trong khi mở. Hỗ trợ bàn phím; quy định rõ việc đóng bằng Escape/click nền, đặc biệt khi có dữ liệu chưa lưu hoặc thao tác đang gửi.

**FE-MODAL-06:** Khi API thành công mới đóng modal nếu luồng yêu cầu đóng, rồi cập nhật dữ liệu liên quan. Khi lỗi, giữ modal và nội dung nhập, hiển thị lỗi. Nếu cho đóng lúc pending, phải xử lý kết quả request vẫn có thể tiếp tục; không coi đóng modal là hủy thao tác máy chủ.

**FE-MODAL-07:** Reset nội dung khi bắt đầu một lượt tạo mới hoặc đổi đối tượng; không làm mất nội dung người dùng đang sửa do render lại, đổi theme hoặc nhận sự kiện không liên quan.

Ví dụ luồng tổ chức, chưa phải code đã triển khai:

```text
ProjectTasksPage
  ├── TaskBoard / TaskList
  └── CreateTaskModal             features/tasks/components/modals
        └── Modal                shared/ui
              └── TaskForm       features/tasks/components
                    └── useCreateTask / validation
                          └── tasks.api
                                └── shared/api/client → Gateway
```

Khung props tham khảo:

```ts
type CreateTaskModalProps = {
  open: boolean;
  projectId: string;
  onClose: () => void;
  onCreated: () => void;
};
```

Modal dùng callback thông báo hoàn thành; component cha/hệ thống quản lý dữ liệu quyết định cách cập nhật danh sách. Không buộc các màn hình tự tải lại cả trang.

## 7. API, state và realtime

**FE-API-01:** API nghiệp vụ ở `features/<feature>/api`; request đi qua HTTP client chung trong `shared/api` tới Gateway bằng đường dẫn tương đối `/api/...`. Không gọi trực tiếp cổng service, không rải `fetch` trong page/form/modal.

**FE-API-02:** Method/path, DTO, trạng thái và mã lỗi phải theo hợp đồng FE/BE. Kiểm tra dữ liệu tại ranh giới response; ép kiểu TypeScript không thay validation runtime. Phân biệt lỗi validation, quyền, xung đột, rate limit và mất kết nối.

**FE-API-03:** Client chung hiện mới có GET. Trước tích hợp API ghi, bổ sung hỗ trợ method/body/204/lỗi/timeout/cookie/CSRF theo hợp đồng. Không tự retry request ghi hoặc tự tạo token CSRF để bỏ qua cơ chế backend.

**FE-STATE-01:** State UI cục bộ nằm gần nơi sử dụng: tab, mở modal, nhập form, hiện mật khẩu. State dùng chung nhiều màn hình như phiên đăng nhập hoặc timer cần một nguồn thống nhất khi triển khai; không tự cài store mới cho mỗi feature.

**FE-STATE-02:** Không sao chép cùng dữ liệu server vào nhiều state độc lập rồi cập nhật lệch nhau. Sau mutation hoặc realtime, cập nhật/tải lại đúng dữ liệu liên quan và giữ các bộ lọc hiện có.

**FE-STATE-03:** Loading, empty, không khớp bộ lọc, lỗi và không có quyền là các trạng thái riêng. Không biến lỗi API thành danh sách trống hoặc thống kê 0.

**FE-RT-01:** Hạ tầng kết nối dùng chung nằm trong `shared/realtime` khi triển khai. Cách xử lý sự kiện task/project/notification nằm trong feature tương ứng. Không mở một kết nối riêng cho mỗi card/modal.

**FE-RT-02:** Reconnect phải lấy lại trạng thái mới nhất; không ghi đè form đang sửa một cách âm thầm. Thay đổi quyền phải cập nhật cả thao tác UI và việc nhận dữ liệu; backend quyết định quyền cuối cùng.

## 8. Import và xuất công khai

```text
app → features → shared
```

**FE-IMPORT-01:** `shared` không import từ `features` hoặc `app`. Feature không import từ `app`.

**FE-IMPORT-02:** Trong cùng feature có thể import trực tiếp file nội bộ. Từ app hoặc feature khác, ưu tiên API công khai qua `features/<feature>/index.ts`; không truy cập sâu vào nội bộ của feature khác.

**FE-IMPORT-03:** Hai feature cần phối hợp thì ưu tiên ghép ở page/layout phù hợp hoặc dùng API công khai nhỏ. Không tạo import vòng; chỉ đưa phần độc lập thực sự vào shared, không chuyển cả nghiệp vụ sang shared để né phụ thuộc.

**FE-IMPORT-04:** `index.ts` chỉ export phần bên ngoài cần dùng. Không export toàn bộ file nội bộ hoặc tạo barrel cho mọi thư mục nhỏ. Hàm mock chỉ được nối rõ ràng ở nơi cấu hình bản mẫu; không export như API production.

## 9. Màu sắc, đặt tên và chất lượng code

**FE-UI-01:** Dùng màu theo vai trò từ `styles.css`: `canvas`, `surface`, `field`, `panel`, `line`, `ink`, `muted`, `accent`, `on-accent`, `tint`, `danger`, `success`. Nút dùng `hover:bg-accent-hover`. Không hardcode bộ màu riêng cho từng page; màu dữ liệu đặc thù được bổ sung có chủ đích vào bảng màu chung.

**FE-UI-02:** Sáng/Tối/Theo hệ thống dùng chung ThemeSwitcher và useTheme. Thành phần chỉ cần đổi màu thì dùng token CSS, không tự tạo state theme. Không làm mới trang chỉ để đổi theme.

**FE-UI-03:** Dùng Tailwind, kiểm tra desktop/mobile, vùng cuộn, chữ dài và nội dung lỗi. Nếu cần CSS riêng, giới hạn phạm vi để không tác động form/modal ở màn hình khác.

**FE-NAME-01:** Component: `PascalCase.tsx`; page: `...Page.tsx`; form: `...Form.tsx`; modal: `...Modal.tsx`; hook: `use...ts`; model/API: `task.types.ts`, `task.validation.ts`, `tasks.api.ts`. Tên file/hàm dùng tiếng Anh; nội dung UI dùng tiếng Việt.

**FE-NAME-02:** Function component, indent 2 spaces, TypeScript strict và ESLint hiện có. Dùng `import type` cho type; không dùng `any`, tắt lint hoặc ép kiểu để che lỗi. Không format lại các file ngoài phạm vi task.

**FE-NAME-03:** Dữ liệu nghiệp vụ dùng mã theo hợp đồng, nhãn tiếng Việt chỉ dùng để hiển thị. Không dùng văn bản thông báo lỗi hoặc tên nút làm điều kiện nghiệp vụ.

### Timer và shell toàn ứng dụng

- Navbar/Sidebar trong `app/layouts/components` nhận hồ sơ, dự án gần đây và số thông báo từ dữ liệu phiên làm việc qua props.
- `features/time-tracking` sở hữu model và hai cách hiển thị `TimerPill`, `ActiveTimerCard`. App ghép TimerPill qua slot Navbar; dashboard dùng public API của feature này. Hai nơi dùng cùng một snapshot và callback dừng, không có đồng hồ nghiệp vụ riêng trong Navbar.
- `useServerTimer` dùng phiên ghi giờ đã lưu trên máy chủ và chia sẻ cùng trạng thái giữa Navbar và dashboard.
- Router ở `app/router` xử lý link nội bộ bằng History API và hỗ trợ mở tab mới, link ngoài, Quay lại và Tiến tới. URL lạ hiển thị trang 404. Chỉ `/` là trang giới thiệu.
- Sidebar mobile dùng native modal dialog để khóa nền và quản lý focus; layout giữ state mở/đóng. Không ẩn menu tương tác chỉ bằng transform.

## 10. Mock, ví dụ hiện có và kiểm tra hoàn thành

**FE-MOCK-01:** Dữ liệu/hàm xử lý mẫu nằm trong `mocks` của feature, có tên rõ ràng và được nối tường minh. API thật thất bại không được fallback sang mock rồi báo thành công.

**FE-MOCK-02:** Đăng ký, xác nhận email, đăng nhập, gia hạn, đăng xuất và quên mật khẩu dùng Identity API qua Gateway. Dashboard lấy dữ liệu từ workspace đã xác thực. Access Token chỉ giữ trong bộ nhớ. Refresh Token do cookie HttpOnly quản lý.

Tham khảo source hiện có:

| Cần học cách làm | File |
|---|---|
| Ghép page và form | [RegisterPage.tsx](src/features/auth/pages/RegisterPage.tsx) |
| Bố cục xác thực dùng chung | [AuthCardLayout.tsx](src/features/auth/components/AuthCardLayout.tsx) |
| Form có nhiều trường/lỗi | [RegisterForm.tsx](src/features/auth/components/RegisterForm.tsx) |
| Hook quản lý form | [useRegisterForm.ts](src/features/auth/hooks/useRegisterForm.ts) |
| Validation độc lập React | [register.validation.ts](src/features/auth/model/register.validation.ts) |
| Form đơn giản giữ state cục bộ | [ForgotPasswordForm.tsx](src/features/auth/components/ForgotPasswordForm.tsx) |
| UI dùng lại | [TextField.tsx](src/shared/ui/TextField.tsx), [Button.tsx](src/shared/ui/Button.tsx) |
| Bộ màu và theme | [styles.css](src/styles.css), [ThemeSwitcher.tsx](src/shared/theme/ThemeSwitcher.tsx) |

**FE-CHECK-01:** Test đặt cạnh logic được kiểm tra, tập trung vào quy tắc nghiệp vụ, quyền, lỗi API, xung đột và lifecycle có rủi ro. Không viết test chỉ để xác nhận component tồn tại hoặc lặp lại nguyên implementation.

**FE-CHECK-02:** Trước bàn giao, kiểm tra luồng chính, dữ liệu lỗi, loading/lỗi API khi đã tích hợp, Sáng/Tối, bàn phím, màn hình nhỏ và Quay lại/Tiến tới. Với modal phải kiểm tra focus và dữ liệu chưa lưu.

**FE-CHECK-03:** Chạy các lệnh phù hợp với thay đổi, từ thư mục gốc:

```sh
npm --prefix frontend run typecheck
npm --prefix frontend run lint
npm --prefix frontend test
npm --prefix frontend run build
```

PR ghi rõ phần UI, mock hay API thật; phạm vi file, kết quả kiểm tra và ảnh giao diện khi có thay đổi UI. Không ghi hoàn tất nghiệp vụ nếu mới có giao diện mẫu.

## 11. Trình tự làm một chức năng mới

1. Xác định feature, màn hình/URL, Figma, quyền, trạng thái và hợp đồng API liên quan.
2. Tìm component dùng chung sẵn có; tạo thêm phần chung khi có nhu cầu tái sử dụng rõ ràng.
3. Làm page để ghép bố cục; tách form, bảng và modal nghiệp vụ vào components.
4. Đặt state gần nơi sử dụng; tách hook/model khi logic cần độc lập hoặc phức tạp hơn.
5. Tích hợp API qua client chung khi hợp đồng sẵn sàng; nếu chỉ làm mẫu, tách mock và ghi rõ trạng thái.
6. Kiểm tra luồng, quyền, lỗi, theme, responsive và phần bị ảnh hưởng; gửi review theo CONTRIBUTING.md.

## 12. Bảo vệ route và phiên đăng nhập

- `app/router/ProtectedRoute.tsx` bao các trang nội bộ; chỉ trang giới thiệu, đăng nhập, đăng ký, quên mật khẩu và xác nhận email được mở công khai. Dashboard, trang chi tiết, hồ sơ, thông báo, trang phiên và trang kiểm tra service đều cần phiên hợp lệ.
- Không dùng cờ localStorage/sessionStorage hoặc chỉ kiểm tra token tồn tại để quyết định đăng nhập. `features/auth/model/session.store.ts` giữ snapshot trong bộ nhớ; `GET /api/identity/auth/session` xác nhận người dùng hiện tại sau khi backend kiểm tra JWT và trạng thái phiên.
- Khi tải lại trang, khôi phục bằng Refresh Token HttpOnly với CSRF, rồi kiểm tra phiên; chưa có kết quả thì không render nội dung được bảo vệ. Backend lỗi/mất kết nối hiển thị thử lại, không fallback sang dashboard mẫu.
- Access Token chỉ ở bộ nhớ; refresh được phối hợp bằng một promise trong mỗi tab và Web Locks khi trình duyệt hỗ trợ để tránh các tab xoay cùng cookie đồng thời.
- `returnTo` chỉ chấp nhận trang nội bộ được nhận diện; dùng history replace khi chuyển sang đăng nhập hoặc quay lại trang đích để tránh vòng lặp Quay lại và open redirect.
- Đăng xuất phải gọi backend thành công, xóa trạng thái cục bộ và thông báo các tab cùng origin qua BroadcastChannel. Phản hồi kiểm tra phiên cũ không được khôi phục quyền sau đăng xuất.
- Kiểm tra lại phiên khi đổi trang, quay lại tab, khôi phục trang từ cache, định kỳ 60 giây và trước hạn Access Token. Router guard bảo vệ giao diện; backend vẫn phải kiểm tra JWT/quyền ở mỗi API nghiệp vụ.

## Trang hồ sơ cá nhân

- `features/profile/pages/ProfilePage.tsx` ghép form hồ sơ; route `/profile` đi qua `ProtectedRoute`. Họ tên/email/trạng thái xác minh/chức danh/giới thiệu lấy từ phiên được backend xác nhận.
- `components/ProfileForm.tsx` quản lý hiển thị, `hooks/useProfileForm.ts` giữ dữ liệu đang sửa và thao tác lưu, `model/profile.validation.ts` kiểm tra dữ liệu, `api/profile.api.ts` gọi API qua Gateway. Không đưa chọn giao diện vào nội dung hồ sơ; Navbar sử dụng `shared/theme`.
- Nút Lưu hồ sơ gọi `PUT /api/identity/profile` với Access Token, CSRF và phiên bản hồ sơ. Chỉ báo thành công sau phản hồi server; cập nhật snapshot tài khoản để Navbar hiển thị tên mới. Khi lỗi giữ nội dung nhập; HTTP 409 yêu cầu tải lại để tránh ghi đè thay đổi từ nơi khác.
- Ảnh được kiểm tra tại frontend và backend. Backend giải mã PNG/JPG, giới hạn 5 MB, chiều tối đa 4096 pixel và 16 triệu pixel; mã hóa lại PNG để bỏ metadata/nội dung đính kèm. Dữ liệu ảnh lưu trong bảng `user_avatars`; lấy qua GET được xác thực, không nhúng JWT vào URL ảnh. Object URL phía trình duyệt được giải phóng khi thay ảnh/rời trang.
- Client chỉ gửi fullName, jobTitle, bio, version và avatarBase64 (nếu chọn ảnh mới). Server xác định người dùng từ JWT, không cho đổi email, quyền hoặc tư cách xác minh bằng payload.

### Bộ thành phần giao diện thống nhất

- `shared/ui/Badge.tsx`: nhãn nhỏ hình chữ nhật bo góc; dùng `tone` (`neutral`, `blue`, `green`, `amber`, `red`, `purple`). Component nghiệp vụ chỉ ánh xạ trạng thái sang nhãn và tone, không tự dựng bảng màu.
- `shared/ui/Button.tsx`: dùng `variant` hoặc `kind`, có `icon`, loading, disabled và đầy đủ thuộc tính button. Primary cho hành động chính, secondary cho hành động phụ, ghost cho thao tác nhẹ, danger cho thao tác phá hủy.
- `shared/ui/Icon.tsx`: bộ SVG từ mẫu, không dùng emoji thay icon thao tác.
- `shared/ui/Avatar.tsx`: avatar chữ viết tắt; ảnh người dùng thật tiếp tục sử dụng endpoint ảnh được bảo vệ.
- `shared/ui/Panel.tsx`: khối nội dung có border, nền surface, bo góc và khoảng đệm chung.
- Màu trạng thái lấy từ semantic tokens trong `styles.css`, hỗ trợ cả sáng và tối. Không ghi màu riêng cho từng trang để giả lập dark mode.
- Bố cục responsive giữ sidebar và navbar chung. Trang chi tiết dùng nội dung chính và sidebar thao tác; xuống một cột ở màn hình nhỏ.
- File mẫu dùng để tham khảo cách tổ chức giao diện. Không sao chép dữ liệu mẫu, vai trò giả lập hoặc thao tác chỉ thay đổi state vào luồng nghiệp vụ thật.

# TaskNest — Trợ lý AI (chặng 1–3)

## Phạm vi

Service `ai-service` (Spring Boot), Gateway `/api/ai/**`, dùng Groq hoặc
OpenRouter qua API OpenAI-compatible.
Có cửa sổ trợ lý trên các trang đã đăng nhập. Mỗi câu hỏi được xử lý độc lập.
Người dùng có thể chọn một nhiệm vụ; backend gọi API Work bằng phiên hiện tại,
chỉ gửi trạng thái, lịch, ước tính và giờ được phép xem của nhiệm vụ đó đến nhà cung cấp AI.
Không gửi mô tả, bình luận, tài liệu hoặc tệp. Chưa có công cụ thay đổi dữ liệu.
Không tự chuyển sang model/nhà cung cấp trả phí.

Luồng: frontend/API client → Gateway → kiểm tra phiên Identity → ai-service → kiểm tra lại phiên Identity → quota MySQL → HTTPS provider.

Cấu trúc: `api/` chứa controller/DTO/lỗi; `application/` chứa ca sử dụng và interface provider;
`config/` chứa bảo mật/HTTP/configuration; `infrastructure/groq/`, `identity/`, `persistence/` chứa adapter.

## 1. Chọn nhà cung cấp AI

### Groq

1. Mở https://console.groq.com và đăng ký/đăng nhập.
2. Kiểm tra tài khoản đang ở Free Plan, không nâng cấp Developer Plan cho bản thử nghiệm.
3. Mở https://console.groq.com/keys → Create API Key; đặt tên `tasknest-local` và lưu khóa vào trình quản lý mật khẩu.
4. Trong Settings → Data Controls, bật Zero Data Retention trước khi dùng dữ liệu thật.
5. Kiểm tra model được phép dùng và Limits trong tài khoản. Hạn mức nhà cung cấp có thể thay đổi.

Tài liệu: https://console.groq.com/docs/quickstart, https://console.groq.com/docs/rate-limits,
https://console.groq.com/docs/your-data. ChatGPT Plus không liên quan đến API key Groq.
Không gửi khóa vào chat, Git, frontend hoặc ảnh chụp màn hình.

### OpenRouter Free (khuyến nghị khi Groq hết quota)

1. Tạo API key tại https://openrouter.ai/keys.
2. Dùng model `openrouter/free`: OpenRouter tự chọn một model miễn phí còn khả dụng.
3. Không dùng model trả phí nếu chưa chủ động nạp tiền/đặt ngân sách.

Free tier có rate limit phía OpenRouter; cấu hình TaskNest dưới 50 request/ngày để
chừa chỗ cho request lỗi. Danh sách model miễn phí thay đổi theo thời điểm.
Tài liệu: https://openrouter.ai/collections/free-models.

## 2. Chuẩn bị local

Chạy ở thư mục gốc dự án; cần Java 21, Docker đang chạy và `.env` hiện tại.
Nếu clone mới chưa có `.env`, chạy `python3 scripts/setup-local.py` trước.

```bash
python3 scripts/setup-ai.py
```

Script bổ sung `AI_DB_PASSWORD` nếu thiếu, tạo `tasknest_ai` và tài khoản riêng,
không xóa dữ liệu hay thay mật khẩu có sẵn. Có thể chạy lại. Chỉ thực hiện trên Compose local.
Nếu database/user AI đã tồn tại nhưng mật khẩu không khớp, cần kiểm tra cấu hình;
script không tự đổi mật khẩu để tránh làm hỏng phiên bản đang dùng.

Mở `.env` bằng IDE và chọn **một** provider (không tạo dòng trùng).

Groq:

```dotenv
AI_ENABLED=true
AI_PROVIDER=groq
AI_API_KEY=dan_api_key_groq_cua_ban
AI_MODEL=openai/gpt-oss-120b
```

OpenRouter Free:

```dotenv
AI_ENABLED=true
AI_PROVIDER=openrouter
AI_API_KEY=sk-or-v1-chi_luu_o_backend
AI_MODEL=openrouter/free
AI_USER_DAILY_LIMIT=10
AI_GLOBAL_DAILY_LIMIT=45
```

`AI_DB_PASSWORD` giữ giá trị script đã tạo. Không chạy `source .env`.

```bash
JAVA_HOME=$(/usr/libexec/java_home -v 21) ./mvnw -B -pl services/ai-service -am package -DskipTests
bash scripts/compose.sh up -d --wait config-server discovery-server identity-service
bash scripts/compose.sh --profile ai up -d --build --wait --wait-timeout 300 ai-service
bash scripts/compose.sh restart api-gateway
```

Config Server đọc file cấu hình được mount từ repo. Gateway cần restart để nhận route mới.
Nếu chỉ đổi API key trong `.env`, chạy lại lệnh `up ... ai-service` để recreate container;
`docker restart` không nạp biến môi trường mới. Không có cổng AI công khai.

## 3. Kiểm tra API

Qua frontend local `http://localhost:3000` hoặc cùng origin đang cấu hình.
Các request đều cần `Authorization: Bearer <Access Token hiện tại>`; token chỉ giữ trong bộ nhớ.
Có thể dùng Postman: Authorization → Bearer Token. Không ghi token vào file đã commit.

- `GET /api/ai/status`: tên service, provider, model, configured và `businessDataAccess: true` (phạm vi một nhiệm vụ được chọn).
- `POST /api/ai/chat`, Content-Type `application/json`:

```json
{"message":"Đề xuất cách chia một nhiệm vụ lớn thành các bước nhỏ."}
```

Ví dụ response:

```json
{"success":true,"data":{"text":"Nội dung trả lời…","model":"openai/gpt-oss-120b","sources":[]}}
```

Frontend dùng timeout riêng 55 giây cho API AI; các API khác giữ timeout cũ.
Output AI phải hiển thị dạng text/Markdown đã lọc, không thực thi HTML hoặc mã trả về.

Mã lỗi: 401 phiên không hợp lệ; 403 email chưa xác minh; 400 câu hỏi rỗng/>1.000 ký tự;
413 request >8 KiB; 429 đạt quota (đọc header `Retry-After`); 503 chưa cấu hình, Identity/quota/provider không sẵn sàng.
Không trả nguyên lỗi nhà cung cấp cho client. Không tự retry lời gọi đã gửi provider.

## 4. Hạn mức và dữ liệu

- 20 request/người/ngày; 100 request/toàn hệ thống/ngày.
- 2 request/phút; 8.000 token dự trù/phút; 200.000 token dự trù/ngày.
- Tối đa 1.500 completion token, bao gồm phần token suy luận theo cơ chế provider.
- Ngày tính theo Asia/Ho_Chi_Minh; phút là cửa sổ cố định, không phải cửa sổ trượt.
- Mọi giới hạn áp dụng đồng thời; có thể đạt hạn mức token trước hạn mức số request.
- Dự trù đầu vào bằng số byte UTF-8 + overhead và đầu ra tối đa; thận trọng hơn mức sử dụng thực.
- Bộ đếm MySQL có transaction, chống vượt quota khi gọi đồng thời, giữ qua restart;
  lỗi đã gửi provider vẫn tính lượt. Counter quá hạn được dọn khi có request mới.
- Chỉ lưu counter; không lưu nội dung câu hỏi/trả lời. Không log key, token hoặc prompt.
- Chỉ một API key của ứng dụng dùng quota này. Dùng cùng key ở Playground/ứng dụng khác vẫn có thể làm hết quota provider.
- `AI_ENABLED=false` trả 503 có mã rõ ràng; các API nghiệp vụ khác không phụ thuộc AI.

## 5. CI/CD và VPS

CI kiểm thử module AI, JAR/MySQL cô lập và publish image `ai-service` cùng release.
Profile `ai` mặc định tắt nên không thay đổi cách chạy các service hiện có.
Không cần API key thật trong CI; kiểm thử provider dùng HTTP mock.

Trước khi bật trên VPS: cấu hình riêng `AI_DB_PASSWORD`, tạo database/user `tasknest_ai`
(với quyền chỉ trên `tasknest_ai.*`) và thêm `AI_ENABLED`, `GROQ_API_KEY`, `GROQ_MODEL`
vào `.env` của VPS. Dùng `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL` cho provider được chọn; không sao chép API key local vào repo.
Với checkout có sẵn trên VPS có thể dùng `python3 scripts/setup-ai.py` từ thư mục checkout.
Script này chỉ dùng base Compose của checkout, không tự chọn deployment release hiện hành.

Thêm `COMPOSE_PROFILES=ai` vào `.env` của VPS sau khi chuẩn bị database để lần deploy kế tiếp
khởi chạy image AI của đúng release. Thiếu DB/credential sẽ khiến profile AI không healthy;
không bật profile trước khi tạo database. Khi chưa bật, route AI vẫn được bảo vệ nhưng service chưa có trong Discovery.

Kiểm tra trước khi bàn giao chặng 1:

```bash
./mvnw -B -pl services/ai-service,platform/api-gateway -am verify
python3 scripts/test-ai-foundation.py
```

Test tích hợp tạo/xóa MySQL tạm, không chạm database đang chạy và không gọi provider thật.
Cần một lần thử bằng key thật sau khi người dùng cấu hình; chưa coi HTTP mock là xác nhận provider hoạt động.

## Giao diện trợ lý và dữ liệu nhiệm vụ

Nút **Trợ lý AI** ở góc phải bên dưới các trang đã đăng nhập. Chọn tư vấn chung
hoặc một nhiệm vụ, nhập câu hỏi rồi gửi. Backend tải lại dữ liệu bằng phiên hiện tại;
frontend không tự gửi bản chụp dữ liệu hoặc quyền. Mất quyền thì dừng trước khi gọi provider.

Nguồn TSK, deadline, giờ ước tính và giờ được phép xem do backend tạo, hiển thị riêng
để đối chiếu với lời giải thích của model. Các con số trong câu trả lời AI vẫn cần kiểm tra.
Giờ không được xem giữ nguyên trạng thái ẩn; AI không dùng tài khoản service đặc quyền.

Hội thoại chỉ nằm trong bộ nhớ trình duyệt, tối đa 10 lượt hiển thị; bị xóa khi tải lại,
đăng xuất hoặc đổi tài khoản. Lịch sử không được gửi lại model. Câu trả lời hiển thị
dạng văn bản thuần, không thực thi HTML hoặc mã. Không tự gửi lại khi timeout/lỗi quota.

## Dashboard AI

`POST /api/ai/dashboard` tự tạo gợi ý khi mở dashboard hoặc khi dữ liệu nghiệp vụ thay đổi, kiểm tra lại mỗi 5 phút khi trang đang hiển thị. Không cần thao tác bấm nút.
Không có thẻ AI riêng: nhận định ngắn hiển thị trong lời chào, công việc cần chú ý,
chờ duyệt/cần duyệt và dưới các nhiệm vụ tương ứng. Model trả các phần nội dung có cấu trúc;
backend chỉ chấp nhận gợi ý cho mã nhiệm vụ trong snapshot đã cung cấp, giới hạn độ dài
và không đưa JSON lỗi lên giao diện. Số đếm và thứ tự danh sách nghiệp vụ không bị model ghi đè.
Backend đọc lại workspace theo phiên, thống kê riêng việc đang mở/quá hạn/chờ duyệt
của bản thân và việc người khác cần Owner/Manager hiện tại duyệt. Nhiệm vụ đã hoàn thành
hoặc hủy không nằm trong thống kê việc đang mở. Chỉ tối đa 3 nhiệm vụ tiêu biểu được gửi
cho provider, ưu tiên việc cần duyệt và deadline sớm. Không tuyên bố phân tích chi tiết toàn bộ nhiệm vụ.

Số liệu, liên kết nguồn do backend tính; lời giải thích do AI sinh. Tự gửi yêu cầu khi mở dashboard; debounce 1 giây, gộp các yêu cầu đang chạy theo tài khoản và không lặp khi trang bị ẩn. Kết quả lưu tối đa 5 phút trong bộ nhớ AI Service, riêng từng tài khoản,
không ghi vào database. Trước khi dùng lại cache luôn đọc lại quyền và dữ liệu;
snapshot thay đổi hoặc hết hạn thì tạo lại và tính quota. Workspace không có việc phù hợp
trả thông báo từ hệ thống, không gọi provider. Thất bại không được cache thành công.

### Gợi ý tự động trong chi tiết nhiệm vụ
- POST /api/ai/tasks/{taskId} lấy dữ liệu qua work-service bằng phiên hiện tại; kiểm tra quyền trước mỗi lần trả kết quả, kể cả cache.
- Gợi ý nằm cạnh deadline, thời gian và thao tác hiện có. Không tự chuyển trạng thái, ghi giờ hoặc thay đổi dữ liệu.
- Tự tải khi mở nhiệm vụ, khi dữ liệu/quyền thay đổi và kiểm tra lại sau 5 phút khi trang đang hiển thị. Kết quả cũ không dùng chung giữa tài khoản hoặc nhiệm vụ.
- Nội dung gửi gồm trạng thái, lịch, ước tính, giờ được phép xem và vai trò; chưa đọc bình luận hoặc tệp. Hạn mức provider vẫn áp dụng; lỗi AI không chặn nghiệp vụ.

### Bộ ưu tiên nghiệp vụ v1
Work-service tính decision từ dữ liệu đã được lọc quyền; không gọi provider.
Điểm: URGENT 25/HIGH 15/MEDIUM 8/LOW 0; quá hạn +50, hôm nay +35, trong 3 ngày +20; bị chặn +30; vượt ước tính +15 hoặc từ 80% +8 (không cộng cả hai). Tổng tối đa 100. Ngày theo Việt Nam; DONE/CANCELLED không cảnh báo; IN_REVIEW không tính cảnh báo giờ thực hiện.
Dashboard sắp xếp công việc cá nhân trong dự án hoạt động theo điểm giảm dần, rồi deadline và ID. Điểm chỉ để xếp thứ tự, không phải xác suất trễ hoặc năng suất. Không suy ra khối lượng còn lại từ giờ đã ghi.
Đây là nền thuật toán cho AI, chưa phải mô hình dự báo học từ lịch sử. AI không có quyền ghi đè điểm hoặc tự thao tác.

### Ngôn ngữ gợi ý trong giao diện
AI chỉ bổ sung một câu hướng xử lý dưới nhiệm vụ; không lặp lại số liệu, cảnh báo hoặc tên nút đã có. Không hiện đoạn tổng kết AI riêng ở dashboard hoặc cạnh từng trường trong chi tiết nhiệm vụ. Khi không có gợi ý hữu ích, để trống. Chi tiết nhiệm vụ chỉ hiện gợi ý bước tiếp theo cho người phụ trách khi đang thực hiện và không bị chặn. Nội dung có cấu trúc thô, thuật ngữ giao thức, câu khẳng định đã thao tác thay người dùng và câu trùng giải thích hệ thống được loại bỏ.

Gợi ý dashboard nhận điểm và lý do từ work-service, không tự tính lại. Trong từng nhóm, AI chọn ví dụ theo điểm giảm dần rồi deadline; mỗi ví dụ có phạm vi hành động riêng (xử lý vướng mắc, chờ phản hồi, duyệt kết quả hoặc lên kế hoạch cá nhân). Không yêu cầu AI tạo câu nếu chỉ có thể nhắc lại hướng xử lý của thuật toán.

### Xem trước câu trả lời và danh sách công việc

- Mỗi phản hồi trong Trợ lý AI có nút **Xem trước** để đọc riêng câu hỏi và
  nội dung đã định dạng. Nút **Về cuộc trò chuyện** giữ lịch sử và nội dung đang nhập.
- **Công việc cần làm** hiển thị toàn bộ nhiệm vụ đang giao cho người đăng nhập
  thuộc dự án hoạt động và còn cần thực hiện, kể cả nhiệm vụ bị chặn. Các lần nộp
  đang chờ duyệt thuộc luồng theo dõi riêng.
- Sắp xếp theo Khẩn cấp, Cao, Trung bình, Thấp. Khi cùng mức ưu tiên, xét điểm
  cảnh báo giảm dần rồi deadline gần nhất. Chọn tên nhiệm vụ để mở chi tiết.
- Danh sách lấy từ dữ liệu workspace đã xác thực. Mở danh sách không gửi thêm
  dữ liệu đến provider và không sử dụng hạn mức câu hỏi AI.

# Quy tắc Git, phối hợp code và quản lý config — TaskNest


## 1. Nguyên tắc làm việc

- `main` chứa phiên bản đã tích hợp; làm tính năng/sửa lỗi trên nhánh riêng và gửi Pull Request (PR).
- Một nhánh tập trung vào một task hoặc nhóm thay đổi có thể review cùng nhau.
- Trước khi bắt đầu việc và trước khi gửi PR, lấy thay đổi mới từ remote.
- Không push trực tiếp vào `main` trong công việc hằng ngày. Lần đưa bộ khung đầu tiên lên repository trống là bước riêng do người phụ trách thực hiện.
- Không force push nhánh dùng chung, không tự xóa commit/code của người khác để xử lý xung đột.
- PR cần một thành viên khác review và CI thành công trước khi merge. Đây là quy ước nhóm; hướng dẫn này không tự bật branch protection trên GitHub.
- Ưu tiên squash merge PR; xóa nhánh tính năng sau khi merge và không còn công việc cần giữ.

## 2. Đặt tên nhánh và commit

| Loại việc | Tên nhánh ví dụ |
|---|---|
| Tính năng | `feat/SCRUM-12-login` |
| Sửa lỗi | `fix/SCRUM-18-task-permission` |
| Cấu hình/hạ tầng | `chore/SCRUM-21-config-server` |
| Tái cấu trúc | `refactor/SCRUM-25-work-service` |

Commit theo dạng `type(scope): mô tả ngắn`, ví dụ:

```text
feat(identity): add email verification
fix(work): reject overlapping time entries
chore(infra): update gateway routes
refactor(frontend): extract theme hook
```

Không gom thay đổi nghiệp vụ, format toàn repo và nâng dependency không liên quan vào cùng một commit/PR.

## 3. Lấy dự án và chuẩn bị máy lần đầu

Sau khi bộ khung đã được push lên repository:

```sh
git clone https://github.com/KHANHAN007/TaskNest---OJT4.git
cd TaskNest---OJT4
python3 scripts/setup-local.py
```

Mỗi thành viên tự tạo `.env` trên máy. Không sao chép mật khẩu thật của máy chủ hoặc yêu cầu người khác gửi secrets trong nhóm chat. Cần Java 21, Docker/Compose và Python 3; phát triển frontend dùng Node 24 LTS.

Build/test và khởi chạy:

```sh
./scripts/dev.sh
```

Trên macOS có nhiều JDK, chọn trước khi build:

```sh
export JAVA_HOME=$(/usr/libexec/java_home -v 21)
```

Lệnh `setup-local.py` không ghi đè `.env` đã tồn tại. Các script `.sh` dùng shell tương thích; Windows có thể dùng WSL/Git Bash hoặc chạy lệnh tương đương với `mvnw.cmd`.

## 4. Bắt đầu một task mới

Trước hết kiểm tra thay đổi chưa lưu vào commit:

```sh
git status
```

Chỉ chuyển nhánh khi đã commit hoặc cất phần việc đang làm. Khi working tree sạch:

```sh
git switch main
git pull --ff-only origin main
git switch -c feat/SCRUM-12-login
```

`--ff-only` tránh tạo merge commit ngoài ý muốn khi cập nhật `main`. Nếu Git báo hai nhánh đã phân kỳ, kiểm tra lịch sử và trao đổi với người phụ trách tích hợp; không dùng `reset --hard` hoặc force push để bỏ qua lỗi.

## 5. Cập nhật task đang làm bằng code mới từ main

Commit phần việc hiện tại nếu đã có một mốc hợp lý. Sau đó, đứng trên nhánh task:

```sh
git fetch origin
git merge origin/main
```

Cách này giữ lịch sử đã push và phù hợp với nhánh có nhiều người cùng làm. Không cần checkout `main` rồi pull để cập nhật một nhánh tính năng đang mở.

Nếu cần cất thay đổi chưa commit trong thời gian ngắn:

```sh
git stash push -u -m "WIP before updating main"
git fetch origin
git merge origin/main
git stash pop
```

`-u` cất cả file mới chưa được theo dõi, nhưng không cất file ignored như `.env` và `local/`. `stash pop` cũng có thể phát sinh conflict; kiểm tra `git status` trước khi làm tiếp. Không dùng `git stash -a` để gom cả secrets và thư mục dependency vào stash.

## 6. Kiểm tra, commit và push

Xem đúng thay đổi của mình và chỉ stage các file liên quan:

```sh
git status
git diff
git add services/identity-service/src/main/java
# Thêm các file test/config liên quan bằng đường dẫn cụ thể nếu có.
git diff --cached
git diff --cached --check
```

Không dùng `git add .` theo thói quen khi chưa xem trạng thái. Kiểm tra bản diff đã stage để tránh đẩy nhầm config riêng hoặc các file không liên quan.

Chạy kiểm tra phù hợp trước khi commit. Khi thay đổi nhiều phần hoặc cấu hình chung:

```sh
./scripts/verify.sh
```

Ví dụ chỉ phát triển Work Service:

```sh
./mvnw -B -pl services/work-service -am verify
```

Sau khi kiểm tra đạt:

```sh
git commit -m "feat(identity): add email verification"
git push -u origin feat/SCRUM-12-login
```

Các lần push sau trên cùng nhánh đã có upstream có thể dùng `git push`. Nếu push bị từ chối vì remote có commit mới, chạy `git fetch origin`, kiểm tra và merge nhánh remote tương ứng vào nhánh hiện tại, xử lý conflict/test rồi push lại. Không dùng `--force` để ghi đè phần việc của người khác.

Mở PR từ nhánh task vào `main`. Mô tả vấn đề, hành vi sau thay đổi, kết quả kiểm thử và ảnh hưởng config/migration nếu có. Ghi rõ biến môi trường mới và cách cập nhật; không ghi giá trị secret.

## 7. Xử lý conflict code

1. Chạy `git status` để biết file đang conflict.
2. Mở từng file và tìm các vùng `<<<<<<<`, `=======`, `>>>>>>>`.
3. Đọc cả hai thay đổi và kết hợp theo nghiệp vụ; không chọn hàng loạt “Accept Current” hoặc “Accept Incoming”. Nếu đụng phần việc người khác, trao đổi trước khi loại bỏ logic của họ.
4. Xóa marker, kiểm tra import/kiểu dữ liệu/API, rồi chạy kiểm tra liên quan.
5. Stage đúng các file đã xử lý và hoàn tất merge.

```sh
git add path/to/resolved-file
git diff --cached
git merge --continue
```

Thay `path/to/resolved-file` bằng đường dẫn thực tế. Trong hướng dẫn này, phần cập nhật dùng `merge`; nếu muốn bỏ một merge đang conflict và chưa hoàn tất, dùng `git merge --abort`. Không dùng lệnh abort tùy ý cho rebase/cherry-pick vì mỗi thao tác có quy trình riêng.

## 8. File nào đưa lên GitHub, file nào giữ trên máy

| Nhóm file | Xử lý |
|---|---|
| `frontend/`, `platform/`, `services/`, `infra/`, `scripts/`, `.github/` | Đưa lên GitHub phần source/cấu hình dùng chung; xem các ngoại lệ ignored bên dưới |
| `pom.xml`, module `pom.xml`, `mvnw`, `mvnw.cmd`, `.mvn/` | Đưa lên GitHub để build nhất quán |
| `frontend/package.json`, `frontend/package-lock.json` | Đưa cả hai lên GitHub khi thay dependency |
| `.env.example`, `frontend/.env.example` | Đưa lên GitHub; dùng tên biến và giá trị mẫu không nhạy cảm |
| `.env`, `.env.local`, config chứa mật khẩu/API key/khóa riêng | Giữ riêng; không commit |
| `local/`, `.local/` | Tài liệu riêng, rule, báo cáo, file render; Git bỏ qua |
| `node_modules/`, `target/`, `dist/`, coverage, log, `*.tsbuildinfo` | File sinh ra; Git bỏ qua |
| `.idea/`, `.vscode/`, `.DS_Store`, file tạm Word | Cấu hình máy/file tạm; Git bỏ qua theo quy tắc hiện tại |

`.gitignore` là nơi khai báo file bị bỏ qua. `.env` là nơi chứa giá trị cấu hình, không phải danh sách file cần loại khỏi Git.

Có thể kiểm tra một file có bị bỏ qua hay không:

```sh
git check-ignore -v .env local/RULE.md
```

Nếu file đã được Git theo dõi, bổ sung `.gitignore` không tự bỏ theo dõi. Dùng `git rm --cached path/to/file` cho đúng file sau khi đã kiểm tra; file vẫn còn trên máy. Nếu secret từng được push, phải thu hồi/thay secret và xử lý lịch sử với người phụ trách; chỉ xóa ở commit mới chưa loại secret khỏi lịch sử.

## 9. Quản lý config đúng lớp

| Vị trí | Vai trò |
|---|---|
| `.env.example` | Danh sách biến cần cho stack Compose, giá trị mẫu/để trống secret |
| `.env` | Giá trị riêng trên máy; do `setup-local.py` tạo lần đầu |
| `infra/config-repo/application.yml` | Cấu hình chung các Config Client |
| `infra/config-repo/<service>.yml` | Cấu hình riêng Gateway/Discovery/service tương ứng |
| `<module>/src/main/resources/application.yml` | Tên ứng dụng, bootstrap Config và cấu hình khởi động module |
| `infra/compose/compose.yml` | Container, network, volume và biến được truyền vào từng container |
| `infra/compose/compose.dev.yml` | Mở cổng loopback phục vụ phát triển local |
| `frontend/.env.local` | Cấu hình Vite riêng trên máy, nếu cần |

Dùng placeholder như `${DB_PASSWORD}` trong config được commit. Không hardcode mật khẩu thật trong YAML, Java, Dockerfile, workflow, URL ghi vào tài liệu hoặc frontend. Không đưa secret vào biến `VITE_*`, vì giá trị frontend có thể xuất hiện trong bundle trình duyệt.

Khi thêm biến mới, phải cập nhật đồng bộ:

1. `.env.example` và giá trị `.env` trên từng máy.
2. `scripts/setup-local.py` nếu cách sinh giá trị mới chưa phù hợp. Hiện script chỉ tự sinh secret cho dòng có tên kết thúc bằng `_PASSWORD=`; không mặc định nó sinh API key hoặc mọi biến mới.
3. `infra/compose/compose.yml` để truyền biến tới đúng container; biến có trong `.env` không có nghĩa mọi container tự nhận được.
4. Config/module sử dụng biến và hướng dẫn trong PR để các thành viên tự cập nhật.

Không ghi đè toàn bộ `.env` của người khác bằng `.env.example` sau khi pull. File `.env` bị ignored nên Git không cập nhật giá trị riêng này giúp bạn.

## 10. Khi pull có thay đổi config hoặc dependency

- Thay `pom.xml`: build lại module liên quan hoặc toàn reactor. Spring Boot/Cloud dùng BOM ở parent; không tự nâng riêng một dependency Spring gây lệch bộ phiên bản.
- Thay `package-lock.json`: chạy `npm --prefix frontend ci`. Lệnh này cài theo lockfile và làm mới `node_modules`.
- Thêm dependency npm: dùng npm trong `frontend/`, commit cả `package.json` và lockfile. Không sửa thủ công phần dependency tree của lockfile. Nếu lockfile conflict, thống nhất `package.json` rồi dùng cùng phiên bản npm để tạo lại và review diff.
- Thay Config Repo: restart service nhận cấu hình. Hiện chưa có refresh động; không coi thay file YAML là service đang chạy đã nhận giá trị mới.
- Thay `.env` hoặc Compose: dùng `up -d --force-recreate` với service liên quan để container nhận môi trường mới; chỉ `restart` không cập nhật environment của container.
- Thay code Java: build JAR trước rồi build lại image; Dockerfile backend hiện copy JAR đã build, không tự compile source.

Ví dụ cập nhật Work Service sau khi pull:

```sh
./mvnw -B -pl services/work-service -am verify
./scripts/compose.sh config --quiet
./scripts/compose.sh up -d --build --force-recreate work-service
./scripts/compose.sh ps
python3 scripts/smoke-test.py
```

Nếu đổi config dùng chung, cập nhật/restart tất cả ứng dụng chịu ảnh hưởng theo thứ tự phụ thuộc. Thay Config Server không tự restart các client đang chạy.

## 11. Database và migration

- Mỗi service chỉ sử dụng database của mình; không sửa quyền để truy vấn chéo database cho tiện.
- Thêm migration mới trong `src/main/resources/db/migration/`; không sửa nội dung migration đã chạy trên môi trường dùng chung.
- Thống nhất số phiên bản migration trước khi merge để hai người không cùng tạo một `V2`. Nếu một phiên bản đã được áp dụng, không đổi tên/sửa file tùy tiện; tạo migration tiếp theo và phối hợp xử lý môi trường đã chạy bản nháp.
- Không sửa schema thủ công rồi quên tạo migration tương ứng. Không dùng Hibernate `ddl-auto=update` thay Flyway để tránh conflict.
- Không dùng `docker compose down --volumes` để giải quyết lỗi config/database nếu còn cần dữ liệu. `scripts/compose.sh down` giữ volume.
- Đổi mật khẩu trong `.env` không tự thay tài khoản trong volume MySQL/RabbitMQ đã có. Cần rotation đồng bộ tài khoản thực tế và config ứng dụng.
- Script khởi tạo MySQL hiện yêu cầu mật khẩu DB local là 48 ký tự hexadecimal do `setup-local.py` sinh.

## 12. Hoàn tất PR và tiếp tục công việc

Sau khi PR đã merge, khi không còn thay đổi chưa commit trên nhánh task:

```sh
git switch main
git pull --ff-only origin main
git fetch --prune origin
```

Chỉ xóa nhánh local sau khi chắc chắn công việc đã vào `main`. Với squash merge, `git branch -d` có thể báo chưa merge vì lịch sử commit khác nhau; kiểm tra PR và diff trước, không tự chuyển sang `-D` để bỏ qua cảnh báo.

CI hiện có kiểm tra frontend, build/test backend và Compose integration. Pipeline CD production chưa triển khai; push/merge không tự đồng nghĩa ứng dụng đã được deploy lên máy chủ.

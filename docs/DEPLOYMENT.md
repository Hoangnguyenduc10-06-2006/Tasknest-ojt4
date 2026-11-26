# CI/CD TaskNest

## Luồng triển khai

- Pull Request: kiểm tra frontend, backend, bảo mật, schema và tích hợp như workflow CI hiện tại.
- Push/merge vào `main`: chỉ khi cả hai job CI thành công mới build và publish 7 image lên GHCR, gắn tag bằng commit SHA.
- Khi repository variable `DEPLOY_ENABLED=true`: job `deploy` dùng environment `production`, kết nối SSH và triển khai đúng SHA đã kiểm tra.
- Workflow chạy thủ công bằng **Actions → CI → Run workflow → main** cũng thực hiện luồng này. Không deploy từ nhánh feature/PR.
- VPS chỉ kéo image; không chạy Maven, npm hay Docker build. Image hiện được build cho VPS Linux amd64.

## Chuẩn bị VPS một lần

VPS cần Docker Engine + Compose v2 hỗ trợ `--wait` và `config --format json`, Bash, Python 3, `flock`, `gzip`, SSH và quyền chạy Docker. Cấu hình này không tự cài phần mềm, đổi firewall hay cấu hình domain.

Máy cũ 1 CPU / 2 GiB RAM vẫn có thể thiếu tài nguyên khi chạy 6 JVM cùng MySQL/RabbitMQ. Swap chỉ giảm nguy cơ hết RAM, không bảo đảm hiệu năng; nên bố trí tối thiểu 4 GiB RAM cho bản demo này. Health timeout được tăng, nhưng triển khai vẫn dừng nếu container không khỏe.

1. Giữ `.env` đầy đủ tại `/var/www/tasknest/.env`, chmod `600`. Các khóa JWT, khóa outbox, proxy key và mật khẩu database phải giữ ổn định qua các lần deploy. Dùng cùng `COMPOSE_PROJECT_NAME=tasknest` như hệ thống hiện có để tiếp tục sử dụng các volume cũ. Không chạy lại script sinh secret lên môi trường đã có dữ liệu.
2. Cấu hình domain HTTPS thực tế trong `.env`:

   ```dotenv
   FRONTEND_PORT=3000
   PUBLIC_APP_ORIGIN=https://tasknest.tech
   IDENTITY_ALLOWED_ORIGINS=https://tasknest.tech
   IDENTITY_COOKIE_SECURE=true
   MAIL_ENABLED=true
   ```

   Domain trên là domain đã cung cấp; đổi nếu dùng subdomain khác. Giữ các giá trị Brevo/DB/khóa riêng trong `.env` của server, không đưa vào GitHub hay file Compose.
3. Cấu hình reverse proxy trên VPS: HTTPS domain → `http://127.0.0.1:3000`; hỗ trợ WebSocket, upload 22 MiB và không ghi query xác minh email/reset password vào access log. Workflow chỉ kiểm tra HTTP nội bộ sau deploy, chưa kiểm tra chứng chỉ TLS/DNS ngoài Internet.
4. Thêm public key SSH dành cho deploy vào `~/.ssh/authorized_keys` của tài khoản deploy. Tài khoản này cần quyền ghi thư mục deploy, đọc `.env` và chạy Docker. Không gửi private key vào chat.
5. Nếu đã có container MySQL nhưng đang dừng/unhealthy, sửa và khởi động database trước: CD sẽ từ chối cập nhật nếu không sao lưu được database hiện hữu.

## GitHub settings

Tạo **Settings → Environments → production**. Có thể thêm required reviewer nếu muốn duyệt trước mỗi lần deploy.

Trong **Settings → Secrets and variables → Actions → Secrets** (hoặc secrets của environment `production`), thêm:

| Secret | Giá trị |
| --- | --- |
| `DEPLOY_HOST` | IP VPS, ví dụ `160.187.229.99` |
| `DEPLOY_USER` | Tài khoản SSH có quyền deploy |
| `DEPLOY_PORT` | Cổng SSH, mặc định `22` nếu để trống |
| `DEPLOY_SSH_KEY` | Toàn bộ private key SSH dành cho deploy, không có passphrase |
| `DEPLOY_KNOWN_HOSTS` | Dòng known_hosts của VPS đã đối chiếu fingerprint qua console nhà cung cấp |

Lấy fingerprint trên VPS qua console tin cậy:

```bash
ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

Sau khi đối chiếu fingerprint, lấy dòng known_hosts trên máy cá nhân:

```bash
ssh-keyscan -p 22 -t ed25519 160.187.229.99
```

Không bỏ `StrictHostKeyChecking` và không chỉ tin kết quả keyscan chưa đối chiếu.

Trong tab **Variables**, tạo repository variables:

| Variable | Giá trị |
| --- | --- |
| `DEPLOY_PATH` | `/var/www/tasknest` (mặc định) |
| `DEPLOY_ENABLED` | Đặt `true` sau khi hoàn tất cấu hình trên |

Repository cần cho phép workflow `GITHUB_TOKEN` ghi packages. GHCR dùng token tạm thời của workflow: không cần Docker Hub token hoặc PAT lưu trên server. Nếu package GHCR đã tồn tại, cấp quyền Actions của repository này trong package settings. Registry credential trên VPS được xóa khi script kết thúc.

## Sao lưu, lỗi triển khai và rollback

- Release chứa Compose/config tại `deploy/releases/<SHA>`; không ghi đè source checkout hoặc `.env` trên VPS.
- Trước khi cập nhật database hiện hữu, dump ba database vào `deploy/backups/before-<SHA>-<UTC>.sql.gz`. Đây là bản dump database, không phải backup tệp upload. Tệp upload tiếp tục nằm trong volume `tasknest_work-files`; cần sao lưu riêng volume này trước thao tác khôi phục/chuyển máy.
- Không xóa volume, không chạy `down --volumes`, không tự prune image hoặc backup. Theo dõi dung lượng và chuyển backup sang nơi lưu trữ khác.
- Sau khi toàn bộ container healthy và smoke test qua mới ghi `deploy/current-release`; bản trước nằm trong `deploy/previous-release`.
- Có thể gián đoạn dịch vụ khi Compose recreate container. Không phải triển khai zero-downtime.
- Nếu lỗi sau khi một số container đã cập nhật, script dừng và giữ marker cũ; điều đó không có nghĩa các container đã tự quay về bản cũ. Xem log Actions và container để xử lý.
- Không tự rollback database sau migration. Chỉ rollback image khi xác nhận schema tương thích; nếu không, cần quy trình restore database và tệp tương ứng đã kiểm tra. Backup/restore không được tự động ghi đè dữ liệu người dùng.

Để tạm dừng CD mà vẫn chạy CI và publish image, đặt `DEPLOY_ENABLED=false`.

Tham khảo chính thức: [GitHub Container Registry trong Actions](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images), [Docker Compose up và health wait](https://docs.docker.com/reference/cli/docker/compose/up/).


## Truy cập MySQL trực tiếp từ IntelliJ

Compose production giữ cổng MySQL qua mỗi lần CD. Mặc định chỉ bind loopback.
Để truy cập trực tiếp, đặt trong `.env` trên VPS:

```dotenv
MYSQL_ACCESS_BIND=0.0.0.0
MYSQL_ACCESS_PORT=13307
MYSQL_ACCESS_ALLOWED_IP=116.96.44.176
```

Deploy cần quyền chạy iptables. Script cài rule DOCKER-USER trước khi mở cổng,
chặn các IPv4 khác; thiếu IP hợp lệ hoặc không cài được rule thì deploy dừng.
Dùng tài khoản database riêng từng service, mật khẩu trong `.env` VPS.
IntelliJ kết nối IP VPS, port 13307, không bật SSH tunnel.

Rule được kiểm tra lại mỗi lần deploy, nhưng chưa được lưu qua reboot/Docker restart.
Để bảo vệ cả lúc khởi động VPS, cấu hình thêm firewall của nhà cung cấp:
chỉ cho TCP 13307 từ IP cá nhân /32 và chặn các nguồn khác.
Khi IP mạng cá nhân đổi, cập nhật cả `.env` và firewall nhà cung cấp rồi deploy lại.
Không cần xóa volume hoặc tạo lại database.

## Sao lưu định kỳ và khôi phục

Bản ZIP chứa payload mã hóa bằng age gồm dump các database Identity, Work,
Notification và AI nếu có, dữ liệu trong volume tệp của Work Service và manifest
ghi release, thời điểm tạo cùng SHA-256. Script dùng chung khóa với CD và dừng
Gateway cùng các service có thể ghi dữ liệu trong lúc chụp. Chọn khung giờ bảo trì
và dừng mọi thao tác ghi MySQL trực tiếp trong khoảng này. RabbitMQ và cấu hình
máy chủ được chuẩn bị riêng khi khôi phục. Các thông điệp còn trong hàng đợi tại
thời điểm sự cố không nằm trong bản ZIP.

### Chuẩn bị và chạy thử

1. Cài age trên máy quản trị và VPS. Trên Ubuntu dùng `apt install age`.
   Trên máy quản trị chạy `age-keygen -o tasknest-backup.agekey` và
   `age-keygen -y tasknest-backup.agekey > tasknest-backup.recipients`.
   Chuyển **chỉ** file `.recipients` lên VPS tại
   `/var/www/tasknest/deploy/backup.recipients`. Giữ file `.agekey` ngoài VPS và
   ngoài Gmail, có bản dự phòng an toàn. Lưu riêng `.env` và cấu hình máy chủ
   vào kho bí mật để giữ khóa outbox, khóa ký JWT và các thông tin kết nối.
2. Sau khi deploy release có script, chạy lệnh sau trên VPS và điền Gmail quản trị.
   Lệnh gửi email thật và gây gián đoạn trong lúc chụp dữ liệu.

   ```bash
   cd /var/www/tasknest
   python3 "deploy/releases/$(cat deploy/current-release)/scripts/backup-recovery.py" \
     backup --recipients deploy/backup.recipients --email 'GMAIL_QUAN_TRI'
   ```

3. Tải ZIP từ Gmail, rồi chạy trên máy quản trị bằng bản script từ repository.

   ```bash
   python3 scripts/backup-recovery.py verify /duong-dan/ban-sao.zip \
     --identity /duong-dan/tasknest-backup.agekey
   ```

Script giữ 7 ZIP gần nhất trong `deploy/backups/encrypted`. ZIP tối đa 13 MiB
được đính kèm, lớn hơn thì Brevo gửi cảnh báo để tải thủ công qua SSH. Nếu gửi
thất bại, lệnh trả lỗi và giữ ZIP trên VPS. Tải các bản lớn ra ngoài VPS để
có thể khôi phục nếu mất máy. Đối chiếu hộp thư Gmail và log giao hàng Brevo
sau lần gửi thử vì bộ lọc tệp đính kèm có thể chặn email.
Xem [quy định tệp đính kèm Gmail](https://support.google.com/mail/answer/6590).

### Lập lịch

Sau khi xác nhận đã nhận và xác minh được ZIP, tạo lịch bằng systemd timer hoặc
cron trên VPS. Ví dụ dưới đây dùng cron của tài khoản có quyền Docker, với múi
giờ hệ điều hành đã đặt thành `Asia/Ho_Chi_Minh`. Tạo trước thư mục
`/var/www/tasknest/deploy/backups` và đặt quyền chỉ cho tài khoản vận hành.

```cron
0 2 * * * cd /var/www/tasknest && /usr/bin/python3 "deploy/releases/$(cat deploy/current-release)/scripts/backup-recovery.py" backup --recipients deploy/backup.recipients --email 'GMAIL_QUAN_TRI' >> deploy/backups/backup.log 2>&1
```

### Khôi phục sang stack trống

1. Chuẩn bị VPS hoặc Compose project riêng với **cùng release trong manifest**.
   Đặt `.env` phù hợp với môi trường đích, giữ khóa outbox tương ứng và dùng
   cổng riêng hoặc loopback để kiểm tra. Tải các image của release.
2. Dùng Compose của release đích để `up -d --wait mysql` và
   `up --no-start --no-deps --no-build work-service`. Stack đích chỉ được có MySQL
   đang chạy, các schema ứng dụng chưa có bảng và volume tệp phải trống.
   Nếu bản sao chứa AI, chuẩn bị database và user AI theo hướng dẫn Groq.
3. Chỉ dùng ZIP từ nguồn sao lưu của nhóm. Chép ZIP và khóa giải mã vào
   môi trường khôi phục tin cậy, chạy:

   ```bash
   python3 /duong-dan/backup-recovery.py --root /duong-dan/deploy-root \
     restore /duong-dan/ban-sao.zip --identity /duong-dan/tasknest-backup.agekey
   ```

   Script kiểm tra định dạng, checksum, release và trạng thái stack trước khi
   nhập dữ liệu. Nếu một bước ghi thất bại, dùng stack trống mới cho lần thử
   tiếp theo. Thu hồi file khóa tạm khỏi VPS sau khi hoàn tất.
4. Bật stack đích, kiểm tra health, đăng nhập và tải thử tệp đính kèm. Cô lập
   email khi diễn tập để tránh phát lại thông báo từ dữ liệu đã phục hồi.
   Chỉ chuyển lưu lượng khi stack khôi phục đã kiểm tra xong.

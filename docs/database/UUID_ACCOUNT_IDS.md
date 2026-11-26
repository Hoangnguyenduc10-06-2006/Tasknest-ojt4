# ID tài khoản dạng UUID

`users.id` là khóa chính UUID dạng chuỗi `CHAR(36) CHARACTER SET ascii COLLATE ascii_bin`, không thêm public_id. Entity/repository/DTO và frontend dùng String/string. Tài khoản mới được Hibernate sinh UUID v4 trước khi lưu. ID dự án, nhiệm vụ, account_tokens và các ID nghiệp vụ khác giữ nguyên kiểu cũ.

Các cột tham chiếu người dùng trong Identity, Work và Notification cùng chuyển sang CHAR(36), kể cả khóa ghép, người tạo/duyệt/sửa, generated column và unique index. Các khóa ngoại được tạo lại và kiểm tra trên dữ liệu đã chuyển; không tắt FOREIGN_KEY_CHECKS. JWT subject và sự kiện email mới dùng UUID. Sự kiện email có schemaVersion 2; consumer còn đọc được bản v1 có userId số bằng cùng quy tắc ánh xạ migration.

## Dữ liệu hiện có

Migration mới, không sửa V1/V2/V3 đã áp dụng:

- Identity: V4__use_uuid_account_ids.sql.
- Work: V3__use_uuid_account_ids.sql.
- Notification: V3__use_uuid_account_ids.sql.

ID cũ được ánh xạ ổn định bằng UUID name-based v3 từ chuỗi UTF-8 `tasknest:user:<id-cu>`. Ví dụ user 6 được cùng một UUID ở cả ba database mà không truy vấn chéo database. Thuật toán này chỉ dùng cho chuyển dữ liệu cũ và thông điệp v1 còn trong broker; tài khoản mới dùng UUID v4 ngẫu nhiên. Mật khẩu băm, hồ sơ, token xác minh và dữ liệu nghiệp vụ được giữ lại. Các phiên/refresh token hiện tại được thu hồi với lý do USER_ID_MIGRATION; người dùng đăng nhập lại. Ciphertext email chỉ chứa email/token nên không cần giải mã lại khi đổi user ID.

## Áp dụng lên môi trường đang chạy

Không chạy UPDATE id thủ công hoặc ALTER riêng bảng users. Việc thay đổi source không tự chuyển database/container đang chạy.

1. Kiểm tra đúng môi trường và lưu bản sao lưu có thể khôi phục của cả ba database; nếu có broker volume, lưu trạng thái phù hợp với cùng thời điểm. Không đưa bản sao lưu chứa dữ liệu tài khoản lên Git.
2. Dừng toàn bộ application writers, publisher và consumer, kể cả instance chạy từ IDE. Giữ MySQL/broker/config/discovery hoạt động. Không cho bản code cũ ghi trong quá trình chuyển.
3. Build các service từ cùng phiên bản UUID với Java 21. Chạy migration qua Flyway bằng bản build mới, nâng cả ba database trong cùng cửa sổ bảo trì. Nếu không kiểm soát được lịch chạy publisher/consumer, dùng một tiến trình Flyway chỉ migrate trước khi khởi động ứng dụng.
4. Kiểm tra users.id và các tham chiếu đã là CHAR(36), số lượng tài khoản/dữ liệu giữ nguyên, các khóa ngoại còn tồn tại. Sau khi cả ba migration thành công mới mở lại ứng dụng cùng phiên bản.
5. Đăng nhập lại; kiểm tra đăng ký/xác minh, refresh/logout, email và các dữ liệu dự án liên quan. Không dùng token cũ để đánh giá phiên mới.

MySQL DDL tự commit, nên các migration này không thể rollback nguyên khối bằng ROLLBACK. Nếu dở dang, giữ ứng dụng dừng và khôi phục bản sao lưu đã kiểm tra; không dùng Flyway repair để bỏ qua migration lỗi. Các JSON tùy biến ngoài hợp đồng hiện tại và tích hợp bên ngoài chứa ID số phải được rà soát riêng trước khi chuyển. Migration hiện xử lý các cột quan hệ và trường user ID cấp đầu trong outbox chuẩn của dự án.

## Kiểm tra trên môi trường tạm

```sh
./mvnw -B verify
python3 scripts/test-schema.py
python3 scripts/test-auth-mail.py
npm --prefix frontend run typecheck
npm --prefix frontend test
```

Các script database dùng container MySQL tạm, không đọc .env hoặc sửa database ứng dụng. test-schema kiểm tra nâng cấp tài khoản 6 với dữ liệu liên quan trên cả ba database và chứng minh FK vẫn chặn tham chiếu sai. test-auth-mail dùng Gateway, RabbitMQ và Brevo giả cục bộ; không gửi email thật.

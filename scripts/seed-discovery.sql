-- Add Discovery fixtures to the TaskNest databases on the same MySQL instance.
-- Existing entries, including fixtures edited by testers, are preserved on rerun.
USE tasknest_work;
SET NAMES utf8mb4;
START TRANSACTION;

INSERT INTO customer_project_requests
  (customer_user_id,customer_name,title,description,skills,budget_min,budget_max,desired_delivery,status,
   creation_request_id,creation_hash,created_at,updated_at)
WITH
  accounts AS (
    SELECT id,full_name,ROW_NUMBER() OVER (ORDER BY id) AS seq,COUNT(*) OVER () AS total
    FROM tasknest_identity.users WHERE is_email_verified=1
  ),
  samples AS (
    SELECT 1 AS seq,'Ứng dụng đặt lịch phòng khám' AS title,
      'Xây dựng trang đặt lịch, xác nhận khung giờ và quản lý lịch hẹn. Bàn giao mã nguồn, tài liệu vận hành và một buổi hướng dẫn.' AS description,
      'React, Java, MySQL' AS skills,35000000 AS minimum,55000000 AS maximum
    UNION ALL SELECT 2,'Cổng quản lý học liệu cho trung tâm',
      'Giáo viên tải học liệu và phân quyền theo lớp. Học viên tra cứu tài liệu, lưu bài yêu thích và nhận thông báo khi tài liệu được cập nhật.',
      'Vue, Node.js, PostgreSQL',25000000,42000000
    UNION ALL SELECT 3,'Bảng điều khiển tồn kho cho cửa hàng',
      'Đồng bộ danh mục, ghi nhận nhập xuất và cảnh báo tồn kho thấp. Cần màn hình thống kê và xuất báo cáo Excel theo tháng.',
      'Python, PostgreSQL, Docker',28000000,47000000
    UNION ALL SELECT 4,'Thiết kế trải nghiệm cho nền tảng học nghề',
      'Khảo sát hai nhóm người dùng, dựng prototype mobile và bàn giao thư viện thành phần. Phạm vi gồm trang tìm khóa, đăng ký và tiến độ.',
      'Figma, UX Research, UI Design',12000000,20000000
    UNION ALL SELECT 5,'Ứng dụng theo dõi giao hàng nội thành',
      'Xây dựng luồng nhận chuyến, cập nhật trạng thái và tra cứu đơn. Ưu tiên khả năng hoạt động khi mạng không ổn định.',
      'Flutter, Firebase, REST API',40000000,65000000
    UNION ALL SELECT 6,'Tự động hóa triển khai cho dịch vụ báo cáo',
      'Chuẩn bị pipeline kiểm thử, môi trường staging, theo dõi log và hướng dẫn phục hồi các phiên bản triển khai.',
      'Docker, GitHub Actions, DevOps',18000000,30000000
  )
SELECT a.id,a.full_name,s.title,s.description,s.skills,s.minimum,s.maximum,
  DATE_ADD(UTC_DATE(),INTERVAL (24 + s.seq * 5) DAY),'OPEN',
  CONCAT('d15c0a01-0000-4000-8000-',LPAD(s.seq,12,'0')),
  UNHEX(SHA2(CONCAT('tasknest/discovery/request/',s.seq),256)),
  DATE_SUB(UTC_TIMESTAMP(6),INTERVAL s.seq DAY),DATE_SUB(UTC_TIMESTAMP(6),INTERVAL s.seq DAY)
FROM samples s JOIN accounts a ON a.seq=MOD(s.seq-1,a.total)+1
WHERE NOT EXISTS (
  SELECT 1 FROM customer_project_requests r
  WHERE r.creation_request_id=CONCAT('d15c0a01-0000-4000-8000-',LPAD(s.seq,12,'0'))
);

INSERT INTO team_openings
  (team_id,title,description,skills,work_mode,weekly_hours,slots,closes_on,status,request_id,
   request_hash,created_at,updated_at)
WITH
  teams AS (
    SELECT t.id,ROW_NUMBER() OVER (ORDER BY t.id) AS seq,COUNT(*) OVER () AS total
    FROM dev_teams t JOIN tasknest_identity.users u ON u.id=t.owner_user_id
    WHERE u.is_email_verified=1
  ),
  samples AS (
    SELECT 1 AS seq,'Lập trình viên Frontend cho cổng đặt lịch' AS title,
      'Cùng phát triển giao diện đặt lịch và trang quản trị, bổ sung kiểm thử cho các màn hình chính.' AS description,
      'React, TypeScript, CSS' AS skills,'REMOTE' AS mode,15 AS hours,2 AS slots
    UNION ALL SELECT 2,'Lập trình viên Backend cho hệ thống kho',
      'Thiết kế API tồn kho, migration dữ liệu và xử lý báo cáo theo kỳ. Trao đổi thiết kế cùng team mỗi tuần.',
      'Java, Spring Boot, MySQL','HYBRID',20,1
    UNION ALL SELECT 3,'Chuyên viên kiểm thử cho ứng dụng học tập',
      'Soạn kịch bản kiểm thử đăng ký, phân quyền và tải học liệu. Tự động hóa các luồng quan trọng.',
      'Playwright, QA, TypeScript','REMOTE',12,2
    UNION ALL SELECT 4,'Thiết kế sản phẩm cho ứng dụng giao hàng',
      'Thiết kế luồng tài xế nhận chuyến, xử lý trạng thái và tạo nguyên mẫu để phỏng vấn người dùng.',
      'Figma, UI Design, UX Research','HYBRID',10,1
    UNION ALL SELECT 5,'Kỹ sư DevOps cho dịch vụ báo cáo',
      'Hoàn thiện pipeline staging và production, thiết lập cảnh báo và tài liệu bàn giao vận hành.',
      'Docker, GitHub Actions, DevOps','REMOTE',12,1
    UNION ALL SELECT 6,'Lập trình viên Mobile tích hợp thông báo',
      'Phụ trách tích hợp thông báo, đồng bộ ngoại tuyến và hoàn thiện các màn hình theo thiết kế đã thống nhất.',
      'Flutter, Firebase, REST API','REMOTE',18,2
  )
SELECT t.id,s.title,s.description,s.skills,s.mode,s.hours,s.slots,
  DATE_ADD(UTC_DATE(),INTERVAL (14+s.seq*2) DAY),'OPEN',
  CONCAT('d15c0a02-0000-4000-8000-',LPAD(s.seq,12,'0')),
  UNHEX(SHA2(CONCAT('tasknest/discovery/opening/',s.seq),256)),
  DATE_SUB(UTC_TIMESTAMP(6),INTERVAL s.seq HOUR),DATE_SUB(UTC_TIMESTAMP(6),INTERVAL s.seq HOUR)
FROM samples s JOIN teams t ON t.seq=MOD(s.seq-1,t.total)+1
WHERE NOT EXISTS (
  SELECT 1 FROM team_openings o WHERE o.request_id=CONCAT('d15c0a02-0000-4000-8000-',LPAD(s.seq,12,'0'))
);

SELECT 'sample_requests',COUNT(*) FROM customer_project_requests WHERE creation_request_id LIKE 'd15c0a01-0000-4000-8000-%';
SELECT 'sample_openings',COUNT(*) FROM team_openings WHERE request_id LIKE 'd15c0a02-0000-4000-8000-%';
COMMIT;

package vn.tasknest.workservice.application.workspace;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class TaskAlertScheduler {
    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final String DEFAULT_BODY = "Mở nhiệm vụ để xem nội dung và phản hồi.";

    private final JdbcTemplate db;
    private final WorkNotificationService notifications;
    private final TransactionTemplate tx;
    private final Clock clock;
    private final int dueSoonDays;

    public TaskAlertScheduler(JdbcTemplate db, WorkNotificationService notifications, TransactionTemplate tx, Clock clock) {
        this(db, notifications, tx, clock, 1);
    }

    @Autowired
    public TaskAlertScheduler(
        JdbcTemplate db,
        WorkNotificationService notifications,
        TransactionTemplate tx,
        Clock clock,
        @Value("${tasknest.alerts.due-soon-days:1}") int dueSoonDays
    ) {
        this.db = db;
        this.notifications = notifications;
        this.tx = tx;
        this.clock = clock;
        this.dueSoonDays = Math.max(0, dueSoonDays);
    }

    @Scheduled(fixedDelay = 10000)
    public void evaluate() {
        var tasks = db.queryForList("""
            SELECT t.id, t.project_id
            FROM tasks t
            JOIN projects p ON p.id = t.project_id
            WHERE p.status = 'ACTIVE'
              AND t.status IN ('TODO', 'IN_PROGRESS', 'IN_REVIEW')
            ORDER BY t.project_id, t.id
            """);
        for (var row : tasks) {
            tx.executeWithoutResult(status -> evaluateTask(
                ((Number) row.get("project_id")).longValue(),
                ((Number) row.get("id")).longValue()
            ));
        }
    }

    private void evaluateTask(long project, long task) {
        if (db.queryForList("SELECT id FROM projects WHERE id=? AND status='ACTIVE' FOR UPDATE", project).isEmpty()) {
            return;
        }
        // Completed (DONE) and cancelled (CANCELLED) tasks are strictly skipped under row lock.
        var values = db.queryForList(
            "SELECT * FROM tasks WHERE id=? AND status IN ('TODO','IN_PROGRESS','IN_REVIEW') FOR UPDATE",
            task
        );
        if (values.isEmpty()) {
            return;
        }
        var current = values.getFirst();
        String phase = Objects.toString(current.get("status"), "");
        if ("DONE".equals(phase) || "CANCELLED".equals(phase)) {
            return;
        }
        LocalDate deadline = toLocalDate(current.get("deadline_on"));
        LocalDate today = LocalDate.now(clock.withZone(BUSINESS_ZONE));

        var recipients = new LinkedHashSet<>(notifications.managers(project));
        String assignee = (String) current.get("assignee_user_id");
        if (assignee != null && !assignee.isBlank()) {
            recipients.add(assignee);
        }

        BigDecimal spent = db.queryForObject(
            "SELECT COALESCE(SUM(TIMESTAMPDIFF(MICROSECOND,started_at,COALESCE(ended_at,UTC_TIMESTAMP(6)))),0) FROM time_entries WHERE task_id=?",
            BigDecimal.class,
            task
        );
        BigDecimal estimate = BigDecimal.valueOf(((Number) current.get("estimated_seconds")).longValue())
            .multiply(BigDecimal.valueOf(1_000_000));
        if (spent != null) {
            if (spent.compareTo(estimate) > 0) {
                raise(current, "OVERRUN", null, recipients, "Nhiệm vụ vượt thời gian ước tính", DEFAULT_BODY, spent.longValue(), deadline);
            } else if (spent.multiply(BigDecimal.valueOf(10)).compareTo(estimate.multiply(BigDecimal.valueOf(8))) >= 0) {
                raise(current, "RISK", null, recipients, "Nhiệm vụ có rủi ro vượt ước tính", DEFAULT_BODY, spent.longValue(), deadline);
            }
        }

        if (deadline.isBefore(today)) {
            if ("IN_REVIEW".equals(phase)) {
                if (current.get("latest_submission_id") instanceof Number submission) {
                    raise(
                        current,
                        "REVIEW_OVERDUE",
                        submission.longValue(),
                        notifications.managers(project),
                        "Nhiệm vụ chờ duyệt sau deadline; cần xem xét kết quả",
                        DEFAULT_BODY,
                        null,
                        deadline
                    );
                }
            } else if ("TODO".equals(phase) || "IN_PROGRESS".equals(phase)) {
                raise(current, "OVERDUE", null, recipients, "Nhiệm vụ đã quá hạn thực hiện", DEFAULT_BODY, null, deadline);
            }
        } else if (("TODO".equals(phase) || "IN_PROGRESS".equals(phase)) && !deadline.isAfter(today.plusDays(dueSoonDays))) {
            String taskName = Objects.toString(current.get("name"), "").trim();
            String timing = deadline.equals(today) ? "hôm nay (" + deadline + ")" : "vào ngày " + deadline;
            String body = taskName.isEmpty()
                ? "Nhiệm vụ sẽ đến hạn " + timing + ". Hãy chủ động xử lý trước hạn."
                : "Nhiệm vụ \"" + taskName + "\" sẽ đến hạn " + timing + ". Hãy chủ động xử lý trước hạn.";
            raise(current, "DUE_SOON", null, recipients, "Nhiệm vụ sắp đến hạn", body, null, deadline);
        }
    }

    private static LocalDate toLocalDate(Object raw) {
        if (raw instanceof LocalDate localDate) {
            return localDate;
        }
        if (raw instanceof java.sql.Date sqlDate) {
            return sqlDate.toLocalDate();
        }
        return LocalDate.parse(Objects.requireNonNull(raw, "deadline_on").toString());
    }

    private void raise(
        Map<String, Object> task,
        String type,
        Long submission,
        Collection<String> recipients,
        String title,
        String body,
        Long observed,
        LocalDate deadline
    ) {
        long id = ((Number) task.get("id")).longValue();
        long project = ((Number) task.get("project_id")).longValue();
        int inserted = db.update(
            "INSERT IGNORE INTO task_alerts(project_id,task_id,alert_type,submission_id,observed_microseconds,estimated_seconds_snapshot,deadline_on_snapshot,raised_at) VALUES(?,?,?,?,?,?,?,?)",
            project,
            id,
            type,
            submission,
            observed,
            task.get("estimated_seconds"),
            java.sql.Date.valueOf(deadline),
            Timestamp.from(clock.instant())
        );
        if (inserted == 0) {
            return;
        }
        notifications.task(project, id, null, recipients, "work.task.alert." + type.toLowerCase(Locale.ROOT), title, body);
        db.update(
            "INSERT INTO activity_logs(project_id,task_id,action,entity_type,entity_id,after_data) VALUES(?,?,'TASK_ALERT','TASK',?,JSON_OBJECT('alertType',?,'deadline_on',?))",
            project,
            id,
            String.valueOf(id),
            type,
            deadline.toString()
        );
    }
}

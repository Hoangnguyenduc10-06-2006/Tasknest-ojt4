package vn.tasknest.workservice.application.report;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Timestamp;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.tasknest.workservice.application.WorkException;
import vn.tasknest.workservice.application.security.*;
import vn.tasknest.workservice.domain.project.ProjectRole;
import vn.tasknest.workservice.infrastructure.identity.IdentityDirectoryClient;

@Service
public class ProjectReportService {
    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final int MAX_ROWS = 10000;
    public enum ReportType { TASKS, TIME, SPRINT }
    public record Export(String filename, byte[] content) {}

    private final NamedParameterJdbcTemplate db;
    private final ProjectPermissionService permissions;
    private final IdentityDirectoryClient directory;
    private final Clock clock;

    public ProjectReportService(NamedParameterJdbcTemplate db, ProjectPermissionService permissions,
            IdentityDirectoryClient directory, Clock clock) {
        this.db = db;
        this.permissions = permissions;
        this.directory = directory;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Export export(WorkActor actor, long projectId, ReportType type, LocalDate from, LocalDate to) {
        var access = permissions.requireInternalMember(projectId, actor);
        if (type == null || from == null || to == null || from.isAfter(to)
                || from.getYear() < 1000 || to.getYear() > 9999
                || ChronoUnit.DAYS.between(from, to) >= 366) {
            throw new WorkException(HttpStatus.BAD_REQUEST, "INVALID_REPORT_PERIOD",
                "Chọn khoảng ngày hợp lệ, tối đa 366 ngày (tính cả ngày đầu và cuối).");
        }
        Instant now = clock.instant();
        Instant start = from.atStartOfDay(BUSINESS_ZONE).toInstant();
        Instant end = to.plusDays(1).atStartOfDay(BUSINESS_ZONE).toInstant();
        if (end.isAfter(now)) end = now;
        boolean manager = access.role().canManage();
        Map<String, Object> params = new HashMap<>();
        params.put("project", projectId);
        params.put("user", actor.userId());
        params.put("from", from);
        params.put("to", to);
        params.put("start", Timestamp.from(start));
        params.put("end", Timestamp.from(end));
        params.put("today", LocalDate.now(clock.withZone(BUSINESS_ZONE)));
        params.put("limit", MAX_ROWS + 1);

        if (type == ReportType.SPRINT) {
            return sprint(projectId, access.project().getName(), actor, manager, from, to, now, params);
        }
        List<Map<String, Object>> rows = type == ReportType.TASKS ? tasks(params, manager) : times(params, manager);
        if (rows.size() > MAX_ROWS) {
            throw new WorkException(HttpStatus.UNPROCESSABLE_ENTITY, "REPORT_TOO_LARGE",
                "Báo cáo vượt 10.000 dòng. Hãy chọn khoảng ngày ngắn hơn.");
        }
        String userColumn = type == ReportType.TASKS ? "assignee_user_id" : "user_id";
        Set<String> ids = new HashSet<>();
        rows.forEach(row -> ids.add((String) row.get(userColumn)));
        Map<String, String> names = directory.names(ids);
        var csv = new CsvDocument();
        String projectName = access.project().getName();
        String generatedAt = display(now);
        if (type == ReportType.TASKS) {
            csv.row("ID dự án", "Dự án", "Từ ngày", "Đến ngày", "ID nhiệm vụ", "Nhiệm vụ",
                "ID người phụ trách", "Người phụ trách", "Trạng thái hiện tại", "Ưu tiên", "Ngày bắt đầu",
                "Deadline", "Giờ ước tính toàn nhiệm vụ", "Giờ đã ghi trong kỳ", "Xuất lúc (giờ Việt Nam)");
            for (var row : rows) {
                String user = (String) row.get("assignee_user_id");
                csv.row(projectId, projectName, from, to, row.get("id"), row.get("name"), user,
                    names.getOrDefault(user, user), status((String) row.get("status")), row.get("priority"),
                    row.get("starts_on"), row.get("deadline_on"), hours(row.get("estimated_seconds")),
                    hours(row.get("logged_seconds")), generatedAt);
            }
        } else {
            csv.row("ID dự án", "Dự án", "Từ ngày", "Đến ngày", "ID phiên", "ID nhiệm vụ", "Nhiệm vụ",
                "ID người ghi giờ", "Người ghi giờ", "Nguồn", "Bắt đầu trong kỳ (giờ Việt Nam)",
                "Kết thúc trong kỳ (giờ Việt Nam)", "Giờ trong kỳ", "Timer còn chạy khi xuất", "Xuất lúc (giờ Việt Nam)");
            for (var row : rows) {
                String user = (String) row.get("user_id");
                Instant clippedStart = instant(row.get("started_at"));
                if (clippedStart.isBefore(start)) clippedStart = start;
                Instant clippedEnd = row.get("ended_at") == null ? end : instant(row.get("ended_at"));
                if (clippedEnd.isAfter(end)) clippedEnd = end;
                BigDecimal seconds = BigDecimal.valueOf(Duration.between(clippedStart, clippedEnd).toNanos(), 9);
                csv.row(projectId, projectName, from, to, row.get("id"), row.get("task_id"), row.get("name"),
                    user, names.getOrDefault(user, user), row.get("source"), display(clippedStart), display(clippedEnd),
                    hours(seconds), row.get("ended_at") == null ? "Có" : "Không", generatedAt);
            }
        }
        return new Export("tasknest-project-" + projectId + "-" + type.name().toLowerCase(Locale.ROOT)
            + "-" + from + "-" + to + ".csv", csv.bytes());
    }

    private Export sprint(long projectId, String projectName, WorkActor actor, boolean manager,
            LocalDate from, LocalDate to, Instant now, Map<String, Object> params) {
        String taskScope = manager ? "" : " AND t.assignee_user_id=:user";
        String timeScope = manager ? "" : " AND e.user_id=:user";
        String sql = """
            SELECT
              SUM(CASE WHEN t.status NOT IN ('DONE','CANCELLED') THEN 1 ELSE 0 END) open_tasks,
              SUM(CASE WHEN t.created_at>=:start AND t.created_at<:end THEN 1 ELSE 0 END) created_tasks,
              SUM(CASE WHEN t.status='DONE' AND t.completed_at>=:start AND t.completed_at<:end THEN 1 ELSE 0 END) completed_tasks,
              SUM(CASE WHEN t.status NOT IN ('DONE','CANCELLED') AND t.deadline_on<:today THEN 1 ELSE 0 END) overdue_tasks,
              SUM(CASE WHEN t.status NOT IN ('DONE','CANCELLED') AND t.is_blocked=1 THEN 1 ELSE 0 END) blocked_tasks,
              COALESCE((SELECT SUM(GREATEST(0,TIMESTAMPDIFF(MICROSECOND,
                    GREATEST(e.started_at,:start),LEAST(COALESCE(e.ended_at,:end),:end))))/1000000.0
                FROM time_entries e WHERE e.project_id=:project AND e.started_at<:end
                  AND COALESCE(e.ended_at,:end)>:start
            """ + timeScope + """
              ),0) logged_seconds
            FROM tasks t WHERE t.project_id=:project
            """ + taskScope;
        var row = db.queryForList(sql, params).getFirst();
        var csv = new CsvDocument();
        csv.row("ID dự án", "Dự án", "Từ ngày", "Đến ngày", "Chỉ số", "Giá trị", "Xuất lúc (giờ Việt Nam)");
        String generatedAt = display(now);
        sprintRow(csv, projectId, projectName, from, to, "Nhiệm vụ đang mở", row.get("open_tasks"), generatedAt);
        sprintRow(csv, projectId, projectName, from, to, "Nhiệm vụ tạo trong kỳ", row.get("created_tasks"), generatedAt);
        sprintRow(csv, projectId, projectName, from, to, "Nhiệm vụ hoàn thành trong kỳ", row.get("completed_tasks"), generatedAt);
        sprintRow(csv, projectId, projectName, from, to, "Nhiệm vụ quá hạn hiện tại", row.get("overdue_tasks"), generatedAt);
        sprintRow(csv, projectId, projectName, from, to, "Nhiệm vụ bị chặn hiện tại", row.get("blocked_tasks"), generatedAt);
        sprintRow(csv, projectId, projectName, from, to, "Giờ làm trong kỳ", hours(row.get("logged_seconds")), generatedAt);
        return new Export("tasknest-project-" + projectId + "-sprint-" + from + "-" + to + ".csv", csv.bytes());
    }

    private static void sprintRow(CsvDocument csv, long projectId, String projectName,
            LocalDate from, LocalDate to, String metric, Object value, String generatedAt) {
        csv.row(projectId, projectName, from, to, metric, value == null ? 0 : value, generatedAt);
    }

    private List<Map<String, Object>> tasks(Map<String, Object> params, boolean manager) {
        String timeScope = manager ? "" : " AND e.user_id=:user";
        String taskScope = manager ? "" : " AND t.assignee_user_id=:user";
        return db.queryForList("""
            SELECT t.id,t.name,t.assignee_user_id,t.status,t.priority,t.starts_on,t.deadline_on,t.estimated_seconds,
                COALESCE((SELECT SUM(GREATEST(0,TIMESTAMPDIFF(MICROSECOND,
                    GREATEST(e.started_at,:start),LEAST(COALESCE(e.ended_at,:end),:end))))/1000000.0
                    FROM time_entries e WHERE e.project_id=t.project_id AND e.task_id=t.id
                    AND e.started_at<:end AND COALESCE(e.ended_at,:end)>:start
            """ + timeScope + """
                ),0) logged_seconds
            FROM tasks t WHERE t.project_id=:project AND t.deadline_on BETWEEN :from AND :to
            """ + taskScope + " ORDER BY t.deadline_on,t.id LIMIT :limit", params);
    }

    private List<Map<String, Object>> times(Map<String, Object> params, boolean manager) {
        String scope = manager ? "" : " AND e.user_id=:user";
        return db.queryForList("""
            SELECT e.id,e.task_id,t.name,e.user_id,e.source,e.started_at,e.ended_at
            FROM time_entries e JOIN tasks t ON t.project_id=e.project_id AND t.id=e.task_id
            WHERE e.project_id=:project AND e.started_at<:end AND COALESCE(e.ended_at,:end)>:start
            """ + scope + " ORDER BY e.started_at,e.id LIMIT :limit", params);
    }

    private static Instant instant(Object value) {
        return value instanceof Timestamp timestamp ? timestamp.toInstant()
            : ((LocalDateTime) value).toInstant(ZoneOffset.UTC);
    }

    private static String display(Instant instant) {
        return instant.atZone(BUSINESS_ZONE).toOffsetDateTime().toString();
    }

    private static String hours(Object seconds) {
        return new BigDecimal(seconds.toString()).divide(BigDecimal.valueOf(3600), 4, RoundingMode.HALF_UP).toPlainString();
    }

    private static String status(String value) {
        return switch (value) {
            case "TODO" -> "Chưa bắt đầu";
            case "IN_PROGRESS" -> "Đang thực hiện";
            case "IN_REVIEW" -> "Chờ duyệt";
            case "DONE" -> "Hoàn thành";
            case "CANCELLED" -> "Đã hủy";
            default -> value;
        };
    }
}

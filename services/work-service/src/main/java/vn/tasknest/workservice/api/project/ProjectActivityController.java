package vn.tasknest.workservice.api.project;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vn.tasknest.workservice.api.ApiValues;
import vn.tasknest.workservice.api.WorkResponse;
import vn.tasknest.workservice.application.WorkException;
import vn.tasknest.workservice.application.security.ProjectPermissionService;
import vn.tasknest.workservice.application.security.WorkActor;

@RestController
@RequestMapping("/api/work/projects/{projectId}/activities")
public class ProjectActivityController {
    private final JdbcTemplate db;
    private final ProjectPermissionService permissions;

    public ProjectActivityController(JdbcTemplate db, ProjectPermissionService permissions) {
        this.db = db;
        this.permissions = permissions;
    }

    @GetMapping
    public WorkResponse<Map<String, Object>> list(
        @AuthenticationPrincipal WorkActor actor,
        @PathVariable long projectId,
        @RequestParam(defaultValue = "ALL") String category,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        permissions.requireInternalMember(projectId, actor);
        if (page < 0 || (size != 10 && size != 20 && size != 50) || (long) page * size > 100_000) {
            throw new WorkException(HttpStatus.BAD_REQUEST, "INVALID_PAGINATION", "Tham số phân trang không hợp lệ.");
        }
        String normalized = category == null ? "ALL" : category.strip().toUpperCase(Locale.ROOT);
        String filterClause = switch (normalized) {
            case "ALL" -> "";
            case "ALERT" -> " AND a.action = 'TASK_ALERT'";
            case "MEMBER" -> " AND (a.action LIKE 'MEMBER_%' OR a.action LIKE 'INVITATION_%' OR a.action LIKE 'JOIN_REQUEST_%')";
            case "TASK" -> " AND (a.action LIKE 'TASK_%' AND a.action <> 'TASK_ALERT' OR a.action LIKE 'TIMER_%' OR a.action LIKE 'TIME_ENTRY_%' OR a.action LIKE 'COMMENT_%')";
            default -> throw new WorkException(HttpStatus.BAD_REQUEST, "INVALID_CATEGORY", "Nhóm hoạt động không hợp lệ.");
        };

        Long total = db.queryForObject(
            "SELECT COUNT(*) FROM activity_logs a WHERE a.project_id = ?" + filterClause,
            Long.class,
            projectId
        );
        List<Map<String, Object>> items = ApiValues.utc(db.queryForList(
            """
            SELECT a.id, a.project_id, a.task_id, t.name AS task_title, a.actor_user_id,
                   a.action, a.entity_type, a.entity_id, a.before_data, a.after_data, a.reason, a.created_at
            FROM activity_logs a
            LEFT JOIN tasks t ON t.project_id = a.project_id AND t.id = a.task_id
            WHERE a.project_id = ?""" + filterClause + """
             ORDER BY a.created_at DESC, a.id DESC
            LIMIT ? OFFSET ?
            """,
            projectId,
            size,
            page * size
        ));
        return WorkResponse.read(Map.of(
            "items", items,
            "total", total == null ? 0L : total,
            "page", page,
            "size", size
        ));
    }
}

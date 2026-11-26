package vn.tasknest.workservice.api.collaboration;
import java.time.*;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.tasknest.workservice.application.WorkException;
import vn.tasknest.workservice.application.security.*;
import vn.tasknest.workservice.domain.project.ProjectRole;
import vn.tasknest.workservice.api.WorkResponse;
@RestController @RequestMapping("/api/work/projects/{projectId}/analytics")
public class ProjectAnalyticsController {
    private final JdbcTemplate db;private final ProjectPermissionService permissions;private final Clock clock;
    public ProjectAnalyticsController(JdbcTemplate db,ProjectPermissionService permissions,Clock clock){this.db=db;this.permissions=permissions;this.clock=clock;}
    @GetMapping public WorkResponse<Map<String,Object>> analytics(@AuthenticationPrincipal WorkActor actor,@PathVariable long projectId,@RequestParam(required=false) LocalDate from,@RequestParam(required=false) LocalDate to,@RequestParam(defaultValue="DAY") String group){
        var access=permissions.requireInternalMember(projectId,actor);LocalDate today=LocalDate.now(clock.withZone(ZoneId.of("Asia/Ho_Chi_Minh")));if(to==null)to=today;if(from==null)from=to.minusDays(29);
        if(from.isAfter(to)||java.time.temporal.ChronoUnit.DAYS.between(from,to)>366||!Set.of("DAY","WEEK").contains(group))throw new WorkException(HttpStatus.BAD_REQUEST,"INVALID_PERIOD","Khoảng thời gian tối đa 366 ngày; nhóm theo DAY hoặc WEEK.");
        String bucket=group.equals("DAY")?"DATE(DATE_ADD(s.reviewed_at,INTERVAL 7 HOUR))":"DATE_SUB(DATE(DATE_ADD(s.reviewed_at,INTERVAL 7 HOUR)),INTERVAL WEEKDAY(DATE_ADD(s.reviewed_at,INTERVAL 7 HOUR)) DAY)";
        var completions=db.queryForList("SELECT "+bucket+" period,t.id taskId,t.name title FROM task_submissions s JOIN tasks t ON t.id=s.task_id WHERE s.project_id=? AND s.decision='ACCEPTED' AND DATE(DATE_ADD(s.reviewed_at,INTERVAL 7 HOUR)) BETWEEN ? AND ? GROUP BY period,t.id,t.name ORDER BY period,t.id",projectId,from,to);
        var workload=db.queryForList("SELECT assignee_user_id userId,COUNT(*) openCount,SUM(status IN ('TODO','IN_PROGRESS') AND deadline_on<?) overdueCount,SUM(is_blocked) blockedCount FROM tasks WHERE project_id=? AND status NOT IN ('DONE','CANCELLED') GROUP BY assignee_user_id",today,projectId);
        boolean manager=access.role().canManage();
        var comparison=db.queryForList("SELECT t.id,t.name title,t.estimated_seconds estimatedSeconds,COALESCE((SELECT SUM(TIMESTAMPDIFF(MICROSECOND,e.started_at,COALESCE(e.ended_at,UTC_TIMESTAMP(6))))/1000000 FROM time_entries e WHERE e.task_id=t.id AND (? OR e.user_id=?)),0) loggedSeconds FROM tasks t WHERE t.project_id=? AND (? OR t.assignee_user_id=?) ORDER BY t.id",manager,actor.userId(),projectId,manager,actor.userId());
        return WorkResponse.read(Map.of("from",from,"to",to,"group",group,"completions",completions,"workload",workload,"comparison",comparison,"timeScope",manager?"PROJECT":"OWN_ASSIGNED_TASKS"));
    }
}

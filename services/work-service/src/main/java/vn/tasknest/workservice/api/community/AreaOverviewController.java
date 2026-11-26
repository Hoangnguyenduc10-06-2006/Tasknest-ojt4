package vn.tasknest.workservice.api.community;

import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import vn.tasknest.workservice.api.WorkResponse;
import vn.tasknest.workservice.application.security.*;

@RestController
@RequestMapping("/api/work/community/overview")
public class AreaOverviewController {
    private final JdbcTemplate db;
    private final ProjectPermissionService permissions;

    public AreaOverviewController(JdbcTemplate db, ProjectPermissionService permissions) {
        this.db = db;
        this.permissions = permissions;
    }

    @GetMapping("/customer")
    @Transactional(readOnly = true)
    public WorkResponse<Map<String,Object>> customer(@AuthenticationPrincipal WorkActor actor) {
        permissions.requireVerified(actor);
        String user = actor.userId();
        var requests = db.queryForList("""
            SELECT r.id,r.title,r.status,COUNT(p.id) proposal_count
            FROM customer_project_requests r LEFT JOIN team_project_proposals p
              ON p.request_id=r.id AND p.status='SUBMITTED'
            WHERE r.customer_user_id=? AND r.status='OPEN'
            GROUP BY r.id,r.title,r.status,r.updated_at ORDER BY r.updated_at DESC LIMIT 20
            """,user);
        var milestones = db.queryForList("""
            SELECT m.id,m.project_id,m.title,m.status,p.name project_name
            FROM project_milestones m JOIN team_engagements e ON e.project_id=m.project_id
            JOIN projects p ON p.id=e.project_id
            WHERE e.customer_user_id=? AND e.status='ACTIVE' AND p.status='ACTIVE' AND m.status IN ('DRAFT','IN_REVIEW')
            ORDER BY m.due_on,m.id LIMIT 20
            """,user);
        var projects = db.queryForList("""
            SELECT p.id,p.name,t.name team_name,e.status,
              EXISTS (SELECT 1 FROM project_agreements a WHERE a.project_id=p.id AND a.kickoff_at IS NULL) kickoff_pending,
              (SELECT COUNT(*) FROM project_milestones m WHERE m.project_id=p.id AND m.status<>'CANCELLED') milestones,
              (SELECT COUNT(*) FROM project_milestones m WHERE m.project_id=p.id AND m.status='ACCEPTED') accepted
            FROM team_engagements e JOIN projects p ON p.id=e.project_id JOIN dev_teams t ON t.id=e.team_id
            WHERE e.customer_user_id=? AND (e.status='COMPLETED' OR (e.status='ACTIVE' AND p.status='ACTIVE'))
            ORDER BY e.status='ACTIVE' DESC,p.updated_at DESC LIMIT 20
            """,user);
        var discussions = db.queryForList("""
            SELECT r.id request_id,r.title,p.id proposal_id,t.name team_name,COUNT(m.id) unread
            FROM customer_project_requests r JOIN team_project_proposals p ON p.request_id=r.id
            JOIN dev_teams t ON t.id=p.team_id JOIN proposal_messages m ON m.proposal_id=p.id
            LEFT JOIN proposal_message_reads seen ON seen.proposal_id=p.id AND seen.user_id=r.customer_user_id
            WHERE r.customer_user_id=? AND r.status='OPEN' AND p.status='SUBMITTED'
              AND m.sender_user_id<>r.customer_user_id AND m.id>COALESCE(seen.last_message_id,0)
            GROUP BY r.id,r.title,p.id,t.name ORDER BY MAX(m.id) DESC LIMIT 20
            """,user);
        return WorkResponse.read(Map.of("requests",requests,"milestones",milestones,"projects",projects,"discussions",discussions));
    }

    @GetMapping("/teams")
    @Transactional(readOnly = true)
    public WorkResponse<Map<String,Object>> teams(@AuthenticationPrincipal WorkActor actor, @RequestParam(required = false) Long teamId) {
        permissions.requireVerified(actor);
        String user = actor.userId();
        var teams = db.queryForList("""
            SELECT t.id,t.name,t.accepting_work,
              (SELECT COUNT(*) FROM team_engagements e JOIN projects p ON p.id=e.project_id
                  WHERE e.team_id=t.id AND e.status='ACTIVE' AND p.status='ACTIVE'
                    AND NOT EXISTS (SELECT 1 FROM project_agreements a WHERE a.project_id=p.id AND a.kickoff_at IS NULL)) active_projects,
              (SELECT COUNT(*) FROM team_project_proposals p JOIN customer_project_requests r ON r.id=p.request_id
                  WHERE p.team_id=t.id AND p.status='SUBMITTED' AND r.status='OPEN') pending_proposals,
              (SELECT COUNT(*) FROM project_milestones m JOIN team_engagements e ON e.project_id=m.project_id
                  JOIN projects pr ON pr.id=e.project_id
                  WHERE e.team_id=t.id AND e.status='ACTIVE' AND pr.status='ACTIVE'
                    AND m.due_on<DATE(UTC_TIMESTAMP()+INTERVAL 7 HOUR) AND m.status NOT IN ('ACCEPTED','CANCELLED')) overdue,
              (SELECT COUNT(*) FROM project_milestones m JOIN team_engagements e ON e.project_id=m.project_id
                  WHERE e.team_id=t.id AND m.status='ACCEPTED') accepted,
              (SELECT COUNT(*) FROM project_milestones m JOIN team_engagements e ON e.project_id=m.project_id
                  WHERE e.team_id=t.id AND m.status='ACCEPTED' AND DATE(m.accepted_at+INTERVAL 7 HOUR)<=m.due_on) on_time
            FROM dev_teams t WHERE t.owner_user_id=? ORDER BY t.id
            """,user);
        var workload = db.queryForList("""
            SELECT t.id team_id,m.user_id,m.display_name,COUNT(task.id) open_tasks
            FROM dev_teams t JOIN dev_team_members m ON m.team_id=t.id
            LEFT JOIN team_engagements e ON e.team_id=t.id AND e.status='ACTIVE'
            LEFT JOIN projects pr ON pr.id=e.project_id AND pr.status='ACTIVE'
            LEFT JOIN tasks task ON task.project_id=pr.id AND task.assignee_user_id=m.user_id
                AND task.status NOT IN ('DONE','CANCELLED')
            WHERE t.owner_user_id=? GROUP BY t.id,m.user_id,m.display_name ORDER BY open_tasks DESC,m.display_name
            """,user);
        var attention = db.queryForList("""
            WITH owned AS (
                SELECT id,name FROM dev_teams WHERE owner_user_id=? AND id=COALESCE(?,id)
            ), items AS (
                SELECT t.id team_id,t.name team_name,'KICKOFF' kind,p.id item_id,p.id target_id,p.name title,
                       e.accepted_at occurred_at,1 priority
                FROM owned t JOIN team_engagements e ON e.team_id=t.id AND e.status='ACTIVE'
                JOIN projects p ON p.id=e.project_id AND p.status='ACTIVE'
                JOIN project_agreements g ON g.project_id=p.id AND g.kickoff_at IS NULL
                UNION ALL
                SELECT t.id,t.name,'REWORK',m.id,m.project_id,m.title,m.updated_at,0
                FROM owned t JOIN team_engagements e ON e.team_id=t.id AND e.status='ACTIVE'
                JOIN projects p ON p.id=e.project_id AND p.status='ACTIVE'
                JOIN project_milestones m ON m.project_id=p.id AND m.status='CHANGES_REQUESTED'
                UNION ALL
                SELECT t.id,t.name,'APPLICATION',a.id,o.id,o.title,a.created_at,2
                FROM owned t JOIN team_openings o ON o.team_id=t.id AND o.status='OPEN'
                JOIN team_applications a ON a.opening_id=o.id AND a.status='PENDING'
            )
            SELECT team_id,team_name,kind,item_id,target_id,title
            FROM items ORDER BY priority,occurred_at,item_id LIMIT 20
            """,user,teamId);
        return WorkResponse.read(Map.of("teams",teams,"workload",workload,"attention",attention));
    }
}

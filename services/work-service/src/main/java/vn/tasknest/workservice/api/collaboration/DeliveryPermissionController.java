package vn.tasknest.workservice.api.collaboration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
@RestController
public class DeliveryPermissionController {
    private final JdbcTemplate db;public DeliveryPermissionController(JdbcTemplate db){this.db=db;}
    @GetMapping("/internal/work/delivery") public boolean allowed(@RequestParam long project,@RequestParam String user,@RequestParam(required=false) Long task){
        return db.queryForObject("SELECT COUNT(*) FROM project_memberships WHERE project_id=? AND user_id=? AND status='ACTIVE'",Long.class,project,user)==1&&(task==null||db.queryForObject("SELECT COUNT(*) FROM tasks t WHERE t.id=? AND t.project_id=? AND NOT EXISTS (SELECT 1 FROM team_engagements e WHERE e.project_id=t.project_id AND e.customer_user_id=?)",Long.class,task,project,user)==1);
    }
}

package vn.tasknest.workservice.application.workspace;

import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.tasknest.workservice.api.workspace.CreateTaskRequest;
import vn.tasknest.workservice.application.WorkException;
import vn.tasknest.workservice.application.security.*;
import vn.tasknest.workservice.domain.project.ProjectRole;
import tools.jackson.databind.json.JsonMapper;

@Service
public class TaskDetailsService {
    private final JdbcTemplate db;
    private final ProjectPermissionService permissions;
    private final Clock clock;
    private final WorkNotificationService notifications;
    private final JsonMapper json=new JsonMapper();
    public TaskDetailsService(JdbcTemplate db,ProjectPermissionService permissions,Clock clock,WorkNotificationService notifications){this.db=db;this.permissions=permissions;this.clock=clock;this.notifications=notifications;}
    private WorkException conflict(String text){return new WorkException(HttpStatus.CONFLICT,"TASK_CONFLICT",text);}
    private Map<String,Object> lock(long project,long task,long version){
        var rows=db.queryForList("SELECT * FROM tasks WHERE project_id=? AND id=? FOR UPDATE",project,task);
        if(rows.isEmpty())throw new WorkException(HttpStatus.NOT_FOUND,"TASK_NOT_FOUND","Không tìm thấy nhiệm vụ.");
        var row=rows.getFirst();
        if(((Number)row.get("version")).longValue()!=version)throw conflict("Nhiệm vụ đã thay đổi. Vui lòng tải lại.");
        if(Set.of("DONE","CANCELLED").contains(row.get("status")))throw conflict("Nhiệm vụ đã kết thúc. Cần mở lại trước khi sửa.");
        return row;
    }
    @Transactional public void update(WorkActor actor,long project,long task,long version,CreateTaskRequest input){
        permissions.requireManager(project,actor);
        if(permissions.isCustomer(project,input.assigneeId()))throw conflict("Không phân công công việc phát triển cho đại diện khách hàng.");
        var before=lock(project,task,version);
        if(input.deadlineOn().isBefore(input.startsOn()))throw conflict("Deadline không trước ngày bắt đầu.");
        LocalDate old=((java.sql.Date)before.get("starts_on")).toLocalDate();
        if(!old.equals(input.startsOn())&&input.startsOn().isBefore(LocalDate.now(clock.withZone(ZoneId.of("Asia/Ho_Chi_Minh")))))throw conflict("Ngày bắt đầu mới phải từ hôm nay; có thể giữ ngày cũ.");
        if(db.queryForObject("SELECT COUNT(*) FROM project_memberships WHERE project_id=? AND user_id=? AND status='ACTIVE'",Long.class,project,input.assigneeId())!=1)throw conflict("Người phụ trách không còn là thành viên.");
        var now=Timestamp.from(clock.instant());
        boolean reassigned = !input.assigneeId().equals(before.get("assignee_user_id"));
        if(reassigned){
            String previous=(String)before.get("assignee_user_id");
            db.update("INSERT INTO time_entry_locks(user_id) VALUES(?) ON DUPLICATE KEY UPDATE user_id=VALUES(user_id)",previous);
            db.update("UPDATE time_entries SET ended_at=?,updated_at=?,updated_by=?,version=version+1 WHERE task_id=? AND ended_at IS NULL",now,now,actor.userId(),task);
        }
        db.update("UPDATE tasks SET name=?,description=?,assignee_user_id=?,priority=?,starts_on=?,deadline_on=?,estimated_seconds=?,version=version+1,updated_at=? WHERE id=?",input.title(),input.description(),input.assigneeId(),input.priority(),input.startsOn(),input.deadlineOn(),input.estimatedSeconds(),now,task);
        if (reassigned) notifications.assigned(project, task, actor.userId(), input.assigneeId());
        audit(project,task,actor.userId(),"TASK_UPDATED",snapshot(before),Map.of("title",input.title(),"description",Objects.toString(input.description(),""),"assigneeId",input.assigneeId(),"priority",input.priority(),"startsOn",input.startsOn().toString(),"deadlineOn",input.deadlineOn().toString(),"estimatedSeconds",input.estimatedSeconds()));
    }
    @Transactional public void block(WorkActor actor,long project,long task,long version,boolean blocked,String reason){
        var access=permissions.requireDeveloper(project,actor);var before=lock(project,task,version);
        boolean isAssignee=actor.userId().equals(before.get("assignee_user_id"));
        boolean currentlyBlocked=Boolean.TRUE.equals(before.get("is_blocked")) || (before.get("is_blocked") instanceof Number flag && flag.intValue()!=0);
        boolean managerUnblock=access.role().canManage() && !blocked && currentlyBlocked;
        if(!isAssignee&&!managerUnblock)throw new WorkException(HttpStatus.FORBIDDEN,"TASK_FORBIDDEN","Chỉ người phụ trách được bật cờ; Owner hoặc Manager chỉ được gỡ cờ đang chặn kèm lý do.");
        if(reason==null||reason.isBlank()||reason.strip().length()>2000)throw conflict("Cần lý do từ 1 đến 2000 ký tự.");
        if(blocked){
            String assignee=(String)before.get("assignee_user_id");
            db.update("INSERT INTO time_entry_locks(user_id) VALUES(?) ON DUPLICATE KEY UPDATE user_id=VALUES(user_id)",assignee);
            db.queryForList("SELECT user_id FROM time_entry_locks WHERE user_id=? FOR UPDATE",assignee);
            var stoppedAt=Timestamp.from(clock.instant());
            int stopped=db.update("UPDATE time_entries SET ended_at=?,updated_at=?,updated_by=?,version=version+1 WHERE project_id=? AND task_id=? AND ended_at IS NULL",stoppedAt,stoppedAt,actor.userId(),project,task);
            if(stopped>0) audit(project,task,actor.userId(),"TIMER_STOPPED",Map.of("status","RUNNING"),Map.of("status","STOPPED","reason","TASK_BLOCKED"));
        }
        db.update("UPDATE tasks SET is_blocked=?,blocked_reason=?,updated_at=?,version=version+1 WHERE id=?",blocked,blocked?reason.strip():null,Timestamp.from(clock.instant()),task);
        audit(project,task,actor.userId(),"TASK_BLOCK_CHANGED",Map.of("blocked",before.get("is_blocked"),"reason",Objects.toString(before.get("blocked_reason"),"")),Map.of("blocked",blocked,"reason",reason.strip()));
    }
    private Map<String,Object> snapshot(Map<String,Object> row){var result=new LinkedHashMap<String,Object>();for(String key:List.of("name","description","assignee_user_id","priority","starts_on","deadline_on","estimated_seconds"))result.put(key,Objects.toString(row.get(key),""));return result;}
    private void audit(long project,long task,String actor,String action,Object before,Object after){db.update("INSERT INTO activity_logs(project_id,task_id,actor_user_id,action,entity_type,entity_id,before_data,after_data,created_at) VALUES(?,?,?,?,'TASK',?,?,?,?)",project,task,actor,action,String.valueOf(task),json.writeValueAsString(before),json.writeValueAsString(after),Timestamp.from(clock.instant()));}
    public List<Map<String,Object>> history(WorkActor actor,long project,long task){permissions.requireInternalMember(project,actor);return vn.tasknest.workservice.api.ApiValues.utc(db.queryForList("SELECT id,actor_user_id,action,before_data,after_data,created_at FROM activity_logs WHERE project_id=? AND task_id=? ORDER BY created_at DESC,id DESC LIMIT 200",project,task));}
}

package vn.tasknest.workservice.application.workspace;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.tasknest.workservice.api.workspace.CreateTaskRequest;
import vn.tasknest.workservice.application.WorkException;
import vn.tasknest.workservice.application.security.*;
import vn.tasknest.workservice.domain.project.*;

@Service
public class WorkspaceWriteService {
    private final JdbcTemplate db;
    private final ProjectPermissionService permissions;
    private final Clock clock;
    private final WorkNotificationService notifications;
    private final vn.tasknest.workservice.infrastructure.identity.IdentityDirectoryClient directory;
    public WorkspaceWriteService(JdbcTemplate db, ProjectPermissionService permissions, Clock clock, vn.tasknest.workservice.infrastructure.identity.IdentityDirectoryClient directory, WorkNotificationService notifications) {
        this.db=db; this.permissions=permissions; this.clock=clock; this.directory=directory;this.notifications=notifications;
    }
    private WorkException conflict(String message) { return new WorkException(HttpStatus.CONFLICT,"WORK_CONFLICT",message); }
    private WorkException forbidden() { return new WorkException(HttpStatus.FORBIDDEN,"WORK_FORBIDDEN","Bạn không có quyền thực hiện thao tác này."); }
    private WorkException notFound() { return new WorkException(HttpStatus.NOT_FOUND,"WORK_NOT_FOUND","Không tìm thấy dữ liệu hoặc không có quyền truy cập."); }
    private Instant instant(Object value) {
        if (value instanceof Timestamp timestamp) return timestamp.toInstant();
        if (value instanceof LocalDateTime dateTime) return dateTime.toInstant(ZoneOffset.UTC);
        throw new IllegalArgumentException("Unsupported database timestamp");
    }
    private Timestamp now() { return Timestamp.from(clock.instant()); }
    private void audit(Long projectId, Long taskId, String actor, String action, String before, String after) {
        db.update("INSERT INTO activity_logs(project_id,task_id,actor_user_id,action,entity_type,entity_id,before_data,after_data,created_at) VALUES(?,?,?,?, 'TASK',?, JSON_OBJECT('status',?),JSON_OBJECT('status',?),?)",
            projectId,taskId,actor,action,String.valueOf(taskId),before,after,now());
    }
    @Transactional public Long createTask(WorkActor actor, Long projectId, CreateTaskRequest input) {
        ProjectAccess access=permissions.requireDeveloper(projectId,actor);
        if (!access.role().canManage() && !actor.userId().equals(input.assigneeId())) throw forbidden();
        if(permissions.isCustomer(projectId,input.assigneeId())) throw conflict("Không phân công công việc phát triển cho đại diện khách hàng.");
        if (input.startsOn().isBefore(LocalDate.now(clock.withZone(ZoneId.of("Asia/Ho_Chi_Minh")))) || input.deadlineOn().isBefore(input.startsOn()))
            throw conflict("Ngày bắt đầu phải từ hôm nay; deadline không trước ngày bắt đầu.");
        if (Boolean.FALSE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM project_memberships WHERE project_id=? AND user_id=? AND status='ACTIVE')",Boolean.class,projectId,input.assigneeId()))) throw conflict("Người phụ trách không còn là thành viên dự án.");
        KeyHolder key=new GeneratedKeyHolder();
        db.update(connection -> {
            var statement=connection.prepareStatement("INSERT INTO tasks(project_id,name,description,assignee_user_id,created_by,priority,status,starts_on,deadline_on,estimated_seconds,created_at,updated_at) VALUES(?,?,?,?,?,?,'TODO',?,?,?,?,?)",java.sql.Statement.RETURN_GENERATED_KEYS);
            Object[] values={projectId,input.title(),input.description(),input.assigneeId(),actor.userId(),input.priority(),input.startsOn(),input.deadlineOn(),input.estimatedSeconds(),now(),now()};
            for(int i=0;i<values.length;i++) statement.setObject(i+1,values[i]);
            return statement;
        },key);
        Long id=Objects.requireNonNull(key.getKey()).longValue();
        db.update("INSERT INTO activity_logs(project_id,task_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES(?,?,?,'TASK_CREATED','TASK',?,JSON_OBJECT('assigneeId',?))",projectId,id,actor.userId(),String.valueOf(id),input.assigneeId());
        notifications.assigned(projectId, id, actor.userId(), input.assigneeId());
        return id;
    }
    private Map<String,Object> task(WorkActor actor, Long projectId, Long taskId) {
        permissions.requireDeveloper(projectId,actor);
        var rows=db.queryForList("SELECT * FROM tasks WHERE project_id=? AND id=? FOR UPDATE",projectId,taskId);
        if(rows.isEmpty()) throw notFound();
        return rows.getFirst();
    }
    @Transactional public Long startTimer(WorkActor actor, Long projectId, Long taskId) {
        var task=task(actor,projectId,taskId);
        if(!actor.userId().equals(task.get("assignee_user_id"))) throw forbidden();
        if(!"IN_PROGRESS".equals(task.get("status"))) throw conflict("Chỉ ghi giờ khi nhiệm vụ đang thực hiện.");
        if(Boolean.TRUE.equals(task.get("is_blocked")) || (task.get("is_blocked") instanceof Number flag && flag.intValue()!=0)) throw conflict("Nhiệm vụ đang bị chặn. Hãy gỡ cờ bị chặn trước khi ghi giờ.");
        db.update("INSERT INTO time_entry_locks(user_id) VALUES(?) ON DUPLICATE KEY UPDATE user_id=VALUES(user_id)",actor.userId());
        db.queryForList("SELECT user_id FROM time_entry_locks WHERE user_id=? FOR UPDATE",actor.userId());
        if(!db.queryForList("SELECT id FROM time_entries WHERE user_id=? AND ended_at IS NULL",actor.userId()).isEmpty()) throw conflict("Bạn đang có phiên ghi giờ khác. Hãy dừng phiên đó trước.");
        KeyHolder key=new GeneratedKeyHolder();
        db.update(connection->{
            var statement=connection.prepareStatement("INSERT INTO time_entries(project_id,task_id,user_id,source,started_at,created_by,updated_by,created_at,updated_at) VALUES(?,?,?,'TIMER',?,?,?,?,?)",java.sql.Statement.RETURN_GENERATED_KEYS);
            Object[] values={projectId,taskId,actor.userId(),now(),actor.userId(),actor.userId(),now(),now()};
            for(int i=0;i<values.length;i++) statement.setObject(i+1,values[i]);
            return statement;
        },key);
        audit(projectId,taskId,actor.userId(),"TIMER_STARTED",null,"RUNNING");
        return Objects.requireNonNull(key.getKey()).longValue();
    }
    @Transactional public void stopTimer(WorkActor actor, Long projectId, Long entryId) {
        permissions.requireWritable(projectId,actor);
        db.update("INSERT INTO time_entry_locks(user_id) VALUES(?) ON DUPLICATE KEY UPDATE user_id=VALUES(user_id)",actor.userId());
        db.queryForList("SELECT user_id FROM time_entry_locks WHERE user_id=? FOR UPDATE",actor.userId());
        var rows=db.queryForList("SELECT * FROM time_entries WHERE id=? AND project_id=? AND user_id=? FOR UPDATE",entryId,projectId,actor.userId());
        if(rows.isEmpty()) throw notFound();
        var entry=rows.getFirst();
        if(entry.get("ended_at")!=null) return;
        db.update("UPDATE time_entries SET ended_at=?,updated_at=?,updated_by=?,version=version+1 WHERE id=?",now(),now(),actor.userId(),entryId);
        audit(projectId,((Number)entry.get("task_id")).longValue(),actor.userId(),"TIMER_STOPPED","RUNNING","STOPPED");
    }
    @Transactional public void invitation(WorkActor actor, Long projectId, Long id, boolean accept) {
        permissions.requireVerified(actor);
        // Invited users are not members yet: lock project, then invitation, and validate recipient.
        var project=db.queryForList("SELECT status FROM projects WHERE id=? FOR UPDATE",projectId);
        if(project.isEmpty()) throw notFound();
        var rows=db.queryForList("SELECT * FROM project_invitations WHERE id=? AND project_id=? AND invitee_user_id=? FOR UPDATE",id,projectId,actor.userId());
        if(rows.isEmpty()) throw notFound();
        permissions.requireUncompleted(projectId);
        var invitation=rows.getFirst();
        if(!"ACTIVE".equals(project.getFirst().get("status"))) throw conflict("Dự án đã lưu trữ.");
        if(!"PENDING".equals(invitation.get("status")) || !instant(invitation.get("expires_at")).isAfter(clock.instant())) throw conflict("Lời mời đã được xử lý hoặc hết hạn.");
        if(accept) {
            db.update("INSERT INTO project_memberships(project_id,user_id,status,joined_at,added_by) VALUES(?,?,'ACTIVE',?,?) ON DUPLICATE KEY UPDATE status='ACTIVE',joined_at=VALUES(joined_at),added_by=VALUES(added_by),removed_at=NULL,removed_by=NULL",projectId,actor.userId(),now(),invitation.get("invited_by"));
            db.update("UPDATE project_join_requests SET status='CLOSED',resolved_at=?,resolved_by=?,close_reason='JOINED_BY_DIRECT_INVITATION' WHERE project_id=? AND user_id=? AND status='PENDING'",now(),actor.userId(),projectId,actor.userId());
        }
        db.update("UPDATE project_invitations SET status=?,resolved_at=?,resolved_by=? WHERE id=?",accept?"ACCEPTED":"REJECTED",now(),actor.userId(),id);
        db.update("INSERT INTO activity_logs(project_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES(?,?,?,'INVITATION',?,JSON_OBJECT('invitedBy',?))",projectId,actor.userId(),accept?"INVITATION_ACCEPTED":"INVITATION_REJECTED",String.valueOf(id),invitation.get("invited_by"));
    }
    @Transactional public void cancelRequest(WorkActor actor, Long projectId, Long id) {
        permissions.requireVerified(actor);
        var project=db.queryForList("SELECT status FROM projects WHERE id=? FOR UPDATE",projectId);
        if (project.isEmpty()) throw notFound();
        if (!"ACTIVE".equals(project.getFirst().get("status"))) throw conflict("Dự án đã lưu trữ chỉ được xem lại.");
        permissions.requireUncompleted(projectId);
        int changed=db.update("UPDATE project_join_requests SET status='CANCELLED',resolved_at=?,resolved_by=? WHERE id=? AND project_id=? AND user_id=? AND status='PENDING'",now(),actor.userId(),id,projectId,actor.userId());
        if(changed!=1) throw conflict("Yêu cầu không còn chờ duyệt hoặc bạn không có quyền hủy.");
    }
    public record JoinLink(Long projectId,String projectName,boolean member,String creatorName) {}
    public JoinLink link(WorkActor actor,String code) {
        permissions.requireVerified(actor);
        if(!code.matches("[0-9a-f]{64}")) throw notFound();
        var rows=db.queryForList("SELECT p.id,p.name,l.created_by FROM project_invitation_links l JOIN projects p ON p.id=l.project_id WHERE l.public_code=? AND l.status='ACTIVE' AND p.status='ACTIVE'",code);
        if(rows.isEmpty()) throw notFound();
        Long projectId=((Number)rows.getFirst().get("id")).longValue();
        boolean member=Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM project_memberships WHERE project_id=? AND user_id=? AND status='ACTIVE')",Boolean.class,projectId,actor.userId()));
        String creator=(String)rows.getFirst().get("created_by");
        return new JoinLink(projectId,(String)rows.getFirst().get("name"),member,directory.names(Set.of(creator)).getOrDefault(creator,creator));
    }
    @Transactional public Long join(WorkActor actor,String code,String reason) {
        JoinLink info=link(actor,code);
        db.queryForList("SELECT id FROM projects WHERE id=? FOR UPDATE",info.projectId());
        // Re-check link/project/membership after acquiring the project mutex.
        info=link(actor,code);
        permissions.requireUncompleted(info.projectId());
        if(info.member()) throw conflict("Bạn đã là thành viên dự án.");
        if(!db.queryForList("SELECT id FROM project_join_requests WHERE project_id=? AND user_id=? AND status='PENDING'",info.projectId(),actor.userId()).isEmpty()) throw conflict("Bạn đã có yêu cầu đang chờ duyệt.");
        var rejected=db.queryForList("SELECT resolved_at FROM project_join_requests WHERE project_id=? AND user_id=? AND status='REJECTED' ORDER BY resolved_at DESC LIMIT 1",info.projectId(),actor.userId());
        if(!rejected.isEmpty() && instant(rejected.getFirst().get("resolved_at")).plus(Duration.ofHours(24)).isAfter(clock.instant())) throw conflict("Cần chờ đủ 24 giờ sau khi bị từ chối trước khi gửi lại.");
        Long linkId=db.queryForObject("SELECT id FROM project_invitation_links WHERE public_code=? AND status='ACTIVE'",Long.class,code);
        db.update("INSERT INTO project_join_requests(project_id,user_id,invitation_link_id,reason,status,created_at) VALUES(?,?,?,?,'PENDING',?)",info.projectId(),actor.userId(),linkId,reason,now());
        Long requestId=db.queryForObject("SELECT id FROM project_join_requests WHERE project_id=? AND user_id=? AND status='PENDING'",Long.class,info.projectId(),actor.userId());
        db.update("INSERT INTO activity_logs(project_id,actor_user_id,action,entity_type,entity_id) VALUES(?,?,'JOIN_REQUEST_CREATED','JOIN_REQUEST',?)",info.projectId(),actor.userId(),String.valueOf(requestId));
        return info.projectId();
    }

}

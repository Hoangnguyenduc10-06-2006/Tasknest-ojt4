package vn.tasknest.workservice.application.workspace;

import java.sql.Timestamp;
import java.time.Clock;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.tasknest.workservice.application.WorkException;
import vn.tasknest.workservice.application.security.ProjectPermissionService;
import vn.tasknest.workservice.application.security.WorkActor;
import vn.tasknest.workservice.domain.project.ProjectRole;

@Service
public class TaskWorkflowService {
    private final JdbcTemplate db;
    private final ProjectPermissionService permissions;
    private final Clock clock;
    private final vn.tasknest.workservice.application.collaboration.ProjectFileService files;

    public TaskWorkflowService(JdbcTemplate db, ProjectPermissionService permissions, Clock clock, vn.tasknest.workservice.application.collaboration.ProjectFileService files) {
        this.db = db;
        this.permissions = permissions;
        this.clock = clock;
        this.files = files;
    }

    private WorkException conflict(String message) {
        return new WorkException(HttpStatus.CONFLICT, "TASK_TRANSITION_CONFLICT", message);
    }

    public record Submission(int number, String resultNote, String decision, java.time.Instant submittedAt, String resultUrl, Long fileId, String fileName) {}

    @Transactional(readOnly = true)
    public Submission latestSubmission(WorkActor actor, Long projectId, Long taskId) {
        permissions.requireInternalMember(projectId, actor);
        var rows = db.query("SELECT s.submission_no,s.result_note,s.decision,s.submitted_at,s.result_url,s.result_file_id,f.original_name FROM tasks t LEFT JOIN task_submissions s ON s.id=t.latest_submission_id AND s.task_id=t.id LEFT JOIN stored_files f ON f.id=s.result_file_id AND f.project_id=t.project_id WHERE t.project_id=? AND t.id=?",
            (rs, index) -> rs.getObject("submission_no") == null ? null : new Submission(rs.getInt("submission_no"), rs.getString("result_note"), rs.getString("decision"), rs.getTimestamp("submitted_at").toInstant(),rs.getString("result_url"),rs.getObject("result_file_id",Long.class),rs.getString("original_name")), projectId, taskId);
        if (rows.isEmpty()) throw new WorkException(HttpStatus.NOT_FOUND, "TASK_NOT_FOUND", "Không tìm thấy nhiệm vụ trong dự án.");
        return rows.getFirst();
    }

    @Transactional
    public void transition(WorkActor actor, Long projectId, Long taskId, long version,
            String target, String note, boolean confirmed) {
        transition(actor,projectId,taskId,version,target,note,confirmed,null,null,null,null);
    }

    @Transactional
    public void transition(WorkActor actor, Long projectId, Long taskId, long version,
            String target, String note, boolean confirmed, java.time.LocalDate deadlineOn, Long estimatedSeconds, String resultUrl, Long resultFileId) {
        var access = permissions.requireDeveloper(projectId, actor);
        var rows = db.queryForList("SELECT * FROM tasks WHERE project_id=? AND id=? FOR UPDATE", projectId, taskId);
        if (rows.isEmpty()) throw new WorkException(HttpStatus.NOT_FOUND, "TASK_NOT_FOUND", "Không tìm thấy nhiệm vụ trong dự án.");
        Map<String, Object> task = rows.getFirst();
        if (((Number) task.get("version")).longValue() != version)
            throw conflict("Nhiệm vụ đã thay đổi. Vui lòng tải lại trước khi thao tác.");
        String before = (String) task.get("status");
        String after = "REVIEW".equals(target) ? "IN_REVIEW" : target;
        boolean manager = access.role().canManage();
        boolean assignee = actor.userId().equals(task.get("assignee_user_id"));
        boolean start = "TODO".equals(before) && "IN_PROGRESS".equals(after);
        boolean submit = "IN_PROGRESS".equals(before) && "IN_REVIEW".equals(after);
        boolean approve = "IN_REVIEW".equals(before) && "DONE".equals(after);
        boolean reject = "IN_REVIEW".equals(before) && "IN_PROGRESS".equals(after);
        boolean reopen = "DONE".equals(before) && "IN_PROGRESS".equals(after);
        boolean cancel = Set.of("TODO", "IN_PROGRESS", "IN_REVIEW").contains(before) && "CANCELLED".equals(after);
        if (!(start || submit || approve || reject || reopen || cancel))
            throw conflict("Không được chuyển nhiệm vụ theo luồng trạng thái này.");
        if((start || submit) && !assignee)
            throw new WorkException(HttpStatus.FORBIDDEN, "TASK_FORBIDDEN", "Chỉ người phụ trách nhiệm vụ được bắt đầu hoặc gửi kết quả chờ duyệt.");
        if ((!manager && !assignee) || (!manager && (approve || reject || reopen || cancel)))
            throw new WorkException(HttpStatus.FORBIDDEN, "TASK_FORBIDDEN", "Bạn không có quyền chuyển trạng thái nhiệm vụ này.");
        String text = note == null ? "" : note.trim();
        if ((submit || reject || reopen || cancel) && (text.isEmpty() || text.length() > 4000))
            throw conflict("Vui lòng nhập ghi chú hoặc lý do từ 1 đến 4000 ký tự.");
        if (approve && !confirmed) throw conflict("Cần xác nhận kết quả đạt yêu cầu trước khi duyệt.");
        if(reject){
            var today=java.time.LocalDate.now(clock.withZone(java.time.ZoneId.of("Asia/Ho_Chi_Minh")));
            if(deadlineOn==null || deadlineOn.isBefore(today))
                throw conflict("Yêu cầu làm lại phải có deadline từ hôm nay.");
            if(task.get("starts_on") instanceof java.sql.Date startDate && deadlineOn.isBefore(startDate.toLocalDate()))
                throw conflict("Deadline giao lại không được trước ngày bắt đầu nhiệm vụ.");
        } else if(deadlineOn!=null || estimatedSeconds!=null) throw conflict("Chỉ cập nhật kế hoạch giao lại trong thao tác Yêu cầu làm lại.");
        if (estimatedSeconds != null && estimatedSeconds.longValue() != ((Number) task.get("estimated_seconds")).longValue())
            throw conflict("Giờ ước tính được giữ nguyên khi giao lại nhiệm vụ.");
        String url=resultUrl==null?"":resultUrl.trim();
        if(submit){
            if(url.isEmpty()==(resultFileId==null)) throw conflict("Chọn gửi một tệp hoặc một liên kết kết quả.");
            if(!url.isEmpty()) {
                try { var uri=java.net.URI.create(url); if(url.length()>2048 || uri.getHost()==null || uri.getUserInfo()!=null || !Set.of("https","http").contains(uri.getScheme())) throw new IllegalArgumentException(); }
                catch(IllegalArgumentException ex){throw conflict("Liên kết kết quả phải là địa chỉ HTTP/HTTPS hợp lệ.");}
            }
            if(resultFileId!=null) files.attach(actor,projectId,resultFileId,"PROJECT_DOCUMENT");
        } else if(!url.isEmpty() || resultFileId!=null) throw conflict("Chỉ đính kèm kết quả khi gửi chờ duyệt.");
        Timestamp now = Timestamp.from(clock.instant());
        Long latest = task.get("latest_submission_id") == null ? null : ((Number) task.get("latest_submission_id")).longValue();
        if (submit) {
            // The task lock serializes submission numbers and all review decisions.
            Integer next = db.queryForObject("SELECT COALESCE(MAX(submission_no),0)+1 FROM task_submissions WHERE task_id=?", Integer.class, taskId);
            var key = new GeneratedKeyHolder();
            db.update(connection -> {
                var statement = connection.prepareStatement("INSERT INTO task_submissions(project_id,task_id,submission_no,submitted_by,assignee_user_id,result_note,deadline_on_snapshot,submitted_at) VALUES(?,?,?,?,?,?,?,?)", java.sql.Statement.RETURN_GENERATED_KEYS);
                Object[] values = {projectId, taskId, next, actor.userId(), task.get("assignee_user_id"), text, task.get("deadline_on"), now};
                for (int i=0; i<values.length; i++) statement.setObject(i+1, values[i]);
                return statement;
            }, key);
            latest = Objects.requireNonNull(key.getKey()).longValue();
            db.update("UPDATE task_submissions SET result_url=?,result_file_id=? WHERE id=?",url.isEmpty()?null:url,resultFileId,latest);
        }
        if (approve || reject || (cancel && "IN_REVIEW".equals(before))) {
            if (latest == null) throw conflict("Nhiệm vụ không có lần nộp kết quả đang chờ duyệt.");
            int changed = db.update("UPDATE task_submissions SET decision=?,reviewed_by=?,reviewed_at=?,rejection_reason=? WHERE id=? AND task_id=? AND decision='PENDING'",
                approve ? "ACCEPTED" : "REJECTED", actor.userId(), now, approve ? null : text, latest, taskId);
            if (changed != 1) throw conflict("Lần nộp kết quả đã được xử lý. Vui lòng tải lại.");
        }
        if (submit || cancel) {
            // All timer writers lock the project before the per-user mutex.
            var users = new TreeSet<>(db.queryForList("SELECT DISTINCT user_id FROM time_entries WHERE project_id=? AND task_id=? AND ended_at IS NULL", String.class, projectId, taskId));
            users.add((String) task.get("assignee_user_id"));
            for (String user : users) {
                db.update("INSERT INTO time_entry_locks(user_id) VALUES(?) ON DUPLICATE KEY UPDATE user_id=VALUES(user_id)", user);
                db.queryForList("SELECT user_id FROM time_entry_locks WHERE user_id=? FOR UPDATE", user);
            }
            db.update("UPDATE time_entries SET ended_at=?,updated_at=?,updated_by=?,version=version+1 WHERE project_id=? AND task_id=? AND ended_at IS NULL", now, now, actor.userId(), projectId, taskId);
        }
        db.update("UPDATE tasks SET status=?,latest_submission_id=?,accepted_submission_id=?,completed_at=?,cancelled_at=?,cancellation_reason=?,version=version+1,updated_at=? WHERE id=? AND project_id=?",
            after, latest, approve ? latest : null, approve ? now : null, cancel ? now : null, cancel ? text : null, now, taskId, projectId);
        if(reject){
            db.update("UPDATE tasks SET deadline_on=?,estimated_seconds=? WHERE id=? AND project_id=?",deadlineOn,task.get("estimated_seconds"),taskId,projectId);
            db.update("INSERT INTO activity_logs(project_id,task_id,actor_user_id,action,entity_type,entity_id,before_data,after_data,created_at) VALUES(?,?,?,'TASK_UPDATED','TASK',?,JSON_OBJECT('deadline_on',?,'estimated_seconds',?),JSON_OBJECT('deadline_on',?,'estimated_seconds',?,'reason',?),?)",
                projectId,taskId,actor.userId(),String.valueOf(taskId),task.get("deadline_on"),task.get("estimated_seconds"),deadlineOn,task.get("estimated_seconds"),text,now);
        }
        db.update("INSERT INTO activity_logs(project_id,task_id,actor_user_id,action,entity_type,entity_id,before_data,after_data,created_at) VALUES(?,?,?,?,'TASK',?,JSON_OBJECT('status',?),JSON_OBJECT('status',?,'note',?,'submissionId',?,'assigneeId',?),?)",
            projectId, taskId, actor.userId(), "TASK_" + (start ? "STARTED" : submit ? "SUBMITTED" : approve ? "APPROVED" : reject ? "REJECTED" : reopen ? "REOPENED" : "CANCELLED"), String.valueOf(taskId), before, after, text, latest, task.get("assignee_user_id"), now);
    }
}

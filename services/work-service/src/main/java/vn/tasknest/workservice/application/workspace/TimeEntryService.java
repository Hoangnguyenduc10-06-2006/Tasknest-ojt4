package vn.tasknest.workservice.application.workspace;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.tasknest.workservice.application.WorkException;
import vn.tasknest.workservice.application.security.ProjectPermissionService;
import vn.tasknest.workservice.application.security.WorkActor;

@Service
public class TimeEntryService {
    private final JdbcTemplate db;
    private final ProjectPermissionService permissions;
    private final Clock clock;
    public TimeEntryService(JdbcTemplate db, ProjectPermissionService permissions, Clock clock) {
        this.db = db; this.permissions = permissions; this.clock = clock;
    }
    private WorkException conflict(String message) {
        return new WorkException(HttpStatus.CONFLICT, "TIME_CONFLICT", message);
    }
    private WorkException notFound() {
        return new WorkException(HttpStatus.NOT_FOUND, "TIME_NOT_FOUND", "Không tìm thấy phiên hoặc nhiệm vụ trong phạm vi được phép.");
    }
    private Map<String,Object> task(WorkActor actor, Long projectId, Long taskId) {
        permissions.requireDeveloper(projectId, actor);
        var rows = db.queryForList("SELECT * FROM tasks WHERE project_id=? AND id=? FOR UPDATE", projectId, taskId);
        if (rows.isEmpty()) throw notFound();
        var task = rows.getFirst();
        if (List.of("DONE", "CANCELLED").contains(task.get("status")))
            throw conflict("Không điều chỉnh giờ trên nhiệm vụ đã hoàn thành hoặc đã hủy.");
        return task;
    }
    private void lockUser(String userId) {
        // Upsert obtains an exclusive row lock immediately. INSERT IGNORE would
        // take a shared duplicate-key lock, allowing concurrent S -> X deadlocks.
        db.update("INSERT INTO time_entry_locks(user_id) VALUES(?) ON DUPLICATE KEY UPDATE user_id=VALUES(user_id)", userId);
        db.queryForList("SELECT user_id FROM time_entry_locks WHERE user_id=? FOR UPDATE", userId);
    }
    private void validate(String user, Instant start, Instant end, String reason, Long excluded) {
        if (start == null || end == null || !end.isAfter(start) || end.isAfter(clock.instant()))
            throw conflict("Giờ kết thúc phải sau giờ bắt đầu và không nằm trong tương lai.");
        if (reason == null || reason.isBlank() || reason.trim().length() > 4000)
            throw conflict("Lý do phải có từ 1 đến 4000 ký tự.");
        // A locking read sees commits made before the per-user mutex was acquired,
        // including intervals recorded on another project in another transaction.
        var overlap = db.queryForList("SELECT id FROM time_entries WHERE user_id=? AND (? IS NULL OR id<>?) AND started_at<? AND (ended_at IS NULL OR ended_at>?) FOR UPDATE",
            user, excluded, excluded, Timestamp.from(end), Timestamp.from(start));
        if (!overlap.isEmpty()) throw conflict("Khoảng thời gian trùng với phiên khác của bạn, kể cả phiên đang chạy.");
    }
    private Instant micros(Instant value) { return value == null ? null : value.truncatedTo(ChronoUnit.MICROS); }
    @Transactional
    public Long add(WorkActor actor, Long projectId, Long taskId, Instant startedAt, Instant endedAt, String reason) {
        var task = task(actor, projectId, taskId);
        if (!actor.userId().equals(task.get("assignee_user_id")))
            throw new WorkException(HttpStatus.FORBIDDEN, "TIME_FORBIDDEN", "Chỉ được bổ sung giờ cho nhiệm vụ bạn phụ trách.");
        lockUser(actor.userId());
        Instant start = micros(startedAt), end = micros(endedAt);
        validate(actor.userId(), start, end, reason, null);
        var key = new GeneratedKeyHolder();
        Timestamp now = Timestamp.from(clock.instant());
        db.update(connection -> {
            var statement = connection.prepareStatement("INSERT INTO time_entries(project_id,task_id,user_id,source,started_at,ended_at,manual_reason,created_by,updated_by,created_at,updated_at) VALUES(?,?,?,'MANUAL',?,?,?,?,?,?,?)", java.sql.Statement.RETURN_GENERATED_KEYS);
            Object[] values = {projectId,taskId,actor.userId(),Timestamp.from(start),Timestamp.from(end),reason.trim(),actor.userId(),actor.userId(),now,now};
            for (int i=0;i<values.length;i++) statement.setObject(i+1,values[i]);
            return statement;
        }, key);
        Long id = Objects.requireNonNull(key.getKey()).longValue();
        audit(projectId, taskId, id, actor.userId(), "TIME_ADDED", null, null, start, end, reason.trim(), now);
        return id;
    }
    @Transactional
    public void edit(WorkActor actor, Long projectId, Long entryId, long version, Instant startedAt, Instant endedAt, String reason) {
        // Acquire project/task before the user mutex, just like timer and task workflow writes.
        permissions.requireDeveloper(projectId, actor);
        var ids = db.queryForList("SELECT task_id FROM time_entries WHERE id=? AND project_id=? AND user_id=?", entryId,projectId,actor.userId());
        if (ids.isEmpty()) throw notFound();
        Long taskId = ((Number) ids.getFirst().get("task_id")).longValue();
        task(actor, projectId, taskId);
        lockUser(actor.userId());
        var rows = db.queryForList("SELECT * FROM time_entries WHERE id=? AND project_id=? AND user_id=? FOR UPDATE", entryId,projectId,actor.userId());
        if (rows.isEmpty()) throw notFound();
        var entry = rows.getFirst();
        if (((Number)entry.get("version")).longValue()!=version) throw conflict("Phiên đã thay đổi. Đóng cửa sổ và tải lại trước khi sửa.");
        if (entry.get("ended_at")==null) throw conflict("Hãy dừng phiên đang chạy trước khi chỉnh sửa.");
        Instant start = micros(startedAt), end = micros(endedAt);
        validate(actor.userId(), start, end, reason, entryId);
        Timestamp now = Timestamp.from(clock.instant());
        db.update("INSERT INTO time_entry_revisions(time_entry_id,revised_by,before_started_at,before_ended_at,after_started_at,after_ended_at,reason,revised_at) VALUES(?,?,?,?,?,?,?,?)",
            entryId,actor.userId(),entry.get("started_at"),entry.get("ended_at"),Timestamp.from(start),Timestamp.from(end),reason.trim(),now);
        db.update("UPDATE time_entries SET started_at=?,ended_at=?,updated_by=?,updated_at=?,version=version+1 WHERE id=?", Timestamp.from(start),Timestamp.from(end),actor.userId(),now,entryId);
        audit(projectId, taskId, entryId, actor.userId(), "TIME_EDITED", entry.get("started_at"),entry.get("ended_at"),start,end,reason.trim(),now);
    }
    private void audit(Long projectId, Long taskId, Long entryId, String actor, String action, Object oldStart, Object oldEnd, Instant start, Instant end, String reason, Timestamp now) {
        db.update("INSERT INTO activity_logs(project_id,task_id,actor_user_id,action,entity_type,entity_id,before_data,after_data,created_at) VALUES(?,?,?,?,'TIME_ENTRY',?,JSON_OBJECT('startedAt',?,'endedAt',?),JSON_OBJECT('startedAt',?,'endedAt',?,'reason',?),?)",
            projectId,taskId,actor,action,String.valueOf(entryId),oldStart,oldEnd,Timestamp.from(start),Timestamp.from(end),reason,now);
    }
    public record Revision(Long id, Long entryId, Long taskId, String taskTitle, String projectName,
        Instant beforeStartedAt, Instant beforeEndedAt, Instant afterStartedAt, Instant afterEndedAt, String reason, Instant revisedAt) {}
    @Transactional(readOnly = true)
    public List<Revision> revisions(WorkActor actor) {
        permissions.requireVerified(actor);
        return db.query("""
            SELECT r.*, e.task_id,t.name task_title,p.name project_name FROM time_entry_revisions r
            JOIN time_entries e ON e.id=r.time_entry_id JOIN tasks t ON t.id=e.task_id JOIN projects p ON p.id=e.project_id
            JOIN project_memberships m ON m.project_id=e.project_id AND m.user_id=? AND m.status='ACTIVE'
            WHERE e.user_id=? ORDER BY r.revised_at DESC,r.id DESC LIMIT 50
            """, (rs,n) -> new Revision(rs.getLong("id"),rs.getLong("time_entry_id"),rs.getLong("task_id"),rs.getString("task_title"),rs.getString("project_name"),
                rs.getTimestamp("before_started_at").toInstant(),rs.getTimestamp("before_ended_at").toInstant(),rs.getTimestamp("after_started_at").toInstant(),rs.getTimestamp("after_ended_at").toInstant(),rs.getString("reason"),rs.getTimestamp("revised_at").toInstant()), actor.userId(),actor.userId());
    }
}

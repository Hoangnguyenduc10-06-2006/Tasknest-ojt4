package vn.tasknest.workservice.application.submission;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.tasknest.workservice.api.PageResponse;
import vn.tasknest.workservice.api.submission.SubmissionHistoryQuery;
import vn.tasknest.workservice.api.submission.TaskSubmissionResponse;
import vn.tasknest.workservice.api.submission.TaskSubmissionResponse.*;
import vn.tasknest.workservice.application.WorkException;
import vn.tasknest.workservice.application.collaboration.ProjectFileService;
import vn.tasknest.workservice.application.security.ProjectPermissionService;
import vn.tasknest.workservice.application.security.WorkActor;
import vn.tasknest.workservice.infrastructure.identity.IdentityDirectoryClient;

@Service
public class TaskSubmissionHistoryService {
    private static final String HISTORY_SQL = """
        SELECT s.id,s.submission_no,s.submitted_by,s.assignee_user_id,s.submitted_at,s.result_note,
            s.result_url,s.result_file_id,f.original_name,
            (f.id IS NOT NULL AND f.status='READY' AND f.attached_at IS NOT NULL
                AND f.file_kind='PROJECT_DOCUMENT') file_available,
            s.decision,s.reviewed_by,s.reviewed_at,s.rejection_reason,s.deadline_on_snapshot,
            CASE WHEN s.decision<>'REJECTED' THEN s.decision
                WHEN EXISTS(SELECT 1 FROM activity_logs a
                    WHERE a.project_id=s.project_id AND a.task_id=s.task_id AND a.action='TASK_CANCELLED'
                    AND JSON_UNQUOTE(JSON_EXTRACT(a.before_data,'$.status'))='IN_REVIEW'
                    AND a.actor_user_id=s.reviewed_by AND a.created_at=s.reviewed_at
                    AND JSON_UNQUOTE(JSON_EXTRACT(a.after_data,'$.submissionId'))=CAST(s.id AS CHAR))
                    THEN 'TASK_CANCELLED'
                WHEN EXISTS(SELECT 1 FROM activity_logs a
                    WHERE a.project_id=s.project_id AND a.task_id=s.task_id AND a.action='TASK_REJECTED'
                    AND JSON_UNQUOTE(JSON_EXTRACT(a.before_data,'$.status'))='IN_REVIEW'
                    AND a.actor_user_id=s.reviewed_by AND a.created_at=s.reviewed_at
                    AND JSON_UNQUOTE(JSON_EXTRACT(a.after_data,'$.submissionId'))=CAST(s.id AS CHAR))
                    THEN 'REWORK_REQUESTED'
                ELSE 'REJECTED' END review_outcome
        FROM task_submissions s LEFT JOIN stored_files f ON f.id=s.result_file_id AND f.project_id=s.project_id
        WHERE s.project_id=? AND s.task_id=?
        ORDER BY s.submission_no DESC,s.id DESC LIMIT ? OFFSET ?
        """;

    private final JdbcTemplate db;
    private final ProjectPermissionService permissions;
    private final IdentityDirectoryClient directory;
    private final ProjectFileService files;

    public TaskSubmissionHistoryService(JdbcTemplate db, ProjectPermissionService permissions,
            IdentityDirectoryClient directory, ProjectFileService files) {
        this.db = db;
        this.permissions = permissions;
        this.directory = directory;
        this.files = files;
    }

    @Transactional(readOnly = true)
    public PageResponse<TaskSubmissionResponse> list(WorkActor actor, long projectId, long taskId,
            SubmissionHistoryQuery query) {
        permissions.requireInternalMember(projectId, actor);
        requireTask(projectId, taskId);
        if (query.page() < 0 || !query.isSizeValid() || !query.isOffsetValid()) {
            throw new WorkException(HttpStatus.BAD_REQUEST, "INVALID_PAGE", "Kiểm tra chỉ số trang và kích thước trang.");
        }
        long total = Objects.requireNonNull(db.queryForObject(
            "SELECT COUNT(*) FROM task_submissions WHERE project_id=? AND task_id=?", Long.class, projectId, taskId));
        int pages = Math.toIntExact(total / query.size() + (total % query.size() == 0 ? 0 : 1));
        if (query.offset() >= total) return new PageResponse<>(List.of(), query.page(), query.size(), total, pages);
        var rows = db.query(HISTORY_SQL, TaskSubmissionHistoryService::readRow, projectId, taskId, query.size(), query.offset());
        Set<String> ids = new HashSet<>();
        for (var row : rows) {
            ids.add(row.submittedBy());
            ids.add(row.assignee());
            if (row.reviewedBy() != null) ids.add(row.reviewedBy());
        }
        Map<String, String> names = ids.isEmpty() ? Map.of() : directory.names(ids);
        var content = rows.stream().map(row -> new TaskSubmissionResponse(row.id(), row.number(),
            person(row.submittedBy(), names), person(row.assignee(), names), row.submittedAt(), row.note(), row.url(),
            row.fileId() == null ? null : new ResultFile(row.fileId(), row.fileName(), row.fileAvailable()),
            row.decision(), row.outcome(), person(row.reviewedBy(), names), row.reviewedAt(), row.reason(), row.deadline())).toList();
        return new PageResponse<>(content, query.page(), query.size(), total, pages);
    }

    @Transactional(readOnly = true)
    public ProjectFileService.Download download(WorkActor actor, long projectId, long taskId, long submissionId) {
        permissions.requireInternalMember(projectId, actor);
        requireTask(projectId, taskId);
        var ids = db.query("""
            SELECT s.result_file_id FROM task_submissions s
            JOIN stored_files f ON f.id=s.result_file_id AND f.project_id=s.project_id
            WHERE s.project_id=? AND s.task_id=? AND s.id=? AND f.status='READY'
                AND f.attached_at IS NOT NULL AND f.file_kind='PROJECT_DOCUMENT'
            """, (rs, index) -> rs.getLong("result_file_id"), projectId, taskId, submissionId);
        if (ids.isEmpty()) throw new WorkException(HttpStatus.NOT_FOUND, "SUBMISSION_FILE_NOT_FOUND",
            "Lần nộp không có tệp hoặc tệp không còn khả dụng.");
        // Reuse the existing permission/status checks and private storage; never expose a storage key.
        return files.download(actor, projectId, ids.getFirst());
    }

    private void requireTask(long projectId, long taskId) {
        Long count = db.queryForObject("SELECT COUNT(*) FROM tasks WHERE project_id=? AND id=?", Long.class, projectId, taskId);
        if (count == null || count == 0) throw new WorkException(HttpStatus.NOT_FOUND, "TASK_NOT_FOUND",
            "Không tìm thấy nhiệm vụ trong dự án.");
    }

    private static Participant person(String id, Map<String, String> names) {
        return id == null ? null : new Participant(id, names.getOrDefault(id, id));
    }

    static Entry readRow(ResultSet rs, int index) throws SQLException {
        return new Entry(rs.getLong("id"), rs.getInt("submission_no"), rs.getString("submitted_by"),
            rs.getString("assignee_user_id"), instant(rs, "submitted_at"), rs.getString("result_note"), rs.getString("result_url"),
            rs.getObject("result_file_id", Long.class), rs.getString("original_name"), rs.getBoolean("file_available"),
            rs.getString("decision"), ReviewOutcome.valueOf(rs.getString("review_outcome")), rs.getString("reviewed_by"),
            instant(rs, "reviewed_at"), rs.getString("rejection_reason"), rs.getDate("deadline_on_snapshot").toLocalDate());
    }

    private static Instant instant(ResultSet rs, String field) throws SQLException {
        Timestamp value = rs.getTimestamp(field);
        return value == null ? null : value.toInstant();
    }

    record Entry(long id, int number, String submittedBy, String assignee, Instant submittedAt, String note,
            String url, Long fileId, String fileName, boolean fileAvailable, String decision, ReviewOutcome outcome,
            String reviewedBy, Instant reviewedAt, String reason, LocalDate deadline) {}
}

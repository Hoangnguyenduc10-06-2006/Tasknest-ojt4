package vn.tasknest.workservice.application.workspace;

import java.sql.*;
import java.time.*;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import vn.tasknest.workservice.api.workspace.WorkspaceResponse;
import vn.tasknest.workservice.api.workspace.WorkspaceResponse.*;
import vn.tasknest.workservice.application.security.*;
import vn.tasknest.workservice.infrastructure.identity.IdentityDirectoryClient;

@Service
public class ReadWorkspaceService {
    private final JdbcTemplate db;
    private final ProjectPermissionService permissions;
    private final IdentityDirectoryClient directory;
    public ReadWorkspaceService(JdbcTemplate db, ProjectPermissionService permissions, IdentityDirectoryClient directory) {
        this.db = db; this.permissions = permissions; this.directory = directory;
    }
    private static Instant instant(ResultSet rs, String field) throws SQLException {
        Timestamp value = rs.getTimestamp(field);
        return value == null ? null : value.toInstant();
    }
    public WorkspaceResponse read(WorkActor actor) {
        permissions.requireVerified(actor);
        String user = actor.userId();
        List<Member> members = db.query("""
            SELECT m.project_id, m.user_id, p.name project_name,
                CASE WHEN EXISTS(SELECT 1 FROM team_engagements ce WHERE ce.project_id=p.id AND ce.customer_user_id=m.user_id) THEN 'Customer' WHEN p.owner_user_id=m.user_id THEN 'Owner' WHEN p.manager_user_id=m.user_id THEN 'Manager' ELSE 'Member' END role
            FROM project_memberships m JOIN projects p ON p.id=m.project_id
            JOIN (SELECT project_id,user_id FROM project_memberships WHERE user_id=? AND status='ACTIVE' UNION SELECT project_id,customer_user_id FROM team_engagements WHERE customer_user_id=? AND status IN ('ACTIVE','COMPLETED')) mine ON mine.project_id=p.id
            WHERE m.status='ACTIVE' AND NOT EXISTS (SELECT 1 FROM team_engagements e WHERE e.project_id=p.id AND e.customer_user_id=mine.user_id) ORDER BY m.project_id, m.joined_at, m.user_id
            """, (rs,n) -> new Member(rs.getLong("project_id"),rs.getString("user_id"),null,rs.getString("role"),rs.getString("project_name")), user,user);
        List<Task> tasks = db.query("""
            SELECT t.*, accepted.submitted_at accepted_submitted_at,accepted.deadline_on_snapshot accepted_deadline_on,CASE WHEN NOT EXISTS(SELECT 1 FROM team_engagements ce WHERE ce.project_id=p.id AND ce.customer_user_id=mine.user_id) AND (p.owner_user_id=? OR p.manager_user_id=? OR t.assignee_user_id=?) THEN COALESCE((SELECT SUM(TIMESTAMPDIFF(MICROSECOND,e.started_at,COALESCE(e.ended_at,UTC_TIMESTAMP(6))))/1000000.0
                    FROM time_entries e WHERE e.task_id=t.id AND (p.owner_user_id=? OR p.manager_user_id=? OR e.user_id=?)),0) ELSE NULL END spent_seconds
            FROM tasks t JOIN projects p ON p.id=t.project_id LEFT JOIN task_submissions accepted ON accepted.id=t.accepted_submission_id
            JOIN (SELECT project_id,user_id FROM project_memberships WHERE user_id=? AND status='ACTIVE' UNION SELECT project_id,customer_user_id FROM team_engagements WHERE customer_user_id=? AND status IN ('ACTIVE','COMPLETED')) mine ON mine.project_id=t.project_id
            WHERE NOT EXISTS (SELECT 1 FROM team_engagements e WHERE e.project_id=t.project_id AND e.customer_user_id=mine.user_id)
            ORDER BY t.created_at DESC,t.id DESC
            """, (rs,n) -> new Task(rs.getLong("id"),rs.getLong("project_id"),rs.getString("name"),
                rs.getString("description"),rs.getString("assignee_user_id"),rs.getString("priority"),rs.getString("status"),
                rs.getDate("starts_on").toLocalDate(),rs.getDate("deadline_on").toLocalDate(),rs.getLong("estimated_seconds"),
                rs.getBoolean("is_blocked"),rs.getString("blocked_reason"),(Double)rs.getObject("spent_seconds",Double.class),
                rs.getLong("version"),instant(rs,"created_at"),instant(rs,"completed_at"),instant(rs,"accepted_submitted_at"),rs.getDate("accepted_deadline_on")==null?null:rs.getDate("accepted_deadline_on").toLocalDate()), user,user,user,user,user,user,user,user);
        List<TimeEntry> times = db.query("""
            SELECT e.*, t.name task_title,p.name project_name FROM time_entries e
            JOIN tasks t ON t.id=e.task_id JOIN projects p ON p.id=e.project_id
            JOIN (SELECT project_id,user_id FROM project_memberships WHERE user_id=? AND status='ACTIVE' UNION SELECT project_id,customer_user_id FROM team_engagements WHERE customer_user_id=? AND status IN ('ACTIVE','COMPLETED')) mine ON mine.project_id=e.project_id
            WHERE e.user_id=? AND NOT EXISTS (SELECT 1 FROM team_engagements ce WHERE ce.project_id=p.id AND ce.customer_user_id=mine.user_id) ORDER BY e.started_at DESC,e.id DESC
            """, (rs,n) -> new TimeEntry(rs.getLong("id"),rs.getLong("project_id"),rs.getLong("task_id"),
                rs.getString("task_title"),rs.getString("project_name"),instant(rs,"started_at"),instant(rs,"ended_at"),
                rs.getString("source"),rs.getLong("version")),user,user,user);
        List<Invitation> invitations = db.query("""
            SELECT i.*,p.name project_name, (p.status='ARCHIVED' OR EXISTS (SELECT 1 FROM team_engagements e WHERE e.project_id=p.id AND e.status='COMPLETED')) project_archived,
                CASE WHEN p.owner_user_id=i.invited_by THEN 'Owner'
                WHEN p.manager_user_id=i.invited_by THEN 'Manager' ELSE 'Member' END inviter_role,
                CASE WHEN i.status='PENDING' AND i.expires_at<=UTC_TIMESTAMP(6) THEN 'EXPIRED' ELSE i.status END effective_status
            FROM project_invitations i JOIN projects p ON p.id=i.project_id WHERE i.invitee_user_id=?
            ORDER BY i.created_at DESC,i.id DESC
            """, (rs,n) -> new Invitation(rs.getLong("id"),rs.getLong("project_id"),rs.getString("project_name"),
                rs.getString("invited_by"),null,rs.getString("inviter_role"),rs.getString("effective_status"),
                instant(rs,"created_at"),instant(rs,"expires_at"),rs.getBoolean("project_archived")),user);
        List<JoinRequest> requests = db.query("""
            SELECT r.*,p.name project_name, (p.status='ARCHIVED' OR EXISTS (SELECT 1 FROM team_engagements e WHERE e.project_id=p.id AND e.status='COMPLETED')) project_archived
            FROM project_join_requests r JOIN projects p ON p.id=r.project_id
            WHERE r.user_id=? ORDER BY r.created_at DESC,r.id DESC
            """, (rs,n) -> new JoinRequest(rs.getLong("id"),rs.getLong("project_id"),rs.getString("project_name"),
                rs.getString("reason"),rs.getString("status"),instant(rs,"created_at"),rs.getBoolean("project_archived")),user);
        List<Progress> progress = db.query("""
            SELECT e.project_id, COUNT(t.id) total, COALESCE(SUM(t.status='DONE'), 0) done
            FROM team_engagements e
            LEFT JOIN tasks t ON t.project_id=e.project_id AND t.status<>'CANCELLED'
            WHERE e.customer_user_id=? AND e.status IN ('ACTIVE','COMPLETED')
            GROUP BY e.project_id
            """, (rs,n) -> new Progress(rs.getLong("project_id"), rs.getLong("total"), rs.getLong("done")), user);
        Set<String> ids = new HashSet<>();
        members.forEach(m -> ids.add(m.id())); tasks.forEach(t -> ids.add(t.assigneeId()));
        invitations.forEach(i -> ids.add(i.inviterId()));
        Map<String,String> names = directory.names(ids);
        return new WorkspaceResponse(members.stream().map(m -> new Member(m.projectId(),m.id(),names.getOrDefault(m.id(),m.id()),m.role(),m.projectName())).toList(),
            tasks,times,invitations.stream().map(i -> new Invitation(i.id(),i.projectId(),i.projectName(),i.inviterId(),
                names.getOrDefault(i.inviterId(),i.inviterId()),i.inviterRole(),i.status(),i.createdAt(),i.expiresAt(),i.projectArchived())).toList(),requests,progress);
    }
}

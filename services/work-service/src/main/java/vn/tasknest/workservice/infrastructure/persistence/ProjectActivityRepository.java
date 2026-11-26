package vn.tasknest.workservice.infrastructure.persistence;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import vn.tasknest.workservice.domain.project.Project;

/** Uses the same datasource/transaction as JPA; no user or role information comes from the body. */
@Repository
public class ProjectActivityRepository {
    private final JdbcTemplate jdbc;
    public ProjectActivityRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    public void recordCreated(Project project, String actorId) {
        jdbc.update("""
            INSERT INTO activity_logs(project_id,actor_user_id,action,entity_type,entity_id,entity_version,after_data,created_at)
            VALUES (?,?,'PROJECT_CREATED','PROJECT',?,?,JSON_OBJECT('name',?,'startsOn',?,'endsOn',?),?)
            """, project.getId(), actorId, project.getId().toString(), project.getVersion(), project.getName(),
            project.getStartsOn().toString(), project.getEndsOn().toString(), Timestamp.from(project.getCreatedAt()));
    }
    public void recordUpdated(Project project, String beforeName, String beforeDescription,
            LocalDate beforeStartsOn, LocalDate beforeEndsOn, String actorId, Instant occurredAt) {
        jdbc.update("""
            INSERT INTO activity_logs(project_id,actor_user_id,action,entity_type,entity_id,entity_version,before_data,after_data,created_at)
            VALUES (?,?,'PROJECT_UPDATED','PROJECT',?,?,
                JSON_OBJECT('name',?,'description',?,'startsOn',?,'endsOn',?),
                JSON_OBJECT('name',?,'description',?,'startsOn',?,'endsOn',?),
                ?)
            """, project.getId(), actorId, project.getId().toString(), project.getVersion(),
            beforeName, beforeDescription, beforeStartsOn.toString(), beforeEndsOn.toString(),
            project.getName(), project.getDescription(), project.getStartsOn().toString(), project.getEndsOn().toString(),
            Timestamp.from(occurredAt));
    }
    public void recordArchived(Project project, String actorId, Instant occurredAt) {
        jdbc.update("""
            INSERT INTO activity_logs(project_id,actor_user_id,action,entity_type,entity_id,entity_version,before_data,after_data,created_at)
            VALUES (?,?,'PROJECT_ARCHIVED','PROJECT',?,?,
                JSON_OBJECT('status','ACTIVE'),
                JSON_OBJECT('status','ARCHIVED','archivedAt',?),
                ?)
            """, project.getId(), actorId, project.getId().toString(), project.getVersion(),
            occurredAt.toString(), Timestamp.from(occurredAt));
    }
    public void recordReopened(Project project, String actorId, Instant occurredAt) {
        jdbc.update("""
            INSERT INTO activity_logs(project_id,actor_user_id,action,entity_type,entity_id,entity_version,before_data,after_data,created_at)
            VALUES (?,?,'PROJECT_REOPENED','PROJECT',?,?,
                JSON_OBJECT('status','ARCHIVED'),
                JSON_OBJECT('status','ACTIVE'),
                ?)
            """, project.getId(), actorId, project.getId().toString(), project.getVersion(),
            Timestamp.from(occurredAt));
    }
}

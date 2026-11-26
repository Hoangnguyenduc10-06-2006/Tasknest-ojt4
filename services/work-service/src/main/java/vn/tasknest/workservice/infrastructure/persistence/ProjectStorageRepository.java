package vn.tasknest.workservice.infrastructure.persistence;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Quota row is created with the project; upload writers lock it before reserving bytes. */
@Repository
public class ProjectStorageRepository {
    private final JdbcTemplate jdbc;
    public ProjectStorageRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    public void initialize(Long projectId) {
        jdbc.update("INSERT INTO project_storage_usage(project_id) VALUES (?)", projectId);
    }
}

package vn.tasknest.workservice;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import vn.tasknest.workservice.api.project.ProjectActivityController;
import vn.tasknest.workservice.application.WorkException;
import vn.tasknest.workservice.application.security.ProjectPermissionService;
import vn.tasknest.workservice.application.security.WorkActor;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ProjectActivityControllerTest {
    private final JdbcTemplate db = mock(JdbcTemplate.class);
    private final ProjectPermissionService permissions = mock(ProjectPermissionService.class);
    private final ProjectActivityController controller = new ProjectActivityController(db, permissions);
    private final WorkActor actor = new WorkActor("00000000-0000-4000-8000-000000000001", true);

    @Test
    void returnsPaginatedProjectActivitiesForActiveMember() {
        when(db.queryForObject(startsWith("SELECT COUNT(*) FROM activity_logs"), eq(Long.class), eq(7L)))
            .thenReturn(2L);
        when(db.queryForList(contains("FROM activity_logs a"), eq(7L), eq(20), eq(0)))
            .thenReturn(List.of(
                new java.util.LinkedHashMap<>(Map.of("id", 10L, "project_id", 7L, "action", "TASK_CREATED", "created_at", Timestamp.from(Instant.parse("2026-11-20T01:00:00Z"))))
            ));

        var response = controller.list(actor, 7L, "ALL", 0, 20);

        verify(permissions).requireInternalMember(7L, actor);
        assertEquals(2L, response.data().get("total"));
        assertEquals(0, response.data().get("page"));
        assertEquals(20, response.data().get("size"));
        var items = (List<?>) response.data().get("items");
        assertEquals(1, items.size());
    }

    @Test
    void rejectsInvalidPaginationOrCategory() {
        var badPage = assertThrows(WorkException.class, () -> controller.list(actor, 7L, "ALL", -1, 20));
        assertEquals(HttpStatus.BAD_REQUEST, badPage.status());

        var badSize = assertThrows(WorkException.class, () -> controller.list(actor, 7L, "ALL", 0, 15));
        assertEquals(HttpStatus.BAD_REQUEST, badSize.status());

        var badCategory = assertThrows(WorkException.class, () -> controller.list(actor, 7L, "UNKNOWN", 0, 20));
        assertEquals(HttpStatus.BAD_REQUEST, badCategory.status());
    }
}

package vn.tasknest.workservice;

import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import vn.tasknest.workservice.application.WorkException;
import vn.tasknest.workservice.application.collaboration.ProjectFileService;
import vn.tasknest.workservice.application.security.*;
import vn.tasknest.workservice.application.workspace.TaskWorkflowService;
import vn.tasknest.workservice.domain.project.ProjectRole;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class TaskStartPermissionTest {
    @Test void managersCannotStartAnotherAssigneesTask() {
        for (var role : List.of(ProjectRole.OWNER, ProjectRole.MANAGER)) {
            var db = mock(JdbcTemplate.class);
            var permissions = mock(ProjectPermissionService.class);
            var actor = new WorkActor("00000000-0000-4000-8000-000000000001", true);
            when(permissions.requireDeveloper(1L, actor)).thenReturn(new ProjectAccess(null, role));
            when(db.queryForList("SELECT * FROM tasks WHERE project_id=? AND id=? FOR UPDATE", 1L, 2L))
                .thenReturn(List.of(Map.of("version", 0L, "status", "TODO", "assignee_user_id", "member")));
            var service = new TaskWorkflowService(db, permissions, Clock.systemUTC(), mock(ProjectFileService.class));
            var error = assertThrows(WorkException.class,
                () -> service.transition(actor, 1L, 2L, 0L, "IN_PROGRESS", null, false));
            assertEquals(HttpStatus.FORBIDDEN, error.status());
            verify(db).queryForList("SELECT * FROM tasks WHERE project_id=? AND id=? FOR UPDATE", 1L, 2L);
            verifyNoMoreInteractions(db);
        }
    }

}

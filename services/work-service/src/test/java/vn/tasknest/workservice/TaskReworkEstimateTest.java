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

class TaskReworkEstimateTest {
    @Test void reworkCannotChangeTheEstimateEvenThroughADirectApiCall() {
        var db = mock(JdbcTemplate.class);
        var permissions = mock(ProjectPermissionService.class);
        var actor = new WorkActor("00000000-0000-4000-8000-000000000001", true);
        when(permissions.requireDeveloper(1L, actor)).thenReturn(new ProjectAccess(null, ProjectRole.OWNER));
        when(db.queryForList("SELECT * FROM tasks WHERE project_id=? AND id=? FOR UPDATE", 1L, 2L))
            .thenReturn(List.of(Map.of("version", 0L, "status", "IN_REVIEW", "assignee_user_id", "member", "estimated_seconds", 3600L)));
        var service = new TaskWorkflowService(db, permissions, Clock.systemUTC(), mock(ProjectFileService.class));
        var error = assertThrows(WorkException.class,
            () -> service.transition(actor, 1L, 2L, 0L, "IN_PROGRESS", "Revise", false, LocalDate.of(2099, 12, 31), 7200L, null, null));
        assertEquals(HttpStatus.CONFLICT, error.status());
        verify(db).queryForList("SELECT * FROM tasks WHERE project_id=? AND id=? FOR UPDATE", 1L, 2L);
        verifyNoMoreInteractions(db);
    }
    @Test void reworkWithoutAnEstimatePreservesTheExistingBudget() {
        var db = mock(JdbcTemplate.class, invocation -> {
            if (invocation.getMethod().getName().equals("update")) return 1;
            return org.mockito.Answers.RETURNS_DEFAULTS.answer(invocation);
        });
        var permissions = mock(ProjectPermissionService.class);
        var actor = new WorkActor("00000000-0000-4000-8000-000000000001", true);
        when(permissions.requireDeveloper(1L, actor)).thenReturn(new ProjectAccess(null, ProjectRole.OWNER));
        when(db.queryForList("SELECT * FROM tasks WHERE project_id=? AND id=? FOR UPDATE", 1L, 2L))
            .thenReturn(List.of(Map.of("version", 0L, "status", "IN_REVIEW", "assignee_user_id", "member",
                "estimated_seconds", 3600L, "latest_submission_id", 3L)));
        var service = new TaskWorkflowService(db, permissions, Clock.systemUTC(), mock(ProjectFileService.class));
        var deadline = LocalDate.of(2099, 12, 31);
        assertDoesNotThrow(() -> service.transition(actor, 1L, 2L, 0L, "IN_PROGRESS", "Revise", false, deadline, null, null, null));
        verify(db).update("UPDATE tasks SET deadline_on=?,estimated_seconds=? WHERE id=? AND project_id=?",
            deadline, 3600L, 2L, 1L);
    }

}

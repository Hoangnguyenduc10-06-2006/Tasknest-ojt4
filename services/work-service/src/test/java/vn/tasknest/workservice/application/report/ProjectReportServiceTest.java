package vn.tasknest.workservice.application.report;

import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import vn.tasknest.workservice.application.WorkException;
import vn.tasknest.workservice.application.security.*;
import vn.tasknest.workservice.domain.project.*;
import vn.tasknest.workservice.infrastructure.identity.IdentityDirectoryClient;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static vn.tasknest.workservice.application.report.ProjectReportService.ReportType.*;

class ProjectReportServiceTest {
    private static final String USER = "00000000-0000-4000-8000-000000000001";
    private final WorkActor actor = new WorkActor(USER, true);
    private final LocalDate day = LocalDate.of(2026, 11, 4);
    private final NamedParameterJdbcTemplate db = mock(NamedParameterJdbcTemplate.class);
    private final ProjectPermissionService permissions = mock(ProjectPermissionService.class);
    private final IdentityDirectoryClient directory = mock(IdentityDirectoryClient.class);
    private final Clock clock = Clock.fixed(Instant.parse("2026-11-04T05:00:00Z"), ZoneOffset.UTC);
    private final ProjectReportService service = new ProjectReportService(db, permissions, directory, clock);

    @BeforeEach void setup() {
        role(ProjectRole.MEMBER);
        when(directory.names(anySet())).thenReturn(Map.of(USER, "Nguyễn An"));
        when(db.queryForList(anyString(), anyMap())).thenReturn(List.of());
    }

    private void role(ProjectRole role) {
        var project = Project.create(USER, "Dự án thử", "Mô tả", day, day.plusDays(10), clock.instant());
        when(permissions.requireInternalMember(7L, actor)).thenReturn(new ProjectAccess(project, role));
    }

    @Test void memberTaskExportScopesBothAssignmentAndTimeAtTheDatabase() {
        var row = new HashMap<String, Object>();
        row.putAll(Map.of("id", 2L, "name", "Nộp kết quả", "assignee_user_id", USER, "status", "IN_REVIEW",
            "priority", "HIGH", "starts_on", day, "deadline_on", day, "estimated_seconds", 7200L, "logged_seconds", 1800));
        when(db.queryForList(anyString(), anyMap())).thenReturn(List.of(row));
        var result = service.export(actor, 7, TASKS, day, day);
        String csv = new String(result.content(), StandardCharsets.UTF_8);
        assertTrue(csv.contains("Nguyễn An"));
        assertTrue(csv.contains("Chờ duyệt"));
        assertTrue(csv.contains("\"2.0000\",\"0.5000\""));
        assertEquals("tasknest-project-7-tasks-2026-11-04-2026-11-04.csv", result.filename());
        verify(db).queryForList(argThat(sql -> sql.contains("AND t.assignee_user_id=:user")
            && sql.contains("AND e.user_id=:user") && sql.contains("t.project_id=:project")),
            argThat((Map<String, ?> params) -> USER.equals(params.get("user")) && Long.valueOf(7L).equals(params.get("project"))));
    }

    @Test void managerAndOwnerCanExportProjectTimeWithoutTheMemberFilter() {
        for (var role : List.of(ProjectRole.OWNER, ProjectRole.MANAGER)) {
            role(role);
            service.export(actor, 7, TIME, day, day);
        }
        verify(db, times(2)).queryForList(argThat(sql -> sql.contains("e.project_id=:project")
            && !sql.contains("e.user_id=:user")), anyMap());
    }

    @Test void sprintExportProvidesOneReadableSnapshotWithoutTaskRows() {
        var row = new HashMap<String, Object>();
        row.put("open_tasks", 4L);
        row.put("created_tasks", 2L);
        row.put("completed_tasks", 1L);
        row.put("overdue_tasks", 1L);
        row.put("blocked_tasks", 1L);
        row.put("logged_seconds", 5400L);
        when(db.queryForList(anyString(), anyMap())).thenReturn(List.of(row));
        String csv = new String(service.export(actor, 7, SPRINT, day, day).content(), StandardCharsets.UTF_8);
        assertTrue(csv.contains("Nhiệm vụ hoàn thành trong kỳ"));
        assertTrue(csv.contains("\"Giờ làm trong kỳ\",\"1.5000\""));
        assertTrue(csv.contains("\"Nhiệm vụ quá hạn hiện tại\",\"1\""));
        verify(db).queryForList(argThat(sql -> sql.contains("completed_tasks")
            && sql.contains("AND t.assignee_user_id=:user") && sql.contains("AND e.user_id=:user")), anyMap());
    }

    @Test void clipsOvernightAndRunningTimeToVietnamDateAndOneSnapshot() {
        var overnight = new HashMap<String, Object>(Map.of("id", 1L, "task_id", 2L, "name", "Việc cũ", "user_id", USER,
            "source", "MANUAL", "started_at", Timestamp.from(Instant.parse("2026-11-03T16:00:00Z")),
            "ended_at", Timestamp.from(Instant.parse("2026-11-03T19:00:00Z"))));
        var running = new HashMap<String, Object>(Map.of("id", 3L, "task_id", 4L, "name", "Việc đang chạy", "user_id", USER,
            "source", "TIMER", "started_at", Timestamp.from(Instant.parse("2026-11-04T04:00:00Z"))));
        running.put("ended_at", null);
        when(db.queryForList(anyString(), anyMap())).thenReturn(List.of(overnight, running));
        String csv = new String(service.export(actor, 7, TIME, day, day).content(), StandardCharsets.UTF_8);
        assertTrue(csv.contains("2026-11-04T00:00+07:00"));
        assertTrue(csv.contains("\"2.0000\",\"Không\""));
        assertTrue(csv.contains("2026-11-04T12:00+07:00"));
        assertTrue(csv.contains("\"1.0000\",\"Có\""));
        verify(db).queryForList(argThat(sql -> sql.contains("e.user_id=:user") && !sql.contains("t.assignee_user_id=:user")),
            argThat((Map<String, ?> params) -> Timestamp.from(Instant.parse("2026-11-03T17:00:00Z")).equals(params.get("start"))
                && Timestamp.from(clock.instant()).equals(params.get("end"))));
    }

    @Test void clipsAPastSessionAtBothEndsOfTheSelectedDay() {
        var row = new HashMap<String, Object>(Map.of("id", 1L, "task_id", 2L, "name", "Phiên qua ngày", "user_id", USER,
            "source", "MANUAL", "started_at", Timestamp.from(Instant.parse("2026-11-02T16:00:00Z")),
            "ended_at", Timestamp.from(Instant.parse("2026-11-03T18:00:00Z"))));
        when(db.queryForList(anyString(), anyMap())).thenReturn(List.of(row));
        String csv = new String(service.export(actor, 7, TIME, day.minusDays(1), day.minusDays(1)).content(), StandardCharsets.UTF_8);
        assertTrue(csv.contains("2026-11-03T00:00+07:00"));
        assertTrue(csv.contains("2026-11-04T00:00+07:00"));
        assertTrue(csv.contains("\"24.0000\""));
    }

    @Test void rejectsOutsidersBeforeReadingAnyReportData() {
        when(permissions.requireInternalMember(7L, actor)).thenThrow(new WorkException(HttpStatus.NOT_FOUND, "PROJECT_NOT_FOUND", "Không có quyền."));
        assertThrows(WorkException.class, () -> service.export(actor, 7, TIME, day, day));
        verifyNoInteractions(db, directory);
    }

    @Test void validatesInclusivePeriodAndKeepsEmptyExportsReadable() {
        assertEquals(HttpStatus.BAD_REQUEST, assertThrows(WorkException.class,
            () -> service.export(actor, 7, TASKS, day, day.minusDays(1))).status());
        assertThrows(WorkException.class, () -> service.export(actor, 7, TASKS, day, day.plusDays(366)));
        verifyNoInteractions(db);
        String csv = new String(service.export(actor, 7, TASKS, day.minusDays(365), day).content(), StandardCharsets.UTF_8);
        assertTrue(csv.startsWith("\uFEFF\"ID dự án\""));
        assertEquals(1, csv.lines().count());
    }

    @Test void neverSilentlyTruncatesAnOversizedReport() {
        when(db.queryForList(anyString(), anyMap())).thenReturn(Collections.nCopies(10001, Map.of()));
        var error = assertThrows(WorkException.class, () -> service.export(actor, 7, TIME, day, day));
        assertEquals("REPORT_TOO_LARGE", error.code());
        verifyNoInteractions(directory);
    }
}

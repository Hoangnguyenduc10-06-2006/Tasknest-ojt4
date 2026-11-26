package vn.tasknest.workservice;

import java.math.BigDecimal;
import java.sql.Date;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Consumer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.TransactionTemplate;
import vn.tasknest.workservice.application.workspace.TaskAlertScheduler;
import vn.tasknest.workservice.application.workspace.WorkNotificationService;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class TaskAlertSchedulerTest {
    // 2026-11-05T18:00:00Z == 2026-11-06T01:00:00+07:00 -> Vietnam business date is 2026-11-06.
    private static final Clock FIXED_CLOCK = Clock.fixed(Instant.parse("2026-11-05T18:00:00Z"), ZoneOffset.UTC);
    private static final LocalDate TODAY_VN = LocalDate.of(2026, 11, 6);

    private JdbcTemplate db;
    private WorkNotificationService notifications;
    private TransactionTemplate tx;
    private TaskAlertScheduler scheduler;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        db = mock(JdbcTemplate.class);
        notifications = mock(WorkNotificationService.class);
        tx = mock(TransactionTemplate.class);
        doAnswer(invocation -> {
            ((Consumer<TransactionStatus>) invocation.getArgument(0)).accept(null);
            return null;
        }).when(tx).executeWithoutResult(any());
        when(notifications.managers(1L)).thenReturn(new LinkedHashSet<>(List.of("owner-1", "manager-1")));
        scheduler = new TaskAlertScheduler(db, notifications, tx, FIXED_CLOCK, 1);
    }

    private Map<String, Object> taskRow(long id, String status, LocalDate deadline, String assignee) {
        var row = new LinkedHashMap<String, Object>();
        row.put("id", id);
        row.put("project_id", 1L);
        row.put("name", "Thiết kế API nhắc hạn");
        row.put("status", status);
        row.put("deadline_on", Date.valueOf(deadline));
        row.put("assignee_user_id", assignee);
        row.put("estimated_seconds", 3600L);
        return row;
    }

    private void stubActiveTask(long id, Map<String, Object> lockedRow, BigDecimal spentMicros) {
        when(db.queryForList(contains("FROM tasks t"))).thenReturn(List.of(Map.of("id", id, "project_id", 1L)));
        when(db.queryForList("SELECT id FROM projects WHERE id=? AND status='ACTIVE' FOR UPDATE", 1L))
            .thenReturn(List.of(Map.of("id", 1L)));
        when(db.queryForList("SELECT * FROM tasks WHERE id=? AND status IN ('TODO','IN_PROGRESS','IN_REVIEW') FOR UPDATE", id))
            .thenReturn(lockedRow == null ? List.of() : List.of(lockedRow));
        when(db.queryForObject(contains("FROM time_entries"), eq(BigDecimal.class), eq(id))).thenReturn(spentMicros);
    }

    @Test
    void sendsUpcomingDeadlineReminderOneDayBeforeDeadline() {
        LocalDate tomorrow = TODAY_VN.plusDays(1);
        stubActiveTask(10L, taskRow(10L, "IN_PROGRESS", tomorrow, "member-1"), BigDecimal.ZERO);
        when(db.update(startsWith("INSERT IGNORE INTO task_alerts"), any(), any(), any(), any(), any(), any(), any(), any()))
            .thenReturn(1);
        when(db.update(startsWith("INSERT INTO activity_logs"), any(), any(), any(), any(), any())).thenReturn(1);

        scheduler.evaluate();

        verify(db).update(
            startsWith("INSERT IGNORE INTO task_alerts"),
            eq(1L),
            eq(10L),
            eq("DUE_SOON"),
            isNull(),
            isNull(),
            eq(3600L),
            eq(Date.valueOf(tomorrow)),
            any()
        );
        verify(notifications).task(
            eq(1L),
            eq(10L),
            isNull(),
            argThat(recipients -> new LinkedHashSet<>(recipients).equals(Set.of("owner-1", "manager-1", "member-1"))),
            eq("work.task.alert.due_soon"),
            eq("Nhiệm vụ sắp đến hạn"),
            argThat(body -> body.contains("Thiết kế API nhắc hạn") && body.contains(tomorrow.toString()))
        );
        verify(db).update(
            startsWith("INSERT INTO activity_logs"),
            eq(1L),
            eq(10L),
            eq("10"),
            eq("DUE_SOON"),
            eq(tomorrow.toString())
        );
    }

    @Test
    void deduplicatesUpcomingReminderWhenAlreadyRecordedForDeadline() {
        LocalDate tomorrow = TODAY_VN.plusDays(1);
        stubActiveTask(10L, taskRow(10L, "TODO", tomorrow, "member-1"), BigDecimal.ZERO);
        // Simulate INSERT IGNORE returning 0 because uq_task_alert already has (task_id, 'DUE_SOON', dedupe_scope).
        when(db.update(startsWith("INSERT IGNORE INTO task_alerts"), any(), any(), any(), any(), any(), any(), any(), any()))
            .thenReturn(0);

        scheduler.evaluate();

        verify(notifications, never()).task(anyLong(), anyLong(), any(), any(), anyString(), anyString(), anyString());
        verify(notifications, never()).task(anyLong(), anyLong(), any(), any(), anyString(), anyString());
        verify(db, never()).update(startsWith("INSERT INTO activity_logs"), any(), any(), any(), any(), any());
    }

    @Test
    void skipsCompletedAndCancelledTasksAndInReviewSubmissions() {
        // 1) Task transitioned to DONE or CANCELLED before row lock returns empty under status IN ('TODO','IN_PROGRESS','IN_REVIEW').
        stubActiveTask(11L, null, BigDecimal.ZERO);
        scheduler.evaluate();

        // 2) Even if a mocked row returned DONE or CANCELLED directly, guard still skips it.
        for (String terminalStatus : List.of("DONE", "CANCELLED")) {
            stubActiveTask(12L, taskRow(12L, terminalStatus, TODAY_VN.plusDays(1), "member-1"), BigDecimal.ZERO);
            scheduler.evaluate();
        }

        // 3) IN_REVIEW task due tomorrow is already submitted by assignee, so DUE_SOON is not sent.
        stubActiveTask(13L, taskRow(13L, "IN_REVIEW", TODAY_VN.plusDays(1), "member-1"), BigDecimal.ZERO);
        scheduler.evaluate();

        verify(db, never()).update(startsWith("INSERT IGNORE INTO task_alerts"), any(), any(), any(), any(), any(), any(), any(), any());
        verify(notifications, never()).task(anyLong(), anyLong(), any(), any(), anyString(), anyString(), anyString());
    }

    @Test
    void doesNotRemindTasksBeyondLeadWindowAndSendsOverdueInsteadWhenPastDeadline() {
        // Task due in 2 days (outside 1-day window) does not trigger DUE_SOON.
        stubActiveTask(20L, taskRow(20L, "TODO", TODAY_VN.plusDays(2), "member-1"), BigDecimal.ZERO);
        scheduler.evaluate();
        verify(db, never()).update(startsWith("INSERT IGNORE INTO task_alerts"), any(), any(), any(), any(), any(), any(), any(), any());

        // Task past deadline triggers OVERDUE, never DUE_SOON.
        LocalDate yesterday = TODAY_VN.minusDays(1);
        stubActiveTask(21L, taskRow(21L, "IN_PROGRESS", yesterday, "member-1"), BigDecimal.ZERO);
        when(db.update(startsWith("INSERT IGNORE INTO task_alerts"), any(), any(), any(), any(), any(), any(), any(), any()))
            .thenReturn(1);
        scheduler.evaluate();

        verify(notifications).task(
            eq(1L),
            eq(21L),
            isNull(),
            any(),
            eq("work.task.alert.overdue"),
            eq("Nhiệm vụ đã quá hạn thực hiện"),
            anyString()
        );
        verify(notifications, never()).task(anyLong(), anyLong(), any(), any(), eq("work.task.alert.due_soon"), anyString(), anyString());
    }
}


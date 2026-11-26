package vn.tasknest.workservice.application.submission;

import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import vn.tasknest.workservice.api.submission.SubmissionHistoryQuery;
import vn.tasknest.workservice.api.submission.TaskSubmissionResponse.ReviewOutcome;
import vn.tasknest.workservice.application.WorkException;
import vn.tasknest.workservice.application.collaboration.ProjectFileService;
import vn.tasknest.workservice.application.security.*;
import vn.tasknest.workservice.infrastructure.identity.IdentityDirectoryClient;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class TaskSubmissionHistoryServiceTest {
    private static final String USER = "00000000-0000-4000-8000-000000000001";
    private static final String FORMER = "00000000-0000-4000-8000-000000000002";
    private static final String REVIEWER = "00000000-0000-4000-8000-000000000003";
    private final WorkActor actor = new WorkActor(USER, true);
    private final JdbcTemplate db = mock(JdbcTemplate.class);
    private final ProjectPermissionService permissions = mock(ProjectPermissionService.class);
    private final IdentityDirectoryClient directory = mock(IdentityDirectoryClient.class);
    private final ProjectFileService files = mock(ProjectFileService.class);
    private final TaskSubmissionHistoryService service = new TaskSubmissionHistoryService(db, permissions, directory, files);
    private final SubmissionHistoryQuery query = new SubmissionHistoryQuery(null, null);

    @BeforeEach void setup() {
        when(db.queryForObject("SELECT COUNT(*) FROM tasks WHERE project_id=? AND id=?", Long.class, 7L, 9L)).thenReturn(1L);
        when(db.queryForObject("SELECT COUNT(*) FROM task_submissions WHERE project_id=? AND task_id=?", Long.class, 7L, 9L)).thenReturn(3L);
        when(directory.names(anySet())).thenReturn(Map.of(USER, "Nguyễn An", REVIEWER, "Người duyệt"));
    }

    private TaskSubmissionHistoryService.Entry row(long id, int number, ReviewOutcome outcome) {
        boolean pending = outcome == ReviewOutcome.PENDING;
        String decision = pending ? "PENDING" : outcome == ReviewOutcome.ACCEPTED ? "ACCEPTED" : "REJECTED";
        return new TaskSubmissionHistoryService.Entry(id, number, FORMER, USER, Instant.parse("2026-11-01T01:00:00Z"),
            "Kết quả " + number, null, null, null, false, decision, outcome, pending ? null : REVIEWER,
            pending ? null : Instant.parse("2026-11-01T02:00:00Z"), decision.equals("REJECTED") ? "Lý do" : null, LocalDate.of(2026, 11, 3));
    }

    @Test void returnsAllDecisionsNewestFirstWithCurrentNamesAndFormerUserFallback() {
        var rows = List.of(row(13, 3, ReviewOutcome.PENDING), row(12, 2, ReviewOutcome.ACCEPTED), row(11, 1, ReviewOutcome.REWORK_REQUESTED));
        doReturn(rows).when(db).query(contains("ORDER BY s.submission_no DESC,s.id DESC"), any(RowMapper.class), eq(7L), eq(9L), eq(20), eq(0L));
        var page = service.list(actor, 7, 9, query);
        assertEquals(List.of(3, 2, 1), page.content().stream().map(item -> item.number()).toList());
        assertEquals(3, page.totalElements());
        assertNull(page.content().getFirst().reviewedAt());
        assertNull(page.content().getFirst().file());
        assertNull(page.content().getFirst().resultUrl());
        assertEquals(FORMER, page.content().getFirst().submittedBy().name());
        assertEquals("Nguyễn An", page.content().getFirst().assignee().name());
        assertEquals("Người duyệt", page.content().get(1).reviewedBy().name());
        assertEquals(ReviewOutcome.REWORK_REQUESTED, page.content().get(2).reviewOutcome());
        verify(directory).names(Set.of(USER, FORMER, REVIEWER));
        verify(db).query(argThat(sql -> !sql.contains("latest_submission_id") && !sql.contains("WHERE s.decision=")),
            any(RowMapper.class), eq(7L), eq(9L), eq(20), eq(0L));
    }

    @Test void appliesPaginationInSqlAndKeepsTotalsOnAnEmptyPage() {
        doReturn(List.of(row(1, 1, ReviewOutcome.ACCEPTED))).when(db).query(anyString(), any(RowMapper.class), eq(7L), eq(9L), eq(10), eq(10L));
        when(db.queryForObject("SELECT COUNT(*) FROM task_submissions WHERE project_id=? AND task_id=?", Long.class, 7L, 9L)).thenReturn(11L);
        var second = service.list(actor, 7, 9, new SubmissionHistoryQuery(1, 10));
        assertEquals(2, second.totalPages());
        assertEquals(1, second.content().size());
        clearInvocations(directory);
        var empty = service.list(actor, 7, 9, new SubmissionHistoryQuery(2, 10));
        assertTrue(empty.content().isEmpty());
        assertEquals(11, empty.totalElements());
        assertEquals(2, empty.page());
        verifyNoInteractions(directory);
    }

    @Test void anExistingTaskWithNoSubmissionsReturnsAnEmptyPageWithoutDirectoryCalls() {
        when(db.queryForObject("SELECT COUNT(*) FROM task_submissions WHERE project_id=? AND task_id=?", Long.class, 7L, 9L)).thenReturn(0L);
        var page = service.list(actor, 7, 9, query);
        assertTrue(page.content().isEmpty());
        assertEquals(0, page.totalPages());
        verifyNoInteractions(directory, files);
    }

    @Test void rejectsMissingOrCrossProjectTasksBeforeLoadingHistory() {
        when(db.queryForObject("SELECT COUNT(*) FROM tasks WHERE project_id=? AND id=?", Long.class, 7L, 9L)).thenReturn(0L);
        assertEquals("TASK_NOT_FOUND", assertThrows(WorkException.class, () -> service.list(actor, 7, 9, query)).code());
        verify(db, never()).queryForObject(contains("FROM task_submissions"), eq(Long.class), any(), any());
        verifyNoInteractions(directory, files);
    }

    @Test void rejectsOutsidersAndRemovedMembersBeforeAnyDataOrFileAccess() {
        doThrow(new WorkException(HttpStatus.NOT_FOUND, "PROJECT_NOT_FOUND", "Không có quyền")).when(permissions).requireInternalMember(7L, actor);
        assertThrows(WorkException.class, () -> service.list(actor, 7, 9, query));
        assertThrows(WorkException.class, () -> service.download(actor, 7, 9, 11));
        verifyNoInteractions(db, directory, files);
    }

    @Test void rejectsInvalidAndOverflowingPagination() {
        for (var invalid : List.of(new SubmissionHistoryQuery(-1, 20), new SubmissionHistoryQuery(0, 0),
                new SubmissionHistoryQuery(0, 100), new SubmissionHistoryQuery(Integer.MAX_VALUE, 50))) {
            assertEquals(HttpStatus.BAD_REQUEST, assertThrows(WorkException.class, () -> service.list(actor, 7, 9, invalid)).status());
        }
        verify(db, never()).queryForObject(contains("FROM task_submissions"), eq(Long.class), any(), any());
    }

    @Test void usesExactReviewEventProvenanceAndPreservesAmbiguousLegacyRejections() {
        doReturn(List.of(row(12, 2, ReviewOutcome.TASK_CANCELLED), row(11, 1, ReviewOutcome.REJECTED)))
            .when(db).query(anyString(), any(RowMapper.class), eq(7L), eq(9L), eq(20), eq(0L));
        var page = service.list(actor, 7, 9, query);
        assertEquals(ReviewOutcome.TASK_CANCELLED, page.content().getFirst().reviewOutcome());
        assertEquals("REJECTED", page.content().getFirst().decision());
        assertEquals(ReviewOutcome.REJECTED, page.content().get(1).reviewOutcome());
        verify(db).query(argThat(sql -> sql.contains("a.action='TASK_CANCELLED'") && sql.contains("a.action='TASK_REJECTED'")
            && sql.contains("a.actor_user_id=s.reviewed_by") && sql.contains("a.created_at=s.reviewed_at")
            && sql.contains("'$.submissionId'") && sql.contains("JSON_EXTRACT(a.before_data,'$.status')")), any(RowMapper.class), eq(7L), eq(9L), eq(20), eq(0L));
    }

    @Test void doesNotHideIdentityDirectoryFailuresAsAnEmptyHistory() {
        doReturn(List.of(row(11, 1, ReviewOutcome.ACCEPTED))).when(db).query(anyString(), any(RowMapper.class), eq(7L), eq(9L), eq(20), eq(0L));
        when(directory.names(anySet())).thenThrow(new WorkException(HttpStatus.SERVICE_UNAVAILABLE, "DIRECTORY_UNAVAILABLE", "Thử lại"));
        assertEquals("DIRECTORY_UNAVAILABLE", assertThrows(WorkException.class, () -> service.list(actor, 7, 9, query)).code());
    }

    @Test void downloadsHistoricalFilesThroughTheExistingPrivateStorageChecks() {
        var expected = new ProjectFileService.Download("kết quả.pdf", "application/pdf", new byte[] {1, 2}, false);
        doReturn(List.of(44L)).when(db).query(contains("SELECT s.result_file_id"), any(RowMapper.class), eq(7L), eq(9L), eq(11L));
        when(files.download(actor, 7, 44)).thenReturn(expected);
        assertSame(expected, service.download(actor, 7, 9, 11));
        verify(permissions).requireInternalMember(7L, actor);
        verify(permissions, never()).requireWritable(anyLong(), any());
        verify(db).query(argThat(sql -> sql.contains("s.project_id=? AND s.task_id=? AND s.id=?")
            && sql.contains("f.project_id=s.project_id") && sql.contains("f.status='READY'")
            && sql.contains("f.attached_at IS NOT NULL") && sql.contains("f.file_kind='PROJECT_DOCUMENT'")),
            any(RowMapper.class), eq(7L), eq(9L), eq(11L));
    }

    @Test void rejectsLinkOnlyDeletedTemporaryAndMismatchedSubmissionFilesWithoutReadingBytes() {
        doReturn(List.of()).when(db).query(anyString(), any(RowMapper.class), eq(7L), eq(9L), eq(11L));
        assertEquals("SUBMISSION_FILE_NOT_FOUND", assertThrows(WorkException.class, () -> service.download(actor, 7, 9, 11)).code());
        verifyNoInteractions(files);
    }

    @Test void rowMappingRetainsMissingDeliverablesAndUnreviewedNulls() throws Exception {
        var rs = mock(ResultSet.class);
        when(rs.getLong("id")).thenReturn(11L);
        when(rs.getInt("submission_no")).thenReturn(1);
        when(rs.getString("decision")).thenReturn("PENDING");
        when(rs.getString("review_outcome")).thenReturn("PENDING");
        when(rs.getTimestamp("submitted_at")).thenReturn(Timestamp.from(Instant.EPOCH));
        when(rs.getDate("deadline_on_snapshot")).thenReturn(java.sql.Date.valueOf("2026-11-03"));
        var entry = TaskSubmissionHistoryService.readRow(rs, 0);
        assertNull(entry.fileId());
        assertNull(entry.url());
        assertNull(entry.reviewedBy());
        assertNull(entry.reviewedAt());
        assertEquals(Instant.EPOCH, entry.submittedAt());
    }

    @Test void metadataDistinguishesAnUnavailableFileFromALegacySubmissionWithNoFile() {
        var entry = new TaskSubmissionHistoryService.Entry(11, 1, USER, USER, Instant.EPOCH, "Kết quả cũ", null,
            44L, "file-cũ.pdf", false, "ACCEPTED", ReviewOutcome.ACCEPTED, REVIEWER, Instant.EPOCH, null, LocalDate.of(2026, 11, 3));
        doReturn(List.of(entry)).when(db).query(anyString(), any(RowMapper.class), eq(7L), eq(9L), eq(20), eq(0L));
        var file = service.list(actor, 7, 9, query).content().getFirst().file();
        assertEquals(44L, file.id());
        assertFalse(file.available());
        assertEquals("file-cũ.pdf", file.name());
    }
}

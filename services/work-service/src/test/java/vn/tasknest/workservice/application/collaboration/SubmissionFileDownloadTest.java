package vn.tasknest.workservice.application.collaboration;

import java.nio.file.*;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import vn.tasknest.workservice.application.WorkException;
import vn.tasknest.workservice.application.security.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class SubmissionFileDownloadTest {
    @TempDir Path root;
    private final JdbcTemplate db = mock(JdbcTemplate.class);
    private final ProjectPermissionService permissions = mock(ProjectPermissionService.class);
    private final WorkActor actor = new WorkActor("00000000-0000-4000-8000-000000000001", true);

    @Test void attachedOldResultsStayDownloadableAfterTheTemporaryUploadExpiry() throws Exception {
        var service = new ProjectFileService(db, permissions, Clock.systemUTC(), root.toString());
        byte[] bytes = "Kết quả đã nộp".getBytes(java.nio.charset.StandardCharsets.UTF_8);
        Files.write(root.resolve("old-result"), bytes);
        var row = new HashMap<String, Object>(Map.of("storage_key", "old-result", "mime_type", "application/pdf",
            "original_name", "kết-quả.pdf", "file_kind", "PROJECT_DOCUMENT", "uploaded_by", "another-member",
            "attached_at", Timestamp.from(Instant.EPOCH), "temporary_expires_at", Timestamp.from(Instant.EPOCH)));
        when(db.queryForList("SELECT * FROM stored_files WHERE project_id=? AND id=? AND status='READY'", 7L, 44L)).thenReturn(List.of(row));
        assertArrayEquals(bytes, service.download(actor, 7, 44).bytes());
        verify(permissions).requireInternalMember(7L, actor);
        verify(permissions, never()).requireWritable(7L, actor);
    }

    @Test void membershipRevocationBlocksEvenAKnownHistoricalFileId() throws Exception {
        var service = new ProjectFileService(db, permissions, Clock.systemUTC(), root.toString());
        doThrow(new WorkException(HttpStatus.NOT_FOUND, "PROJECT_NOT_FOUND", "Không có quyền")).when(permissions).requireInternalMember(7L, actor);
        assertThrows(WorkException.class, () -> service.download(actor, 7, 44));
        verifyNoInteractions(db);
    }
}

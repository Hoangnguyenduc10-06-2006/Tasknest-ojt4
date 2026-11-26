package vn.tasknest.workservice;

import java.time.*;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import vn.tasknest.workservice.api.*;
import vn.tasknest.workservice.api.submission.*;
import vn.tasknest.workservice.api.submission.TaskSubmissionResponse.*;
import vn.tasknest.workservice.application.WorkException;
import vn.tasknest.workservice.application.collaboration.ProjectFileService;
import vn.tasknest.workservice.application.security.*;
import vn.tasknest.workservice.application.submission.TaskSubmissionHistoryService;
import vn.tasknest.workservice.config.SecurityConfiguration;
import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = TaskSubmissionHistoryController.class,
    properties = {"spring.config.import=", "spring.cloud.config.enabled=false"})
@Import({SecurityConfiguration.class, WorkExceptionHandler.class})
class TaskSubmissionHistoryControllerTest {
    private static final String BASE = "/api/work/projects/7/tasks/9/submissions";
    private final WorkActor actor = new WorkActor("00000000-0000-4000-8000-000000000001", true);
    @Autowired MockMvc mvc;
    @MockitoBean IdentitySessionVerifier verifier;
    @MockitoBean TaskSubmissionHistoryService history;

    @BeforeEach void session() {
        when(verifier.verify("test-token")).thenReturn(actor);
    }

    @Test void returnsTheDocumentedPagedContractAndExplicitNullsForLegacyData() throws Exception {
        var person = new Participant(actor.userId(), "Nguyễn An");
        var item = new TaskSubmissionResponse(11, 1, person, person, Instant.EPOCH, "Kết quả cũ", null,
            null, "PENDING", ReviewOutcome.PENDING, null, null, null, LocalDate.of(2026, 11, 3));
        when(history.list(eq(actor), eq(7L), eq(9L), any())).thenReturn(new PageResponse<>(List.of(item), 0, 20, 1, 1));
        mvc.perform(get(BASE).header("Authorization", "Bearer test-token"))
            .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "private, no-store"))
            .andExpect(jsonPath("$.data.page").value(0)).andExpect(jsonPath("$.data.size").value(20))
            .andExpect(jsonPath("$.data.totalElements").value(1)).andExpect(jsonPath("$.data.totalPages").value(1))
            .andExpect(jsonPath("$.data.content[0].submittedBy.name").value("Nguyễn An"))
            .andExpect(jsonPath("$.data.content[0].number").value(1))
            .andExpect(jsonPath("$.data.content[0].resultUrl").value(nullValue()))
            .andExpect(jsonPath("$.data.content[0].file").value(nullValue()))
            .andExpect(jsonPath("$.data.content[0].reviewedBy").value(nullValue()))
            .andExpect(jsonPath("$.data.content[0].reviewedAt").value(nullValue()));
        verify(history).list(actor, 7, 9, new SubmissionHistoryQuery(0, 20));
    }

    @Test void acceptsAnExplicitPageAndSize() throws Exception {
        when(history.list(eq(actor), eq(7L), eq(9L), any())).thenReturn(new PageResponse<>(List.of(), 1, 10, 0, 0));
        mvc.perform(get(BASE).header("Authorization", "Bearer test-token").param("page", "1").param("size", "10"))
            .andExpect(status().isOk());
        verify(history).list(actor, 7, 9, new SubmissionHistoryQuery(1, 10));
    }

    @Test void rejectsNegativeUnsupportedMalformedAndOverflowingPages() throws Exception {
        String[][] cases = {{"-1", "20"}, {"0", "0"}, {"0", "100"}, {"2147483647", "50"}, {"no", "20"}, {"2147483648", "20"}};
        for (var input : cases) {
            mvc.perform(get(BASE).header("Authorization", "Bearer test-token").param("page", input[0]).param("size", input[1]))
                .andExpect(status().isBadRequest());
        }
        verifyNoInteractions(history);
    }

    @Test void rejectsCookieOnlyAndForgedIdentityForBothEndpoints() throws Exception {
        for (String path : List.of(BASE, BASE + "/11/file")) {
            mvc.perform(get(path).header("X-User-Id", actor.userId()).header("X-Role", "OWNER")
                    .cookie(new jakarta.servlet.http.Cookie("accessToken", "test-token")))
                .andExpect(status().isUnauthorized());
        }
        verifyNoInteractions(history);
    }

    @Test void rejectsUnverifiedAndRevokedSessions() throws Exception {
        when(verifier.verify("test-token")).thenReturn(new WorkActor(actor.userId(), false));
        mvc.perform(get(BASE).header("Authorization", "Bearer test-token")).andExpect(status().isForbidden());
        when(verifier.verify("test-token")).thenThrow(new WorkException(HttpStatus.UNAUTHORIZED, "INVALID_SESSION", "Thu hồi"));
        mvc.perform(get(BASE + "/11/file").header("Authorization", "Bearer test-token")).andExpect(status().isUnauthorized());
        verifyNoInteractions(history);
    }

    @Test void returnsNotFoundForAnInaccessibleTaskOrFile() throws Exception {
        when(history.list(eq(actor), eq(7L), eq(9L), any())).thenThrow(new WorkException(HttpStatus.NOT_FOUND, "TASK_NOT_FOUND", "Không có nhiệm vụ"));
        mvc.perform(get(BASE).header("Authorization", "Bearer test-token"))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("TASK_NOT_FOUND"));
        when(history.download(actor, 7, 9, 11)).thenThrow(new WorkException(HttpStatus.NOT_FOUND, "SUBMISSION_FILE_NOT_FOUND", "Không có tệp"));
        mvc.perform(get(BASE + "/11/file").header("Authorization", "Bearer test-token"))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("SUBMISSION_FILE_NOT_FOUND"));
    }

    @Test void downloadsHistoricalBytesAsAPrivateAttachment() throws Exception {
        byte[] bytes = new byte[] {1, 2, 3};
        when(history.download(actor, 7, 9, 11)).thenReturn(new ProjectFileService.Download("kết-quả.pdf", "application/pdf", bytes, false));
        mvc.perform(get(BASE + "/11/file").header("Authorization", "Bearer test-token"))
            .andExpect(status().isOk()).andExpect(content().contentType("application/pdf"))
            .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.startsWith("attachment;")))
            .andExpect(header().string("Cache-Control", "private, no-store"))
            .andExpect(header().string("X-Content-Type-Options", "nosniff"))
            .andExpect(content().bytes(bytes));
        verify(history).download(actor, 7, 9, 11);
    }
}

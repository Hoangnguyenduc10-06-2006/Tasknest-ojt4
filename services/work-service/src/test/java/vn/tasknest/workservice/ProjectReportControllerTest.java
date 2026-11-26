package vn.tasknest.workservice;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import vn.tasknest.workservice.api.WorkExceptionHandler;
import vn.tasknest.workservice.api.report.ProjectReportController;
import vn.tasknest.workservice.application.WorkException;
import vn.tasknest.workservice.application.report.ProjectReportService;
import vn.tasknest.workservice.application.security.*;
import vn.tasknest.workservice.config.SecurityConfiguration;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static vn.tasknest.workservice.application.report.ProjectReportService.ReportType.*;

@WebMvcTest(controllers = ProjectReportController.class, properties = {"spring.config.import=", "spring.cloud.config.enabled=false"})
@Import({SecurityConfiguration.class, WorkExceptionHandler.class})
class ProjectReportControllerTest {
    private static final String USER = "00000000-0000-4000-8000-000000000001";
    private static final String URL = "/api/work/projects/7/reports/export";
    @Autowired MockMvc mvc;
    @MockitoBean IdentitySessionVerifier verifier;
    @MockitoBean ProjectReportService reports;

    @BeforeEach void session() {
        when(verifier.verify("test-token")).thenReturn(new WorkActor(USER, true));
    }

    @Test void servesCsvAsAnAttachmentWithoutCaching() throws Exception {
        byte[] csv = "\uFEFF\"Nhiệm vụ\"\r\n".getBytes(StandardCharsets.UTF_8);
        when(reports.export(any(), eq(7L), eq(TASKS), any(), any()))
            .thenReturn(new ProjectReportService.Export("tasknest-project-7-tasks-2026-11-01-2026-11-04.csv", csv));
        mvc.perform(get(URL).header("Authorization", "Bearer test-token")
                .param("type", "TASKS").param("from", "2026-11-01").param("to", "2026-11-04"))
            .andExpect(status().isOk()).andExpect(content().contentType("text/csv;charset=UTF-8"))
            .andExpect(header().string("Content-Disposition", "attachment; filename=\"tasknest-project-7-tasks-2026-11-01-2026-11-04.csv\""))
            .andExpect(header().string("Cache-Control", "no-store"))
            .andExpect(content().bytes(csv));
        verify(reports).export(new WorkActor(USER, true), 7L, TASKS, LocalDate.of(2026, 11, 1), LocalDate.of(2026, 11, 4));
    }

    @Test void rejectsUnauthenticatedAndForgedIdentityRequests() throws Exception {
        mvc.perform(get(URL).header("X-User-Id", USER).header("X-Role", "OWNER")
                .param("type", "TIME").param("from", "2026-11-01").param("to", "2026-11-04"))
            .andExpect(status().isUnauthorized());
        verifyNoInteractions(reports);
    }

    @Test void rejectsUnknownTypeAndMalformedOrMissingDates() throws Exception {
        for (String type : new String[] {"OTHER", "TASKS"}) {
            mvc.perform(get(URL).header("Authorization", "Bearer test-token")
                    .param("type", type).param("from", "invalid").param("to", "2026-11-04"))
                .andExpect(status().isBadRequest());
        }
        mvc.perform(get(URL).header("Authorization", "Bearer test-token").param("type", "TIME"))
            .andExpect(status().isBadRequest());
        verifyNoInteractions(reports);
    }

    @Test void propagatesPermissionFailureWithoutReturningAFile() throws Exception {
        when(reports.export(any(), anyLong(), any(), any(), any()))
            .thenThrow(new WorkException(HttpStatus.NOT_FOUND, "PROJECT_NOT_FOUND", "Không có quyền."));
        mvc.perform(get(URL).header("Authorization", "Bearer test-token")
                .param("type", "TIME").param("from", "2026-11-01").param("to", "2026-11-04"))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("PROJECT_NOT_FOUND"));
    }
}

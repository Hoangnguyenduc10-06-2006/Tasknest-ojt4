package vn.tasknest.aiservice;

import vn.tasknest.aiservice.config.AiProperties;
import vn.tasknest.aiservice.config.AiSecurity;
import vn.tasknest.aiservice.api.AiController;
import vn.tasknest.aiservice.api.AiErrors;
import vn.tasknest.aiservice.application.AiException;
import vn.tasknest.aiservice.application.AiChatService;
import vn.tasknest.aiservice.application.AiProvider;
import vn.tasknest.aiservice.infrastructure.identity.IdentitySessions;
import vn.tasknest.aiservice.infrastructure.work.TaskContext;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.http.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = {AiController.class, vn.tasknest.aiservice.api.DashboardBriefController.class}, properties = {"spring.config.import=", "spring.cloud.config.enabled=false"})
@Import({AiSecurity.class, AiErrors.class})
class AiSecurityTest {
    @Autowired MockMvc mvc;
    @MockitoBean IdentitySessions sessions;
    @MockitoBean AiChatService service;
    @MockitoBean AiProperties properties;
    @MockitoBean vn.tasknest.aiservice.application.DashboardBriefService dashboard;
    @MockitoBean vn.tasknest.aiservice.infrastructure.work.TaskContext context;
    @Test void anonymousCannotCallChat() throws Exception {
        mvc.perform(post("/api/ai/chat").contentType(MediaType.APPLICATION_JSON).content("{\"message\":\"Xin chào\"}"))
            .andExpect(status().isUnauthorized()); verifyNoInteractions(service);
    }
    @Test void rejectsRevokedSessionBeforeProvider() throws Exception {
        when(sessions.verify("revoked")).thenThrow(new AiException(HttpStatus.UNAUTHORIZED, "INVALID_SESSION", "Hết phiên"));
        mvc.perform(post("/api/ai/chat").header("Authorization", "Bearer revoked").contentType(MediaType.APPLICATION_JSON).content("{\"message\":\"Xin chào\"}"))
            .andExpect(status().isUnauthorized()); verifyNoInteractions(service);
    }
    @Test void rejectsUnverifiedEmail() throws Exception {
        when(sessions.verify("unverified")).thenThrow(new AiException(HttpStatus.FORBIDDEN, "EMAIL_NOT_VERIFIED", "Chưa xác minh"));
        mvc.perform(get("/api/ai/status").header("Authorization", "Bearer unverified")).andExpect(status().isForbidden());
    }
    @Test void usesIdentityUserInsteadOfClientSuppliedUser() throws Exception {
        when(sessions.verify("valid")).thenReturn("real-user");
        when(service.chat("real-user", "Xin chào")).thenReturn(new AiProvider.Answer("Xin chào", "model", 10, 10));
        mvc.perform(post("/api/ai/chat").header("Authorization", "Bearer valid").contentType(MediaType.APPLICATION_JSON)
            .content("{\"message\":\"Xin chào\",\"userId\":\"victim\",\"model\":\"other\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.text").value("Xin chào"));
        verify(service).chat("real-user", "Xin chào");
    }
    @Test void boundsJsonBodyBeforeDeserialization() throws Exception {
        when(sessions.verify("valid")).thenReturn("real-user");
        mvc.perform(post("/api/ai/chat").header("Authorization", "Bearer valid").contentType(MediaType.APPLICATION_JSON)
            .content("{\"message\":\"" + "x".repeat(9000) + "\"}"))
            .andExpect(status().isPayloadTooLarge()); verifyNoInteractions(service);
    }
    @Test void validatesMessageBeforeCallingProvider() throws Exception {
        when(sessions.verify("valid")).thenReturn("real-user");
        mvc.perform(post("/api/ai/chat").header("Authorization", "Bearer valid").contentType(MediaType.APPLICATION_JSON).content("{\"message\":\" \"}"))
            .andExpect(status().isBadRequest()); verifyNoInteractions(service);
    }
    @Test void deniedContextNeverCallsModel() throws Exception {
        when(sessions.verify("valid")).thenReturn("real-user");
        when(context.conversation("valid", "real-user", null, 9L, "Phân tích"))
            .thenThrow(new AiException(HttpStatus.NOT_FOUND, "AI_TASK_NOT_FOUND", "Không có quyền xem"));
        mvc.perform(post("/api/ai/chat").header("Authorization", "Bearer valid").contentType(MediaType.APPLICATION_JSON)
            .content("{\"message\":\"Phân tích\",\"taskId\":9}"))
            .andExpect(status().isNotFound());
        verifyNoInteractions(service);
    }
    @Test void usesServerSnapshotAndReturnsAuthoritativeSource() throws Exception {
        when(sessions.verify("valid")).thenReturn("real-user");
        var source = new TaskContext.Source("TSK-9", "/tasks/9", "2026-11-05", 3.0, null);
        var task = new TaskContext.ProjectTask(source, null, "Kiểm thử", "Thành viên", true, "TODO",
            "HIGH", null, false, null, null, java.util.List.of());
        when(context.conversation("valid", "real-user", null, 9L, "Phân tích"))
            .thenReturn(new TaskContext.Conversation(1L, "Dự án", 9L, java.util.List.of(task)));
        when(service.contextBudget(anyString())).thenReturn(4000);
        when(service.chat(eq("real-user"), anyString())).thenReturn(new AiProvider.Answer("Gợi ý", "model", 1, 1));
        mvc.perform(post("/api/ai/chat").header("Authorization", "Bearer valid").contentType(MediaType.APPLICATION_JSON)
            .content("{\"message\":\"Phân tích\",\"taskId\":9,\"context\":\"forged private data\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.sources[0].estimatedHours").value(3.0))
            .andExpect(jsonPath("$.data.sources[0].href").value("/tasks/9"));
        var prompt = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(service).chat(eq("real-user"), prompt.capture());
        org.assertj.core.api.Assertions.assertThat(prompt.getValue()).contains("estimatedHours").doesNotContain("forged private data");
    }
    @ParameterizedTest
    @ValueSource(strings = {"Tôi có việc nào không xong?", "Tôi còn việc nào chưa xong?"})
    void openWorkAnswersFromProjectDataWithoutCallingProvider(String question) throws Exception {
        when(sessions.verify("valid")).thenReturn("real-user");
        var own = new TaskContext.Source("TSK-87", "/tasks/87", "2026-11-23", 8, null);
        var upstream = new TaskContext.Source("TSK-82", "/tasks/82", "2026-11-14", 6, null);
        var ref = new TaskContext.Prerequisite("TSK-82", "Hoàn thiện nhật ký", "Người phụ trách", "IN_PROGRESS", upstream);
        var task = new TaskContext.ProjectTask(own, null, "Kiểm thử staging", "Người hỏi", true, "TODO", "HIGH",
            null, true, "Chờ TSK-82 hoàn thành", null, java.util.List.of(ref));
        when(context.conversation("valid", "real-user", 1L, null, question))
            .thenReturn(new TaskContext.Conversation(1L, "Dự án", null, java.util.List.of(task)));
        mvc.perform(post("/api/ai/chat").header("Authorization", "Bearer valid").contentType(MediaType.APPLICATION_JSON)
            .content("{\"message\":\"%s\",\"projectId\":1}".formatted(question)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.text").value(org.hamcrest.Matchers.containsString("Người phụ trách phụ trách (đang thực hiện)")))
            .andExpect(jsonPath("$.data.sources[1].href").value("/tasks/82"));
        verifyNoInteractions(service);
    }
    @Test void dashboardRejectsAnonymousUser() throws Exception {
        mvc.perform(post("/api/ai/dashboard")).andExpect(status().isUnauthorized());
        verifyNoInteractions(dashboard);
    }
}

package vn.tasknest.aiservice;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import tools.jackson.databind.json.JsonMapper;
import vn.tasknest.aiservice.application.*;
import vn.tasknest.aiservice.infrastructure.work.TaskContext;
import java.time.*;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;

class DashboardBriefServiceTest {
    final TaskContext context = mock(TaskContext.class);
    final AiChatService chat = mock(AiChatService.class);
    final Clock clock = mock(Clock.class);
    DashboardBriefService service() {
        when(clock.instant()).thenReturn(Instant.parse("2026-11-05T00:00:00Z"));
        return new DashboardBriefService(context, chat, JsonMapper.builder().build(), clock);
    }
    TaskContext.DashboardSnapshot snapshot(String status) {
        return new TaskContext.DashboardSnapshot(Map.of("status",status),
            List.of(new TaskContext.Source("TSK-1","/tasks/1","2026-11-05",3.0,null)), Map.of("myOpenTasks",1L));
    }
    @Test void cacheRechecksPermissionsAndAvoidsRepeatedQuota() {
        var service = service(); when(context.dashboard("token","u")).thenReturn(snapshot("TODO"));
        when(chat.chat(eq("u"),anyString())).thenReturn(new AiProvider.Answer("Plan","model",1,1));
        assertThat(service.brief("token","u").text()).isEqualTo("Plan");
        service.brief("token","u");
        verify(context,times(2)).dashboard("token","u"); verify(chat,times(1)).chat(eq("u"),anyString());
        when(context.dashboard("token","u")).thenThrow(new AiException(HttpStatus.FORBIDDEN,"DENIED","Denied"));
        assertThatThrownBy(() -> service.brief("token","u")).isInstanceOf(AiException.class);
    }
    @Test void changedDataAndDifferentUserNeverReuseOldSummary() {
        var service = service(); when(context.dashboard("token","u")).thenReturn(snapshot("TODO"), snapshot("IN_REVIEW"));
        when(context.dashboard("other","v")).thenReturn(snapshot("TODO"));
        when(chat.chat(anyString(),anyString())).thenReturn(new AiProvider.Answer("Plan","model",1,1));
        service.brief("token","u"); service.brief("token","u"); service.brief("other","v");
        verify(chat,times(2)).chat(eq("u"),anyString()); verify(chat).chat(eq("v"),anyString());
    }
    @Test void emptyWorkspaceDoesNotSpendGroqQuota() {
        var service = service(); when(context.dashboard("token","u")).thenReturn(new TaskContext.DashboardSnapshot(Map.of(),List.of(),Map.of()));
        assertThat(service.brief("token","u").model()).isEqualTo("system"); verifyNoInteractions(chat);
    }
    @Test void cacheExpiresAndFailedProviderIsNotCached() {
        var service = service(); when(context.dashboard("token","u")).thenReturn(snapshot("TODO"));
        when(chat.chat(eq("u"),anyString())).thenThrow(new AiException(HttpStatus.SERVICE_UNAVAILABLE,"DOWN","Unavailable"))
            .thenReturn(new AiProvider.Answer("Plan","model",1,1));
        assertThatThrownBy(() -> service.brief("token","u")).isInstanceOf(AiException.class);
        service.brief("token","u");
        when(clock.instant()).thenReturn(Instant.parse("2026-11-05T00:06:00Z"));
        service.brief("token","u"); verify(chat,times(3)).chat(eq("u"),anyString());
    }
}

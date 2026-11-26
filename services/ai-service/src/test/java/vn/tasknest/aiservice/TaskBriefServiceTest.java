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

class TaskBriefServiceTest {
    final TaskContext context = mock(TaskContext.class);
    final AiChatService chat = mock(AiChatService.class);
    final TaskBriefService service = new TaskBriefService(context, chat, JsonMapper.builder().build(),
        Clock.fixed(Instant.parse("2026-11-05T00:00:00Z"),ZoneOffset.UTC));
    TaskContext.Snapshot snapshot(String role) {
        return new TaskContext.Snapshot(Map.of("viewerProjectRole",role),
            new TaskContext.Source("TSK-1","/tasks/1","2026-11-05",3.0,null));
    }
    @Test void cachedResultStillRequiresCurrentPermission() {
        when(context.readForViewer("t",1,"u")).thenReturn(snapshot("Member"));
        when(chat.chat(anyString(),anyString())).thenReturn(new AiProvider.Answer("{\"nextStep\":\"Kiểm tra deadline\"}","model",1,1));
        assertThat(service.brief("t","u",1).insights().nextStep()).isEqualTo("Kiểm tra deadline");
        service.brief("t","u",1);
        verify(chat,times(1)).chat(anyString(),anyString());
        verify(context,times(2)).readForViewer("t",1,"u");
        when(context.readForViewer("t",1,"u")).thenThrow(new AiException(HttpStatus.FORBIDDEN,"DENIED","Denied"));
        assertThatThrownBy(() -> service.brief("t","u",1)).isInstanceOf(AiException.class);
    }
    @Test void roleChangesInvalidateCacheAndMalformedOutputIsHidden() {
        when(context.readForViewer("t",1,"u")).thenReturn(snapshot("Manager"),snapshot("Member"));
        when(chat.chat(anyString(),anyString())).thenReturn(new AiProvider.Answer("invalid JSON","model",1,1));
        assertThat(service.brief("t","u",1).insights().overview()).isEmpty();
        service.brief("t","u",1);
        verify(chat,times(2)).chat(anyString(),anyString());
    }
}

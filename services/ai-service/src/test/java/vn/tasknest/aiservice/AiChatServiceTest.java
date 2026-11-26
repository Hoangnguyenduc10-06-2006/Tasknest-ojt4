package vn.tasknest.aiservice;

import org.junit.jupiter.api.Test;
import vn.tasknest.aiservice.application.*;
import vn.tasknest.aiservice.config.AiProperties;
import vn.tasknest.aiservice.infrastructure.persistence.AiQuota;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;

class AiChatServiceTest {
    @Test void disabledServiceNeverSpendsQuotaOrCallsGroq() {
        var quota = mock(AiQuota.class); var provider = mock(AiProvider.class);
        var p = new AiProperties(false, "", "groq", "openai/gpt-oss-120b", 20, 100, 2, 8000, 200000, 1500);
        assertThatThrownBy(() -> new AiChatService(p, quota, provider).chat("u", "hello")).isInstanceOf(AiException.class);
        verifyNoInteractions(quota, provider);
    }
    @Test void missingKeyNeverSpendsQuotaOrCallsGroq() {
        var quota = mock(AiQuota.class); var provider = mock(AiProvider.class);
        var p = new AiProperties(true, " ", "groq", "openai/gpt-oss-120b", 20, 100, 2, 8000, 200000, 1500);
        assertThatThrownBy(() -> new AiChatService(p, quota, provider).chat("u", "hello")).isInstanceOf(AiException.class);
        verifyNoInteractions(quota, provider);
    }
    @Test void exhaustedBudgetNeverCallsGroq() {
        var quota = mock(AiQuota.class); var provider = mock(AiProvider.class);
        doThrow(new AiException(org.springframework.http.HttpStatus.TOO_MANY_REQUESTS, "QUOTA", "Hết hạn mức")).when(quota).reserve(eq("u"), anyInt());
        assertThatThrownBy(() -> new AiChatService(GroqProviderTest.properties(), quota, provider).chat("u", "hello")).isInstanceOf(AiException.class);
        verifyNoInteractions(provider);
    }
}

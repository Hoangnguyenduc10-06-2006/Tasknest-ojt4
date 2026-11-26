package vn.tasknest.aiservice;

import vn.tasknest.aiservice.config.AiProperties;
import vn.tasknest.aiservice.application.AiException;
import vn.tasknest.aiservice.infrastructure.groq.GroqProvider;

import java.time.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.http.*;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class GroqProviderTest {
    MockRestServiceServer server;
    GroqProvider provider;
    static AiProperties properties() { return new AiProperties(true, "test-secret", "groq", "openai/gpt-oss-120b", 20, 100, 2, 8000, 200000, 1500); }
    @BeforeEach void setup() {
        var builder = RestClient.builder().baseUrl("https://api.groq.com/openai/v1");
        server = MockRestServiceServer.bindTo(builder).build();
        provider = new GroqProvider(builder.build(), properties(), Clock.fixed(Instant.parse("2026-11-04T12:00:00Z"), ZoneOffset.UTC));
    }
    @Test void sendsOnlyServerControlledModelAndMessages() {
        server.expect(requestTo("https://api.groq.com/openai/v1/chat/completions"))
            .andExpect(method(HttpMethod.POST)).andExpect(header("Authorization", "Bearer test-secret"))
            .andExpect(jsonPath("$.model").value("openai/gpt-oss-120b"))
            .andExpect(jsonPath("$.messages[0].role").value("system"))
            .andExpect(jsonPath("$.messages[1].content").value("Lập kế hoạch"))
            .andExpect(jsonPath("$.max_completion_tokens").value(1500))
            .andRespond(withSuccess("{\"choices\":[{\"message\":{\"content\":\"Chia thành ba bước.\"}}],\"usage\":{\"prompt_tokens\":20,\"completion_tokens\":10}}", MediaType.APPLICATION_JSON));
        var answer = provider.complete("Lập kế hoạch");
        assertThat(answer.text()).isEqualTo("Chia thành ba bước.");
        assertThat(answer.inputTokens()).isEqualTo(20);
        server.verify();
    }
    @Test void respectsProviderRetryAfterWithoutAutomaticRetry() {
        server.expect(anything()).andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS).header("Retry-After", "120").body("test-secret"));
        assertThatThrownBy(() -> provider.complete("a")).isInstanceOfSatisfying(AiException.class, e -> {
            assertThat(e.retryAfter()).isEqualTo(120); assertThat(e.getMessage()).doesNotContain("test-secret");
        });
        assertThatThrownBy(() -> provider.complete("b")).isInstanceOf(AiException.class);
        server.verify();
    }
    @Test void usesStandardOpenAiPayloadForOpenRouter() {
        var openRouter = new AiProperties(true, "test-secret", "openrouter", "openrouter/free", 20, 45, 2, 8000, 200000, 1500);
        var builder = RestClient.builder().baseUrl("https://openrouter.ai/api/v1");
        var openRouterServer = MockRestServiceServer.bindTo(builder).build();
        var openRouterProvider = new GroqProvider(builder.build(), openRouter, Clock.systemUTC());
        openRouterServer.expect(requestTo("https://openrouter.ai/api/v1/chat/completions"))
            .andExpect(header("Authorization", "Bearer test-secret"))
            .andExpect(header("X-Title", "TaskNest"))
            .andExpect(jsonPath("$.model").value("openrouter/free"))
            .andExpect(jsonPath("$.max_tokens").value(1500))
            .andExpect(jsonPath("$.max_completion_tokens").doesNotExist())
            .andRespond(withSuccess("{\"choices\":[{\"message\":{\"content\":\"Ưu tiên việc quá hạn.\"}}]}", MediaType.APPLICATION_JSON));
        assertThat(openRouterProvider.complete("Việc nào trước?").text()).isEqualTo("Ưu tiên việc quá hạn.");
        openRouterServer.verify();
    }
    @Test void usesConfiguredFallbackAfterPrimaryProviderRateLimit() {
        var primaryBuilder = RestClient.builder().baseUrl("https://api.groq.com/openai/v1");
        var fallbackBuilder = RestClient.builder().baseUrl("https://openrouter.ai/api/v1");
        var primaryServer = MockRestServiceServer.bindTo(primaryBuilder).build();
        var fallbackServer = MockRestServiceServer.bindTo(fallbackBuilder).build();
        var fallbackProperties = new AiProperties(true, "groq-key", "groq", "openai/gpt-oss-120b",
            "router-key", "openrouter", "openrouter/free", 60, 300, 2, 8000, 200000, 1500);
        provider = new GroqProvider(primaryBuilder.build(), fallbackBuilder.build(), fallbackProperties, Clock.systemUTC());
        primaryServer.expect(anything()).andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS).header("Retry-After", "60"));
        fallbackServer.expect(requestTo("https://openrouter.ai/api/v1/chat/completions"))
            .andExpect(header("Authorization", "Bearer router-key"))
            .andRespond(withSuccess("{\"choices\":[{\"message\":{\"content\":\"Đã dùng dự phòng.\"}}]}", MediaType.APPLICATION_JSON));
        assertThat(provider.complete("x").text()).isEqualTo("Đã dùng dự phòng.");
        primaryServer.verify();
        fallbackServer.verify();
    }
    @Test void hidesProviderAuthenticationErrors() {
        server.expect(anything()).andRespond(withStatus(HttpStatus.UNAUTHORIZED).body("test-secret private prompt"));
        assertThatThrownBy(() -> provider.complete("a")).isInstanceOfSatisfying(AiException.class, e -> {
            assertThat(e.status()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE); assertThat(e.getMessage()).doesNotContain("test-secret", "private prompt");
        });
    }
    @Test void rejectsEmptyProviderOutput() {
        server.expect(anything()).andRespond(withSuccess("{\"choices\":[]}", MediaType.APPLICATION_JSON));
        assertThatThrownBy(() -> provider.complete("a")).isInstanceOf(AiException.class);
    }
    @Test void hidesApiKeyFromConfigurationToString() { assertThat(properties().toString()).doesNotContain("test-secret"); }
}

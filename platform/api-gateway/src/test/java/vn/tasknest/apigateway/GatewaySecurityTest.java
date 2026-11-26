package vn.tasknest.apigateway;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webtestclient.autoconfigure.AutoConfigureWebTestClient;
import org.springframework.test.web.reactive.server.WebTestClient;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.config.import=", "spring.cloud.config.enabled=false", "eureka.client.enabled=false",
        "management.server.port=0",
        "spring.security.user.password=test-only-unused-password"
})
@AutoConfigureWebTestClient
class GatewaySecurityTest {
    @Autowired
    WebTestClient client;

    @Test
    void propagatesSafeCorrelationId() {
        client.get().uri("/api/status").header("X-Correlation-ID", "test-request-42").exchange()
                .expectStatus().isOk().expectHeader().valueEquals("X-Correlation-ID", "test-request-42")
                .expectBody().jsonPath("$.service").isEqualTo("api-gateway");
    }

    @Test
    void replacesUnsafeCorrelationId() {
        client.get().uri("/api/status").header("X-Correlation-ID", "unsafe value").exchange()
                .expectStatus().isOk().expectHeader().valueMatches("X-Correlation-ID", "[a-f0-9-]{36}");
    }

    @Test
    void doesNotAllowForgedIdentityOrUnimplementedBusinessApi() {
        client.get().uri("/api/work/projects").header("X-User-Id", "owner").header("X-Role", "Owner")
                .exchange().expectStatus().isUnauthorized();
    }

    @Test
    void protectsAiRouteAndIgnoresForgedUserHeaders() {
        client.post().uri("/api/ai/chat").header("X-User-Id", "owner").header("X-Role", "Owner")
                .bodyValue(java.util.Map.of("message", "hello")).exchange().expectStatus().isUnauthorized();
    }

    @Test
    void blocksWebsocketUntilAuthenticationExists() {
        client.get().uri("/ws").exchange().expectStatus().isUnauthorized();
    }

    @Test
    void doesNotExposeMetricsAtGateway() {
        client.get().uri("/actuator/metrics").exchange().expectStatus().isUnauthorized();
    }
}

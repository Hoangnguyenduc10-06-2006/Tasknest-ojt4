package vn.tasknest.apigateway.config;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.time.Duration;
import org.springframework.cloud.client.loadbalancer.LoadBalanced;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.authorization.AuthorizationDecision;
import org.springframework.security.authorization.AuthorizationResult;
import org.springframework.security.authorization.ReactiveAuthorizationManager;
import org.springframework.security.web.server.authorization.AuthorizationContext;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Mono;

/** Validate the current Identity session before routing a project write. Work rechecks at its boundary. */
@Configuration
public class WorkProjectAuthorization {
    @Bean @org.springframework.context.annotation.Primary
    WebClient.Builder directWebClientBuilder() { return WebClient.builder(); }
    @Bean @LoadBalanced
    WebClient.Builder projectIdentityWebClientBuilder() { return WebClient.builder(); }

    @Bean
    ReactiveAuthorizationManager<AuthorizationContext> projectSessionAuthorization(
            @org.springframework.beans.factory.annotation.Qualifier("projectIdentityWebClientBuilder") WebClient.Builder builder) {
        WebClient client = builder.baseUrl("http://identity-service").build();
        return (authentication, context) -> {
            var headers = context.getExchange().getRequest().getHeaders().get("Authorization");
            if (headers == null || headers.size() != 1 || !headers.getFirst().matches("(?i)Bearer [A-Za-z0-9._~-]+"))
                return Mono.just(new AuthorizationDecision(false));
            return client.get().uri("/api/identity/auth/session")
                .header("Authorization", headers.getFirst())
                .exchangeToMono(response -> {
                    if (response.statusCode().value() == 401)
                        return response.releaseBody().thenReturn((AuthorizationResult) new AuthorizationDecision(false));
                    if (response.statusCode().value() != 200)
                        return response.releaseBody().then(Mono.error(unavailable()));
                    return response.bodyToMono(SessionResult.class)
                        .filter(result -> Boolean.TRUE.equals(result.success()) && result.data() != null && result.data().id() != null)
                        .map(result -> (AuthorizationResult) new AuthorizationDecision(true))
                        .switchIfEmpty(Mono.error(unavailable()));
                }).timeout(Duration.ofSeconds(3))
                .onErrorMap(error -> !(error instanceof ResponseStatusException), error -> unavailable());
        };
    }
    private static ResponseStatusException unavailable() {
        return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Không thể kiểm tra phiên đăng nhập.");
    }
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record SessionResult(Boolean success, SessionUser data) {}
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record SessionUser(String id) {}
}

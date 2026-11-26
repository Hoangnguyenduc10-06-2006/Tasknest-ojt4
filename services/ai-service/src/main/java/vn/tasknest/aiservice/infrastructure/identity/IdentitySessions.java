package vn.tasknest.aiservice.infrastructure.identity;

import vn.tasknest.aiservice.application.AiException;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.*;

@Component
public class IdentitySessions {
    private final RestClient client;
    public IdentitySessions(@Qualifier("aiIdentityClient") RestClient client) { this.client = client; }
    public String verify(String token) {
        try {
            var result = client.get().uri("/api/identity/auth/session").headers(h -> h.setBearerAuth(token))
                .retrieve().body(Session.class);
            if (result == null || !Boolean.TRUE.equals(result.success()) || result.data() == null || result.data().id() == null)
                throw unavailable();
            if (!result.data().emailVerified()) throw new AiException(HttpStatus.FORBIDDEN, "EMAIL_NOT_VERIFIED", "Vui lòng xác minh email.");
            try { return java.util.UUID.fromString(result.data().id()).toString(); }
            catch (IllegalArgumentException ex) { throw unavailable(); }
        } catch (HttpClientErrorException.Unauthorized ex) {
            throw new AiException(HttpStatus.UNAUTHORIZED, "INVALID_SESSION", "Phiên đăng nhập đã hết hạn hoặc bị thu hồi.");
        } catch (RestClientException ex) { throw unavailable(); }
    }
    private static AiException unavailable() { return new AiException(HttpStatus.SERVICE_UNAVAILABLE, "IDENTITY_UNAVAILABLE", "Không thể kiểm tra phiên đăng nhập."); }
    @JsonIgnoreProperties(ignoreUnknown = true) public record Session(Boolean success, User data) {}
    @JsonIgnoreProperties(ignoreUnknown = true) public record User(String id, boolean emailVerified) {}
}

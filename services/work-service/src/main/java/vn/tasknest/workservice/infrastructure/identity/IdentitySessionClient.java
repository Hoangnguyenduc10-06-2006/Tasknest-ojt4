package vn.tasknest.workservice.infrastructure.identity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.*;
import vn.tasknest.workservice.application.WorkException;
import vn.tasknest.workservice.application.security.*;

/** Identity validates signature, issuer, audience, expiry and current session on every call. No auth cache. */
@Component
public class IdentitySessionClient implements IdentitySessionVerifier {
    private final RestClient client;
    public IdentitySessionClient(@Qualifier("identitySessionRestClient") RestClient client) { this.client = client; }
    @Override public WorkActor verify(String token) {
        try {
            SessionEnvelope result = client.get().uri("/api/identity/auth/session")
                .headers(h -> h.setBearerAuth(token)).retrieve().body(SessionEnvelope.class);
            if (result == null || !Boolean.TRUE.equals(result.success()) || result.data() == null)
                throw unavailable();
            try { return new WorkActor(result.data().id(), result.data().emailVerified()); }
            catch (IllegalArgumentException ex) { throw unavailable(); }
        } catch (HttpClientErrorException.Unauthorized ex) {
            throw new WorkException(HttpStatus.UNAUTHORIZED, "INVALID_SESSION", "Phiên không hợp lệ hoặc đã hết hạn.");
        } catch (RestClientException ex) { throw unavailable(); }
    }
    private WorkException unavailable() { return new WorkException(HttpStatus.SERVICE_UNAVAILABLE, "IDENTITY_UNAVAILABLE", "Không thể kiểm tra phiên. Vui lòng thử lại."); }
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record SessionEnvelope(Boolean success, SessionUser data) {}
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record SessionUser(String id, boolean emailVerified) {}
}

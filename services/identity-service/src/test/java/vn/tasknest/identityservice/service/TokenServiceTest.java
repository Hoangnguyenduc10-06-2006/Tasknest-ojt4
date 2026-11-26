package vn.tasknest.identityservice.service;

import static org.junit.jupiter.api.Assertions.*;

import com.nimbusds.jose.jwk.RSAKey;
import java.security.KeyPair;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import vn.tasknest.identityservice.config.RsaKeyConfiguration;
import vn.tasknest.identityservice.domain.AuthSession;
import vn.tasknest.identityservice.domain.User;

class TokenServiceTest {

    private TokenService tokenService;
    private JwtDecoder jwtDecoder;
    private final Instant now = Instant.parse("2026-10-27T12:00:00Z");
    private final Clock clock = Clock.fixed(now, ZoneId.of("UTC"));

    private boolean sessionIsActive = true;

    @BeforeEach
    void setUp() throws Exception {
        RsaKeyConfiguration rsaConfig = new RsaKeyConfiguration();
        KeyPair keyPair = rsaConfig.rsaKeyPair(vn.tasknest.identityservice.support.TestKeys.properties());
        RSAKey rsaKey = rsaConfig.rsaKey(keyPair);
        JwtEncoder jwtEncoder = rsaConfig.jwtEncoder(rsaConfig.jwkSource(rsaKey));

        // Mock authSessionService::isSessionActive qua lambda
        AuthSessionService mockSessionService = org.mockito.Mockito.mock(AuthSessionService.class);
        org.mockito.Mockito.when(mockSessionService.isSessionActive(anyString()))
            .thenAnswer(inv -> sessionIsActive);

        jwtDecoder = rsaConfig.jwtDecoder(rsaKey, mockSessionService, clock);
        tokenService = new TokenService(jwtEncoder, clock, rsaKey);
    }

    private static String anyString() {
        return org.mockito.ArgumentMatchers.anyString();
    }

    @Test
    void generateAccessToken_createsValidRs256JwtWithSessionClaim() {
        User user = new User("Nguyen Van A", "user@example.com", "hash");
        user.setId("00000000-0000-4000-8000-000000000010");
        user.setEmailVerified(true);

        AuthSession session = new AuthSession();
        session.setId("session-123");
        session.setCreatedAt(now);
        session.setExpiresAt(now.plus(7, ChronoUnit.DAYS));

        TokenService.AccessToken token = tokenService.generateAccessToken(user, session);

        assertNotNull(token.getValue());
        assertEquals(900L, token.getExpiresInSeconds());

        Jwt decoded = jwtDecoder.decode(token.getValue());
        assertEquals("RS256", decoded.getHeaders().get("alg"));
        assertTrue(decoded.getHeaders().get("kid").toString().startsWith("rsa-"));
        assertEquals("https://identity.tasknest.vn", decoded.getIssuer().toString());
        assertEquals("session-123", decoded.getClaimAsString("sid"));
        assertEquals("user@example.com", decoded.getClaimAsString("email"));
        assertEquals("00000000-0000-4000-8000-000000000010", decoded.getSubject());
        assertTrue(decoded.getAudience().contains("tasknest-api"));
    }

    @Test
    void generateAccessToken_capsExpiryAtSessionExpiry_AUTH02() {
        // [P1] issue #8: Hạn Access Token bị chặn bởi thời điểm hết phiên 7 ngày tuyệt đối
        User user = new User("Nguyen Van A", "user@example.com", "hash");
        user.setId("00000000-0000-4000-8000-000000000010");

        AuthSession session = new AuthSession();
        session.setId("session-near-end");
        session.setCreatedAt(now.minus(6, ChronoUnit.DAYS).minus(23, ChronoUnit.HOURS));
        // Phiên chỉ còn 60 giây nữa là đạt mốc 7 ngày tuyệt đối
        session.setExpiresAt(now.plusSeconds(60));

        TokenService.AccessToken token = tokenService.generateAccessToken(user, session);

        assertEquals(60L, token.getExpiresInSeconds());
        assertEquals(now.plusSeconds(60), token.getExpiresAt());

        Jwt decoded = jwtDecoder.decode(token.getValue());
        assertEquals(now.plusSeconds(60), decoded.getExpiresAt());
    }

    @Test
    void jwtDecoder_rejectsTokenWhenSessionIsRevoked_AUTH07() {
        // [P1] issue #9: Access Token của phiên đã bị thu hồi sẽ bị từ chối
        User user = new User("Nguyen Van A", "user@example.com", "hash");
        user.setId("00000000-0000-4000-8000-000000000010");

        AuthSession session = new AuthSession();
        session.setId("session-revoked");
        session.setCreatedAt(now);
        session.setExpiresAt(now.plus(7, ChronoUnit.DAYS));

        TokenService.AccessToken token = tokenService.generateAccessToken(user, session);

        // Phiên bị thu hồi
        sessionIsActive = false;

        assertThrows(BadJwtException.class, () -> jwtDecoder.decode(token.getValue()));
    }
}

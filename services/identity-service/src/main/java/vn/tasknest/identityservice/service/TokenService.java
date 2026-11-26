package vn.tasknest.identityservice.service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Getter;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;
import com.nimbusds.jose.jwk.RSAKey;
import vn.tasknest.identityservice.domain.AuthSession;
import vn.tasknest.identityservice.domain.User;

/** Cấp Access Token RS256. Refresh Token do {@link AuthSessionService} quản lý theo phiên. */
@Service
public class TokenService {

    public static final long ACCESS_TOKEN_EXPIRY_SECONDS = 900L; // 15 phút
    public static final Duration SESSION_MAX_LIFETIME = Duration.ofDays(7); // AUTH-02
    public static final String ISSUER = "https://identity.tasknest.vn";
    public static final String AUDIENCE = "tasknest-api";
    public static final String CLAIM_SESSION_ID = "sid";

    private final JwtEncoder jwtEncoder;
    private final Clock clock;
    private final String keyId;

    public TokenService(JwtEncoder jwtEncoder, Clock clock, RSAKey rsaKey) {
        this.jwtEncoder = jwtEncoder;
        this.clock = clock;
        this.keyId = rsaKey.getKeyID();
    }

    @Getter
    @AllArgsConstructor
    public static class AccessToken {
        private final String value;
        private final Instant expiresAt;
        private final long expiresInSeconds;
    }

    /**
     * Hạn Access Token = min(now + 15 phút, hạn tuyệt đối của phiên); gắn {@code sid} để nơi nhận kiểm tra
     * trạng thái phiên (AUTH-07).
     */
    public AccessToken generateAccessToken(User user, AuthSession session) {
        Instant now = Instant.now(clock).truncatedTo(ChronoUnit.SECONDS);
        Instant expiresAt = now.plusSeconds(ACCESS_TOKEN_EXPIRY_SECONDS);
        if (session.getExpiresAt().isBefore(expiresAt)) {
            expiresAt = session.getExpiresAt().truncatedTo(ChronoUnit.SECONDS);
        }
        if (!expiresAt.isAfter(now)) {
            throw new IllegalStateException("Phiên đã hết hạn tuyệt đối, không thể cấp Access Token");
        }

        JwsHeader header = JwsHeader.with(SignatureAlgorithm.RS256)
            .keyId(keyId)
            .build();

        JwtClaimsSet claims = JwtClaimsSet.builder()
            .issuer(ISSUER)
            .audience(List.of(AUDIENCE))
            .issuedAt(now)
            .expiresAt(expiresAt)
            .subject(String.valueOf(user.getId()))
            .claim(CLAIM_SESSION_ID, session.getId())
            .claim("email", user.getEmail())
            .claim("fullName", user.getFullName())
            .claim("email_verified", user.isEmailVerified())
            .build();

        String value = jwtEncoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
        return new AccessToken(value, expiresAt, Duration.between(now, expiresAt).getSeconds());
    }
}

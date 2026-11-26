package vn.tasknest.identityservice.service;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import vn.tasknest.identityservice.config.IdentityProperties;
import vn.tasknest.identityservice.security.TokenHasher;

/** Atomic, durable fixed-window request budgets. Return retry delay so increments commit before rejection. */
@Service
public class AuthRateLimitService {
    private final JdbcTemplate jdbc;
    private final Clock clock;
    private final IdentityProperties.RateLimit limits;

    public AuthRateLimitService(JdbcTemplate jdbc, Clock clock, IdentityProperties properties) {
        this.jdbc = jdbc;
        this.clock = clock;
        this.limits = properties.getRateLimit();
        if (limits.getLoginAccountAttempts() < 1 || limits.getLoginAddressAttempts() < 1
            || limits.getRefreshSessionAttempts() < 1 || limits.getRefreshAddressAttempts() < 1
            || limits.getMailAddressAttempts() < 1 || limits.getMailGlobalAttempts() < 1 || limits.getMailWindowSeconds() < 1
            || limits.getLoginWindowSeconds() < 1 || limits.getRefreshWindowSeconds() < 1) {
            throw new IllegalStateException("Auth rate limits and windows must be positive");
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public long consumeLogin(String email, String address) {
        long account = consume("LOGIN", "ACCOUNT", email, limits.getLoginWindowSeconds(), limits.getLoginAccountAttempts());
        long ip = consume("LOGIN", "IP", address, limits.getLoginWindowSeconds(), limits.getLoginAddressAttempts());
        return Math.max(account, ip);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public long consumeRefresh(String sessionId, String address) {
        long ip = consume("REFRESH", "IP", address, limits.getRefreshWindowSeconds(), limits.getRefreshAddressAttempts());
        long session = sessionId == null ? 0 : consume("REFRESH", "SESSION", sessionId, limits.getRefreshWindowSeconds(), limits.getRefreshSessionAttempts());
        return Math.max(ip, session);
    }

    /** Conservatively count all attempts, including rejected/invalid accounts, before expensive work. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public long consumeMailRequest(String action, String address) {
        long ip = consume(action, "IP", address, limits.getMailWindowSeconds(), limits.getMailAddressAttempts());
        // A throttled IP cannot continue consuming the shared mail budget.
        if (ip > 0) return ip;
        return consume("MAIL", "GLOBAL", "verification", limits.getMailWindowSeconds(), limits.getMailGlobalAttempts());
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public long consumeOnboarding(String userId) { return consume("ONBOARDING", "ACCOUNT", userId, 60, 20); }

    public long consumeProfile(String userId) {
        return consume("PROFILE", "ACCOUNT", userId, 60, 10);
    }

    private long consume(String action, String scope, String subject, int windowSeconds, int maximum) {
        Instant now = clock.instant();
        long startSeconds = Math.floorDiv(now.getEpochSecond(), windowSeconds) * windowSeconds;
        LocalDateTime start = LocalDateTime.ofEpochSecond(startSeconds, 0, ZoneOffset.UTC);
        LocalDateTime end = start.plusSeconds(windowSeconds);
        byte[] hash = TokenHasher.sha256(subject == null ? "unknown" : subject);
        jdbc.update("""
            INSERT INTO auth_rate_limit_buckets(action,scope,subject_hash,window_start,window_end,request_count)
            VALUES (?,?,?,?,?,1)
            ON DUPLICATE KEY UPDATE request_count=LEAST(request_count+1,2147483647)
            """, action, scope, hash, start, end);
        Integer count = jdbc.queryForObject("""
            SELECT request_count FROM auth_rate_limit_buckets
            WHERE action=? AND scope=? AND subject_hash=? AND window_start=?
            """, Integer.class, action, scope, hash, start);
        return count != null && count > maximum ? Math.max(1, startSeconds + windowSeconds - now.getEpochSecond()) : 0;
    }
}

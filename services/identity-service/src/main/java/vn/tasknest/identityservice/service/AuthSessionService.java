package vn.tasknest.identityservice.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Getter;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.tasknest.identityservice.domain.AuthSession;
import vn.tasknest.identityservice.domain.RefreshToken;
import vn.tasknest.identityservice.domain.User;
import vn.tasknest.identityservice.repository.AuthSessionRepository;
import vn.tasknest.identityservice.repository.RefreshTokenRepository;
import vn.tasknest.identityservice.repository.UserRepository;
import vn.tasknest.identityservice.security.TokenHasher;

/**
 * Quản lý phiên đăng nhập và xoay Refresh Token. Mỗi phương thức công khai là MỘT transaction riêng và
 * trả kết quả thay vì ném ngoại lệ, để caller (không nằm trong transaction này) ném lỗi SAU khi trạng thái
 * thu hồi đã được commit — nếu ném RuntimeException ngay trong transaction thì việc thu hồi bị rollback.
 *
 * <p>Tuần tự hóa: luôn khóa hàng phiên ({@code SELECT ... FOR UPDATE}) trước, rồi mới khóa hàng token.
 * Hai yêu cầu đồng thời với cùng một token sẽ xếp hàng; yêu cầu thứ hai thấy token đã bị dùng và bị coi là
 * tái sử dụng (replay) nên cả phiên bị thu hồi (AUTH-05).
 */
@Service
public class AuthSessionService {

    public static final String REASON_LOGOUT = "LOGOUT";
    public static final String REASON_REUSE = "REFRESH_TOKEN_REUSE";
    public static final String REASON_EXPIRED = "SESSION_EXPIRED";
    private static final int MAX_USER_AGENT_LENGTH = 512;

    public enum RotationStatus { ROTATED, INVALID, EXPIRED, REPLAY_DETECTED }

    @Getter
    @AllArgsConstructor
    public static class SessionTokens {
        private final AuthSession session;
        private final User user;
        /** Refresh Token gốc: chỉ tồn tại trong bộ nhớ để đặt cookie, không lưu DB/log. */
        private final String rawRefreshToken;
    }

    @Getter
    @AllArgsConstructor
    public static class RotationResult {
        private final RotationStatus status;
        private final SessionTokens tokens;

        public boolean isRotated() {
            return status == RotationStatus.ROTATED;
        }
    }

    @PersistenceContext
    private EntityManager entityManager;

    private final AuthSessionRepository sessionRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final UserRepository userRepository;
    private final Clock clock;

    public AuthSessionService(
        AuthSessionRepository sessionRepository,
        RefreshTokenRepository refreshTokenRepository,
        UserRepository userRepository,
        Clock clock
    ) {
        this.sessionRepository = sessionRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.userRepository = userRepository;
        this.clock = clock;
    }

    /** Tạo phiên mới khi đăng nhập: hạn tuyệt đối = now + 7 ngày, cố định cho mọi lần xoay (AUTH-02). */
    @Transactional
    public SessionTokens startSession(User user, String userAgent) {
        User current=userRepository.findByIdForUpdate(user.getId()).orElseThrow(() -> new vn.tasknest.identityservice.exception.InvalidCredentialsException("Phiên không hợp lệ."));
        if(!current.isEmailVerified() || !current.getPasswordHash().equals(user.getPasswordHash())) throw new vn.tasknest.identityservice.exception.InvalidCredentialsException("Tài khoản đã thay đổi. Vui lòng đăng nhập lại.");
        Instant now = now();
        AuthSession session = new AuthSession();
        session.setId(UUID.randomUUID().toString());
        session.setUserId(user.getId());
        session.setUserAgent(truncate(userAgent));
        session.setCreatedAt(now);
        session.setExpiresAt(now.plus(TokenService.SESSION_MAX_LIFETIME));
        session.setLastSeenAt(now);
        entityManager.persist(session);
        entityManager.flush();

        IssuedToken issued = issueToken(session.getId(), now);
        return new SessionTokens(session, user, issued.raw);
    }

    @Transactional
    public RotationResult rotate(String rawRefreshToken) {
        byte[] hash = TokenHasher.sha256(rawRefreshToken);

        // 1. Đọc session_id bằng truy vấn vô hướng (không nạp entity token) rồi khóa phiên.
        String sessionId = refreshTokenRepository.findSessionIdByTokenHash(hash).orElse(null);
        if (sessionId == null) {
            return result(RotationStatus.INVALID);
        }
        AuthSession session = sessionRepository.findByIdForUpdate(sessionId).orElse(null);
        // 2. Locking read của token thấy dữ liệu mới nhất đã commit, kể cả dưới REPEATABLE READ.
        RefreshToken token = refreshTokenRepository.findByTokenHashForUpdate(hash).orElse(null);
        if (session == null || token == null || session.getRevokedAt() != null) {
            return result(RotationStatus.INVALID);
        }

        // A competing rotation may have issued a token while this request waited for the session lock.
        Instant now = now();
        if (!session.isActiveAt(now)) {
            session.revoke(now, REASON_EXPIRED);
            refreshTokenRepository.revokeLiveTokensOfSession(sessionId, now);
            return result(RotationStatus.EXPIRED);
        }

        if (token.getConsumedAt() != null) {
            // Phát hiện dùng lại token đã xoay: thu hồi cả chuỗi phiên này (không đụng thiết bị khác).
            session.revoke(now, REASON_REUSE);
            refreshTokenRepository.revokeLiveTokensOfSession(sessionId, now);
            return result(RotationStatus.REPLAY_DETECTED);
        }
        if (token.getRevokedAt() != null) {
            return result(RotationStatus.INVALID);
        }

        User user = userRepository.findById(session.getUserId()).orElse(null);
        if (user == null || !user.isEmailVerified()) {
            return result(RotationStatus.INVALID);
        }

        // Token cũ phải được đánh dấu đã dùng TRƯỚC khi chèn token mới (uq_refresh_current: 1 token sống/phiên).
        token.setConsumedAt(now);
        entityManager.flush();
        IssuedToken next = issueToken(sessionId, now);
        token.setReplacedById(next.id);
        session.setLastSeenAt(now);
        entityManager.flush();

        return new RotationResult(RotationStatus.ROTATED, new SessionTokens(session, user, next.raw));
    }

    /** Đăng xuất: thu hồi phiên chứa Refresh Token này phía máy chủ (AUTH-07). Không có hiệu ứng nếu token lạ. */
    @Transactional
    public boolean revokeSessionByRefreshToken(String rawRefreshToken) {
        byte[] hash = TokenHasher.sha256(rawRefreshToken);
        String sessionId = refreshTokenRepository.findSessionIdByTokenHash(hash).orElse(null);
        if (sessionId == null) {
            return false;
        }
        AuthSession session = sessionRepository.findByIdForUpdate(sessionId).orElse(null);
        if (session == null) {
            return false;
        }
        Instant now = now();
        session.revoke(now, REASON_LOGOUT);
        refreshTokenRepository.revokeLiveTokensOfSession(sessionId, now);
        return true;
    }

    @Transactional(readOnly = true)
    public String findSessionIdForRateLimit(String rawToken) {
        return refreshTokenRepository.findSessionIdByTokenHash(TokenHasher.sha256(rawToken)).orElse(null);
    }

    @Transactional(readOnly = true)
    public boolean isSessionActive(String sessionId) {
        return sessionRepository.findById(sessionId).map(s -> s.isActiveAt(now())).orElse(false);
    }

    private static final class IssuedToken {
        private final String id;
        private final String raw;

        private IssuedToken(String id, String raw) {
            this.id = id;
            this.raw = raw;
        }
    }

    private IssuedToken issueToken(String sessionId, Instant now) {
        String raw = TokenHasher.generateOpaqueToken();
        RefreshToken token = new RefreshToken();
        token.setId(UUID.randomUUID().toString());
        token.setSessionId(sessionId);
        token.setTokenHash(TokenHasher.sha256(raw));
        token.setCreatedAt(now);
        entityManager.persist(token);
        entityManager.flush();
        return new IssuedToken(token.getId(), raw);
    }

    private RotationResult result(RotationStatus status) {
        return new RotationResult(status, null);
    }

    private Instant now() {
        return Instant.now(clock).truncatedTo(ChronoUnit.MICROS);
    }

    private static String truncate(String value) {
        if (value == null) {
            return null;
        }
        return value.length() > MAX_USER_AGENT_LENGTH ? value.substring(0, MAX_USER_AGENT_LENGTH) : value;
    }
}

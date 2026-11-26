package vn.tasknest.identityservice.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.slf4j.MDC;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import vn.tasknest.identityservice.domain.OutboxEvent;
import vn.tasknest.identityservice.domain.User;
import vn.tasknest.identityservice.security.OutboxCipher;

/**
 * Ghi sự kiện outbox cùng transaction nghiệp vụ (VERIFY-05: gửi mail lỗi không rollback đăng ký).
 * Token gửi mail chỉ nằm trong {@code sensitive_payload} đã mã hóa AES-GCM; {@code payload} JSON không có
 * token/liên kết/thông tin xác thực và không bao giờ được ghi log (SEC-11).
 */
@Service
public class OutboxService {

    public static final String AGGREGATE_USER = "User";
    public static final String EVENT_EMAIL_VERIFICATION_REQUESTED = "identity.email-verification.requested";

    @PersistenceContext
    private EntityManager entityManager;

    private final OutboxCipher cipher;
    private final Clock clock;

    public OutboxService(OutboxCipher cipher, Clock clock) {
        this.cipher = cipher;
        this.clock = clock;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void enqueueEmailVerification(User user, String rawToken, Instant expiresAt) {
        enqueue(user, rawToken, expiresAt, "EMAIL_VERIFICATION", EVENT_EMAIL_VERIFICATION_REQUESTED);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void enqueuePasswordReset(User user, String rawToken, Instant expiresAt) {
        enqueue(user, rawToken, expiresAt, "PASSWORD_RESET", "identity.password-reset.requested");
    }

    private void enqueue(User user, String rawToken, Instant expiresAt, String purpose, String type) {
        Instant now = Instant.now(clock).truncatedTo(ChronoUnit.MICROS);

        // Email chỉ chứa ký tự an toàn do regex đăng ký bảo đảm; token là base64url nên không cần escape.
        String sensitive = "{\"email\":\"" + user.getEmail() + "\",\"token\":\"" + rawToken + "\"}";

        OutboxEvent event = new OutboxEvent();
        event.setEventId(UUID.randomUUID().toString());
        event.setAggregateType(AGGREGATE_USER);
        event.setAggregateId(String.valueOf(user.getId()));
        event.setAggregateVersion(user.getVersion() == null ? 0L : user.getVersion());
        event.setEventType(type);
        event.setSchemaVersion(2);
        event.setOccurredAt(now);
        event.setPayload("{\"userId\":\"" + user.getId() + "\",\"purpose\":\"" + purpose + "\",\"expiresAt\":\""
            + expiresAt + "\"}");
        event.setSensitivePayload(cipher.encrypt(sensitive.getBytes(StandardCharsets.UTF_8)));
        event.setEncryptionKeyId(cipher.keyId());
        event.setCorrelationId(correlationIdOrNull());
        event.setStatus(OutboxEvent.STATUS_PENDING);
        event.setAvailableAt(now);
        entityManager.persist(event);
    }

    private static String correlationIdOrNull() {
        String id = MDC.get("correlationId");
        try {
            return id == null ? null : UUID.fromString(id).toString();
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}

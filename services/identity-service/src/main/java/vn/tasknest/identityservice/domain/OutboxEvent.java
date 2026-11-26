package vn.tasknest.identityservice.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * Bảng {@code outbox_events}: sự kiện ghi cùng transaction nghiệp vụ. {@code payload} (JSON) tuyệt đối
 * không chứa thông tin xác thực; dữ liệu nhạy cảm (token gửi mail) chỉ nằm ở {@code sensitivePayload}
 * đã mã hóa AES-GCM.
 */
@Entity
@Table(name = "outbox_events")
@Getter
@Setter
@NoArgsConstructor
public class OutboxEvent {

    public static final String STATUS_PENDING = "PENDING";

    @Id
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "event_id", length = 36, nullable = false, updatable = false)
    private String eventId;

    @Column(name = "aggregate_type", length = 80, nullable = false)
    private String aggregateType;

    @Column(name = "aggregate_id", length = 64, nullable = false)
    private String aggregateId;

    @Column(name = "aggregate_version", nullable = false)
    private Long aggregateVersion;

    @Column(name = "event_type", length = 120, nullable = false)
    private String eventType;

    @Column(name = "schema_version", nullable = false)
    private Integer schemaVersion = 1;

    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "payload", nullable = false)
    private String payload;

    @JdbcTypeCode(SqlTypes.LONGVARBINARY)
    @Column(name = "sensitive_payload")
    private byte[] sensitivePayload;

    @Column(name = "encryption_key_id", length = 100)
    private String encryptionKeyId;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "correlation_id", length = 36)
    private String correlationId;

    @Column(name = "status", length = 16, nullable = false)
    private String status = STATUS_PENDING;

    @Column(name = "available_at", nullable = false)
    private Instant availableAt;

    @Column(name = "attempts", nullable = false)
    private Integer attempts = 0;

    @Column(name = "locked_by", length = 100)
    private String lockedBy;

    @Column(name = "locked_until")
    private Instant lockedUntil;

    @Column(name = "published_at")
    private Instant publishedAt;

    @Column(name = "last_error_safe", length = 500)
    private String lastErrorSafe;
}

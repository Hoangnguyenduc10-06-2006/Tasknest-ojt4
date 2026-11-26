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
 * Bảng {@code refresh_tokens}: chỉ lưu SHA-256 của token (AUTH-06). Token không có hạn riêng,
 * hạn lấy từ {@link AuthSession#getExpiresAt()}. Cột sinh {@code active_session_id} không ánh xạ.
 */
@Entity
@Table(name = "refresh_tokens")
@Getter
@Setter
@NoArgsConstructor
public class RefreshToken {

    @Id
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "id", length = 36, nullable = false, updatable = false)
    private String id;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "session_id", length = 36, nullable = false, updatable = false)
    private String sessionId;

    @JdbcTypeCode(SqlTypes.BINARY)
    @Column(name = "token_hash", length = 32, nullable = false, updatable = false)
    private byte[] tokenHash;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "consumed_at")
    private Instant consumedAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "replaced_by_id", length = 36)
    private String replacedById;

    public boolean isLive() {
        return consumedAt == null && revokedAt == null;
    }
}

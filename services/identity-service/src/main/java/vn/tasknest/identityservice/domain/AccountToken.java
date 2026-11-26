package vn.tasknest.identityservice.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * Bảng {@code account_tokens}: token một lần (xác nhận email), chỉ lưu SHA-256. Mỗi
 * (purpose, user) chỉ có tối đa một token còn hiệu lực — cột sinh {@code active_user_id} không ánh xạ.
 */
@Entity
@Table(name = "account_tokens")
@Getter
@Setter
@NoArgsConstructor
public class AccountToken {

    public static final String PURPOSE_EMAIL_VERIFICATION = "EMAIL_VERIFICATION";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.CHAR)
    @Column(name = "user_id", length = 36, nullable = false, updatable = false)
    private String userId;

    @Column(name = "purpose", length = 24, nullable = false, updatable = false)
    private String purpose;

    @Column(name = "issue_source", length = 16, nullable = false, updatable = false)
    private String issueSource = "OTHER";

    @JdbcTypeCode(SqlTypes.BINARY)
    @Column(name = "token_hash", length = 32, nullable = false, updatable = false)
    private byte[] tokenHash;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "expires_at", nullable = false, updatable = false)
    private Instant expiresAt;

    @Column(name = "used_at")
    private Instant usedAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;
}

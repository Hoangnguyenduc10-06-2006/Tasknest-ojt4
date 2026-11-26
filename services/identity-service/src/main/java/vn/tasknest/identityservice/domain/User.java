package vn.tasknest.identityservice.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Bảng {@code users}. Mọi mốc thời gian lưu UTC (DATETIME(6)).
 * Ràng buộc DB: is_email_verified = 1 khi và chỉ khi email_verified_at khác NULL.
 */
@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.CHAR)
    @Column(length = 36, nullable = false, updatable = false)
    private String id;

    @Column(name = "full_name", nullable = false, length = 100)
    private String fullName;

    @Column(name = "job_title", nullable = false, length = 100)
    private String jobTitle = "";

    @Column(name = "bio", nullable = false, length = 500)
    private String bio = "";

    @Column(name = "account_purpose", nullable = false, length = 12)
    private String accountPurpose = "UNDECIDED";
    @Column(name = "onboarding_status", nullable = false, length = 12)
    private String onboardingStatus = "DEFERRED";
    @Column(name = "onboarding_step", nullable = false)
    private int onboardingStep;
    @Column(name = "onboarding_draft", nullable = false, columnDefinition = "TEXT")
    private String onboardingDraft = "{}";
    @Column(name = "avatar_public", nullable = false)
    private boolean avatarPublic;

    @Column(name = "email", nullable = false, unique = true, length = 255)
    private String email;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Column(name = "is_email_verified", nullable = false)
    private boolean emailVerified = false;

    @Column(name = "email_verified_at")
    private Instant emailVerifiedAt;

    @Column(name = "avatar_storage_key", length = 500)
    private String avatarStorageKey;

    @Column(name = "avatar_mime_type", length = 100)
    private String avatarMimeType;

    @Column(name = "avatar_size_bytes")
    private Long avatarSizeBytes;

    /** Khóa lạc quan (optimistic lock) theo cột {@code version}. */
    @Version
    @Column(name = "version", nullable = false)
    private Long version;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public User(String fullName, String email, String passwordHash) {
        this.fullName = fullName;
        this.email = email;
        this.passwordHash = passwordHash;
    }

    /** Đánh dấu đã xác nhận email: cờ và mốc thời gian luôn đi cùng nhau để thỏa ck_user_verified. */
    public void markEmailVerified(Instant at) {
        this.emailVerified = true;
        this.emailVerifiedAt = at;
    }

    @PrePersist
    protected void onCreate() {
        Instant now = Instant.now().truncatedTo(ChronoUnit.MICROS);
        if (this.createdAt == null) {
            this.createdAt = now;
        }
        if (this.updatedAt == null) {
            this.updatedAt = now;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = Instant.now().truncatedTo(ChronoUnit.MICROS);
    }
}

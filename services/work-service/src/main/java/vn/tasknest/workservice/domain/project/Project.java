package vn.tasknest.workservice.domain.project;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "projects")
public class Project {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @JdbcTypeCode(SqlTypes.CHAR) @Column(name = "owner_user_id", length = 36, nullable = false, updatable = false)
    private String ownerUserId;
    @JdbcTypeCode(SqlTypes.CHAR) @Column(name = "manager_user_id", length = 36)
    private String managerUserId;
    @Column(nullable = false, length = 100) private String name;
    @Column(nullable = false, length = 500) private String description;
    @Column(name = "starts_on", nullable = false) private LocalDate startsOn;
    @Column(name = "ends_on", nullable = false) private LocalDate endsOn;
    @Enumerated(EnumType.STRING) @JdbcTypeCode(SqlTypes.VARCHAR) @Column(nullable = false, length = 12)
    private ProjectStatus status;
    @Column(name = "avatar_storage_key", length = 500) private String avatarStorageKey;
    @Column(name = "avatar_mime_type", length = 100) private String avatarMimeType;
    @Column(name = "avatar_size_bytes") private Long avatarSizeBytes;
    @Column(name = "archived_at") private Instant archivedAt;
    @JdbcTypeCode(SqlTypes.CHAR) @Column(name = "archived_by", length = 36) private String archivedBy;
    @Version @Column(nullable = false) private Long version;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;

    protected Project() {}
    public static Project create(String owner, String name, String description, LocalDate start, LocalDate end, Instant now) {
        Project p = new Project();
        p.ownerUserId = owner; p.name = name; p.description = description;
        p.startsOn = start; p.endsOn = end; p.status = ProjectStatus.ACTIVE;
        p.createdAt = now; p.updatedAt = now;
        return p;
    }
    public void updateDetails(String name, String description, LocalDate start, LocalDate end, Instant now) {
        if (this.status == ProjectStatus.ARCHIVED) {
            throw new IllegalStateException("Dự án đã lưu trữ chỉ được xem lại.");
        }
        this.name = name;
        this.description = description;
        this.startsOn = start;
        this.endsOn = end;
        this.updatedAt = now;
    }
    public boolean isArchived() {
        return this.status == ProjectStatus.ARCHIVED;
    }
    public void archive(String actorId, Instant now) {
        this.status = ProjectStatus.ARCHIVED;
        this.archivedAt = now;
        this.archivedBy = actorId;
        this.updatedAt = now;
    }
    public void reopen(Instant now) {
        this.status = ProjectStatus.ACTIVE;
        this.archivedAt = null;
        this.archivedBy = null;
        this.updatedAt = now;
    }
    public Long getId() { return id; }
    public String getOwnerUserId() { return ownerUserId; }
    public String getManagerUserId() { return managerUserId; }
    public String getName() { return name; }
    public String getDescription() { return description; }
    public LocalDate getStartsOn() { return startsOn; }
    public LocalDate getEndsOn() { return endsOn; }
    public ProjectStatus getStatus() { return status; }
    public Instant getArchivedAt() { return archivedAt; }
    public String getArchivedBy() { return archivedBy; }
    public Long getVersion() { return version; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public String getAvatarStorageKey() { return avatarStorageKey; }
}

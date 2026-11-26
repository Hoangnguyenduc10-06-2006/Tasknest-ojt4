package vn.tasknest.workservice.domain.project;

import jakarta.persistence.*;
import java.time.Instant;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity @Table(name = "project_memberships")
public class ProjectMembership {
    @EmbeddedId private MembershipId id;
    @Column(length = 100) private String specialty;
    @Enumerated(EnumType.STRING) @JdbcTypeCode(SqlTypes.VARCHAR) @Column(nullable = false, length = 10) private MembershipStatus status;
    @Column(name = "joined_at", nullable = false) private Instant joinedAt;
    @JdbcTypeCode(SqlTypes.CHAR) @Column(name = "added_by", nullable = false, length = 36) private String addedBy;
    @Column(name = "removed_at") private Instant removedAt;
    @JdbcTypeCode(SqlTypes.CHAR) @Column(name = "removed_by", length = 36) private String removedBy;
    protected ProjectMembership() {}
    public static ProjectMembership join(Long projectId, String userId, String addedBy, Instant now) {
        ProjectMembership m = new ProjectMembership();
        m.id = new MembershipId(projectId, userId); m.status = MembershipStatus.ACTIVE;
        m.addedBy = addedBy; m.joinedAt = now;
        return m;
    }
    public MembershipId getId() { return id; }
    public MembershipStatus getStatus() { return status; }
}

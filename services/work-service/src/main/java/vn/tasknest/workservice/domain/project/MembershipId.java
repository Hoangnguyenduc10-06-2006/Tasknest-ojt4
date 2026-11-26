package vn.tasknest.workservice.domain.project;

import jakarta.persistence.*;
import java.io.Serializable;
import java.util.Objects;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Embeddable
public class MembershipId implements Serializable {
    @Column(name = "project_id", nullable = false) private Long projectId;
    @JdbcTypeCode(SqlTypes.CHAR) @Column(name = "user_id", length = 36, nullable = false) private String userId;
    protected MembershipId() {}
    public MembershipId(Long projectId, String userId) { this.projectId = projectId; this.userId = userId; }
    public Long getProjectId() { return projectId; }
    public String getUserId() { return userId; }
    @Override public boolean equals(Object o) {
        return o instanceof MembershipId other && Objects.equals(projectId, other.projectId) && Objects.equals(userId, other.userId);
    }
    @Override public int hashCode() { return Objects.hash(projectId, userId); }
}

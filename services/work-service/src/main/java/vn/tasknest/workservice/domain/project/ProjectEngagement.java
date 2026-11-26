package vn.tasknest.workservice.domain.project;

import jakarta.persistence.*;
import org.hibernate.annotations.Immutable;

/** Read-only projection of the customer relationship owned by community workflows. */
@Entity
@Immutable
@Table(name="team_engagements")
public class ProjectEngagement {
    @Id @Column(name="project_id") private Long projectId;
    @Column(name="customer_user_id") private String customerUserId;
    @Column(name="status") private String status;
    protected ProjectEngagement() {}
}

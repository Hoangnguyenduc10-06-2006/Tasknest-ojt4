package vn.tasknest.workservice.infrastructure.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.tasknest.workservice.domain.project.*;

public interface ProjectMembershipRepository extends JpaRepository<ProjectMembership, MembershipId> {
    @org.springframework.data.jpa.repository.Query("select (count(e)>0) from ProjectEngagement e where e.projectId=:project and e.customerUserId=:user")
    boolean isCustomer(@org.springframework.data.repository.query.Param("project") Long project,@org.springframework.data.repository.query.Param("user") String user);
    @org.springframework.data.jpa.repository.Query("select (count(e)>0) from ProjectEngagement e where e.projectId=:project and e.customerUserId=:user and e.status in ('ACTIVE','COMPLETED')")
    boolean isConfirmedCustomer(@org.springframework.data.repository.query.Param("project") Long project,@org.springframework.data.repository.query.Param("user") String user);
    @org.springframework.data.jpa.repository.Query(value="SELECT COUNT(*) FROM project_agreements WHERE project_id=:project AND kickoff_at IS NULL",nativeQuery=true)
    long pendingKickoff(@org.springframework.data.repository.query.Param("project") Long project);
    @org.springframework.data.jpa.repository.Query("select (count(e)>0) from ProjectEngagement e where e.projectId=:project and e.status='COMPLETED'")
    boolean completedEngagement(@org.springframework.data.repository.query.Param("project") Long project);
    boolean existsByIdAndStatus(MembershipId id, MembershipStatus status);
}

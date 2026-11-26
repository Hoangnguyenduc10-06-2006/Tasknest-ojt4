package vn.tasknest.workservice.infrastructure.persistence;

import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import vn.tasknest.workservice.domain.project.*;

public interface ProjectRepository extends JpaRepository<Project, Long> {
    boolean existsByOwnerUserIdAndStatusAndNameIgnoreCase(String ownerUserId, ProjectStatus status, String name);
    boolean existsByOwnerUserIdAndStatusAndNameIgnoreCaseAndIdNot(String ownerUserId, ProjectStatus status, String name, Long id);
    @Query("select p from Project p where exists (select m from ProjectMembership m where m.id.projectId = p.id and m.id.userId = :userId and m.status = :status) or exists (select e from ProjectEngagement e where e.projectId=p.id and e.customerUserId=:userId and e.status in ('ACTIVE','COMPLETED')) order by p.updatedAt desc, p.id desc")
    List<Project> findAccessible(@Param("userId") String userId, @Param("status") MembershipStatus status);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Project p where p.id = :id")
    Optional<Project> findForUpdate(@Param("id") Long id);
    @Query(value = "SELECT COUNT(*) FROM time_entries WHERE project_id = :projectId AND ended_at IS NULL", nativeQuery = true)
    long countRunningTimersByProjectId(@Param("projectId") Long projectId);

    @Query(
        value = """
            select p from Project p
            where (exists (select m from ProjectMembership m where m.id.projectId=p.id and m.id.userId=:userId and m.status=:membershipStatus)
              or exists (select e from ProjectEngagement e where e.projectId=p.id and e.customerUserId=:userId and e.status in ('ACTIVE','COMPLETED')))
              and (:status is null or p.status = :status)
              and (
                  :roleFilter = 'ALL'
                  or (:roleFilter = 'CUSTOMER' and exists (select e from ProjectEngagement e where e.projectId=p.id and e.customerUserId=:userId))
                  or (:roleFilter = 'OWNER' and not exists (select e from ProjectEngagement e where e.projectId=p.id and e.customerUserId=:userId) and p.ownerUserId = :userId)
                  or (:roleFilter = 'MANAGER' and not exists (select e from ProjectEngagement e where e.projectId=p.id and e.customerUserId=:userId) and p.managerUserId = :userId and p.ownerUserId <> :userId)
                  or (:roleFilter = 'MEMBER' and not exists (select e from ProjectEngagement e where e.projectId=p.id and e.customerUserId=:userId) and p.ownerUserId <> :userId and (p.managerUserId is null or p.managerUserId <> :userId))
              )
              and (:qPattern = '' or lower(p.name) like lower(:qPattern) escape '\\')
            """,
        countQuery = """
            select count(p) from Project p
            where (exists (select m from ProjectMembership m where m.id.projectId=p.id and m.id.userId=:userId and m.status=:membershipStatus)
              or exists (select e from ProjectEngagement e where e.projectId=p.id and e.customerUserId=:userId and e.status in ('ACTIVE','COMPLETED')))
              and (:status is null or p.status = :status)
              and (
                  :roleFilter = 'ALL'
                  or (:roleFilter = 'CUSTOMER' and exists (select e from ProjectEngagement e where e.projectId=p.id and e.customerUserId=:userId))
                  or (:roleFilter = 'OWNER' and not exists (select e from ProjectEngagement e where e.projectId=p.id and e.customerUserId=:userId) and p.ownerUserId = :userId)
                  or (:roleFilter = 'MANAGER' and not exists (select e from ProjectEngagement e where e.projectId=p.id and e.customerUserId=:userId) and p.managerUserId = :userId and p.ownerUserId <> :userId)
                  or (:roleFilter = 'MEMBER' and not exists (select e from ProjectEngagement e where e.projectId=p.id and e.customerUserId=:userId) and p.ownerUserId <> :userId and (p.managerUserId is null or p.managerUserId <> :userId))
              )
              and (:qPattern = '' or lower(p.name) like lower(:qPattern) escape '\\')
            """
    )
    Page<Project> findMemberProjects(
        @Param("userId") String userId,
        @Param("membershipStatus") MembershipStatus membershipStatus,
        @Param("status") ProjectStatus status,
        @Param("roleFilter") String roleFilter,
        @Param("qPattern") String qPattern,
        Pageable pageable
    );
}

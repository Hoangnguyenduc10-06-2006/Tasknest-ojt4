package vn.tasknest.workservice.application.security;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.tasknest.workservice.application.WorkException;
import vn.tasknest.workservice.domain.project.*;
import vn.tasknest.workservice.infrastructure.persistence.*;

@Service
public class ProjectPermissionService {
    private final ProjectRepository projects;
    private final ProjectMembershipRepository memberships;

    public ProjectPermissionService(ProjectRepository projects, ProjectMembershipRepository memberships) {
        this.projects = projects;
        this.memberships = memberships;
    }

    public void requireVerified(WorkActor actor) {
        if (actor == null)
            throw new WorkException(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "Vui lòng đăng nhập.");
        if (!actor.emailVerified())
            throw new WorkException(HttpStatus.FORBIDDEN, "EMAIL_NOT_VERIFIED", "Vui lòng xác nhận email.");
    }

    @Transactional(readOnly = true)
    public ProjectAccess requireMember(Long projectId, WorkActor actor) {
        requireVerified(actor);
        return membership(projects.findById(projectId).orElseThrow(this::notFound), actor);
    }

    public ProjectAccess requireInternalMember(Long projectId, WorkActor actor) {
        var access = requireMember(projectId, actor);
        requireInternalRole(access);
        return access;
    }

    public void requireInternalRole(ProjectAccess access) {
        if (access.role() == ProjectRole.CUSTOMER) throw forbidden();
    }

    public void requireUncompleted(Long projectId) {
        if (memberships.completedEngagement(projectId))
            throw new WorkException(HttpStatus.CONFLICT, "COOPERATION_COMPLETED",
                "Dự án đã hoàn thành. Khách hàng và chủ đội cần đồng ý để mở lại.");
    }

    /**
     * Call inside the caller's write transaction; all role/member changes must lock
     * this project first.
     */
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.MANDATORY)
    public ProjectAccess requireWritable(Long projectId, WorkActor actor) {
        requireVerified(actor);
        ProjectAccess access = membership(projects.findForUpdate(projectId).orElseThrow(this::notFound), actor);
        if (access.project().getStatus() != ProjectStatus.ACTIVE)
            throw new WorkException(HttpStatus.CONFLICT, "PROJECT_ARCHIVED", "Dự án đã lưu trữ chỉ được xem lại.");
        requireUncompleted(projectId);
        return access;
    }

    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.MANDATORY)
    public ProjectAccess requireManager(Long projectId, WorkActor actor) {
        ProjectAccess access = requireWritable(projectId, actor);
        if (!access.role().canManage())
            throw forbidden();
        return access;
    }

    /** Does not require ACTIVE: allows owner to reopen an archived project. */
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.MANDATORY)
    public ProjectAccess requireOwner(Long projectId, WorkActor actor) {
        requireVerified(actor);
        ProjectAccess access = membership(projects.findForUpdate(projectId).orElseThrow(this::notFound), actor);
        if (access.role() != ProjectRole.OWNER)
            throw forbidden();
        return access;
    }

    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.MANDATORY)
    public ProjectAccess requireDeveloper(Long projectId, WorkActor actor) {
        var access=requireWritable(projectId,actor);
        if(access.role()==ProjectRole.CUSTOMER) throw forbidden();
        if(memberships.pendingKickoff(projectId)>0) throw new WorkException(HttpStatus.CONFLICT,"KICKOFF_REQUIRED","Chủ đội cần xác nhận nhân sự và khởi động dự án trước khi giao việc.");
        return access;
    }
    public String developmentState(Long project) {
        if(memberships.completedEngagement(project)) return "COMPLETED";
        return memberships.pendingKickoff(project)>0 ? "PENDING_KICKOFF" : "ACTIVE";
    }
    public boolean isCustomer(Long project,String user) { return memberships.isCustomer(project,user); }

    public ProjectRole resolveRole(Project project, String userId) {
        if (memberships.isCustomer(project.getId(),userId)) return ProjectRole.CUSTOMER;
        return userId.equals(project.getOwnerUserId()) ? ProjectRole.OWNER
                : userId.equals(project.getManagerUserId()) ? ProjectRole.MANAGER : ProjectRole.MEMBER;
    }

    private ProjectAccess membership(Project project, WorkActor actor) {
        if (!memberships.existsByIdAndStatus(new MembershipId(project.getId(), actor.userId()),
                MembershipStatus.ACTIVE) && !memberships.isConfirmedCustomer(project.getId(),actor.userId()))
            throw notFound();
        return new ProjectAccess(project, resolveRole(project, actor.userId()));
    }

    private WorkException notFound() {
        return new WorkException(HttpStatus.NOT_FOUND, "PROJECT_NOT_FOUND",
                "Không tìm thấy dự án hoặc không có quyền truy cập.");
    }

    private WorkException forbidden() {
        return new WorkException(HttpStatus.FORBIDDEN, "PROJECT_FORBIDDEN",
                "Bạn không có quyền thực hiện thao tác này.");
    }
}

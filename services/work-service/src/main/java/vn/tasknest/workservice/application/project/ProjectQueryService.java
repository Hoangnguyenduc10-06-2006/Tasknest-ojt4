package vn.tasknest.workservice.application.project;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;
import vn.tasknest.workservice.api.PageResponse;
import vn.tasknest.workservice.api.project.ProjectListQuery;
import vn.tasknest.workservice.api.project.ProjectResponse;
import vn.tasknest.workservice.application.WorkException;
import vn.tasknest.workservice.application.security.ProjectAccess;
import vn.tasknest.workservice.application.security.ProjectPermissionService;
import vn.tasknest.workservice.application.security.WorkActor;
import vn.tasknest.workservice.domain.project.MembershipStatus;
import vn.tasknest.workservice.infrastructure.persistence.ProjectRepository;

@Service
@Validated
public class ProjectQueryService {
    private final ProjectRepository projects;
    private final ProjectPermissionService permissions;

    public ProjectQueryService(ProjectRepository projects, ProjectPermissionService permissions) {
        this.projects = projects;
        this.permissions = permissions;
    }

    @Transactional(readOnly = true)
    public PageResponse<ProjectResponse> list(WorkActor actor, @NotNull @Valid ProjectListQuery query) {
        permissions.requireVerified(actor);
        if (query.page() < 0 || !query.isSizeValid() || (long) query.page() * query.size() > Integer.MAX_VALUE) {
            throw new WorkException(HttpStatus.BAD_REQUEST, "INVALID_PAGE",
                    "Chỉ số trang và kích thước vượt quá giới hạn cho phép.");
        }
        String roleFilter = query.role() == null ? "ALL" : query.role().name();
        String qPattern = query.q().isEmpty() ? "" : "%" + escapeLike(query.q()) + "%";
        Pageable pageable = PageRequest.of(query.page(), query.size(), toSort(query.sort()));
        Page<ProjectResponse> page = projects
                .findMemberProjects(
                        actor.userId(),
                        MembershipStatus.ACTIVE,
                        query.status(),
                        roleFilter,
                        qPattern,
                        pageable)
                .map(project -> ProjectResponse.from(project, permissions.resolveRole(project, actor.userId())).withDevelopmentState(permissions.developmentState(project.getId())));
        return PageResponse.from(page);
    }

    @Transactional(readOnly = true)
    public ProjectResponse getDetail(WorkActor actor, @NotNull Long projectId) {
        ProjectAccess access = permissions.requireMember(projectId, actor);
        return ProjectResponse.from(access.project(), access.role()).withDevelopmentState(permissions.developmentState(projectId));
    }

    private static String escapeLike(String input) {
        return input.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    private static Sort toSort(ProjectListQuery.Sort sort) {
        return switch (sort) {
            case UPDATED_DESC -> Sort.by(Sort.Order.desc("updatedAt"), Sort.Order.desc("id"));
            case NAME_ASC -> Sort.by(Sort.Order.asc("name"), Sort.Order.asc("id"));
            case NAME_DESC -> Sort.by(Sort.Order.desc("name"), Sort.Order.asc("id"));
        };
    }
}

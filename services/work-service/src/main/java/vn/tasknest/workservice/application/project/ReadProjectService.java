package vn.tasknest.workservice.application.project;

import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.tasknest.workservice.api.project.ProjectResponse;
import vn.tasknest.workservice.application.security.*;
import vn.tasknest.workservice.domain.project.*;
import vn.tasknest.workservice.infrastructure.persistence.ProjectRepository;

@Service
@Transactional(readOnly = true)
public class ReadProjectService {
    private final ProjectRepository projects;
    private final ProjectPermissionService permissions;
    public ReadProjectService(ProjectRepository projects, ProjectPermissionService permissions) {
        this.projects = projects;
        this.permissions = permissions;
    }
    public List<ProjectResponse> list(WorkActor actor) {
        permissions.requireVerified(actor);
        return projects.findAccessible(actor.userId(), MembershipStatus.ACTIVE).stream()
.map(project -> ProjectResponse.from(project, permissions.resolveRole(project,actor.userId())).withDevelopmentState(permissions.developmentState(project.getId()))).toList();
    }
    public ProjectResponse get(WorkActor actor, Long projectId) {
        ProjectAccess access = permissions.requireMember(projectId, actor);
        return ProjectResponse.from(access.project(), access.role()).withDevelopmentState(permissions.developmentState(projectId));
    }
}

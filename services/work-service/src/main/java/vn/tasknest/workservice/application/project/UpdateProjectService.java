package vn.tasknest.workservice.application.project;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.time.Clock;
import java.time.temporal.ChronoUnit;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;
import vn.tasknest.workservice.api.project.ProjectResponse;
import vn.tasknest.workservice.api.project.UpdateProjectRequest;
import vn.tasknest.workservice.application.WorkException;
import vn.tasknest.workservice.application.security.ProjectAccess;
import vn.tasknest.workservice.application.security.ProjectPermissionService;
import vn.tasknest.workservice.application.security.WorkActor;
import vn.tasknest.workservice.domain.project.Project;
import vn.tasknest.workservice.domain.project.ProjectStatus;
import vn.tasknest.workservice.infrastructure.persistence.ProjectActivityRepository;
import vn.tasknest.workservice.infrastructure.persistence.ProjectRepository;

@Service @Validated
public class UpdateProjectService {
    private final ProjectRepository projects;
    private final ProjectPermissionService permissions;
    private final Clock clock;
    private final ProjectActivityRepository activity;

    public UpdateProjectService(ProjectRepository projects, ProjectPermissionService permissions,
            Clock clock, ProjectActivityRepository activity) {
        this.projects = projects;
        this.permissions = permissions;
        this.clock = clock;
        this.activity = activity;
    }

    @Transactional
    public ProjectResponse update(WorkActor actor, @NotNull Long projectId, @NotNull @Valid UpdateProjectRequest request) {
        ProjectAccess access = permissions.requireManager(projectId, actor);
        Project project = access.project();

        if (!request.version().equals(project.getVersion())) {
            throw new WorkException(HttpStatus.CONFLICT, "PROJECT_VERSION_CONFLICT",
                "Dự án đã được cập nhật ở nơi khác. Vui lòng tải lại trước khi lưu.");
        }

        if (projects.existsByOwnerUserIdAndStatusAndNameIgnoreCaseAndIdNot(
                project.getOwnerUserId(), ProjectStatus.ACTIVE, request.name(), project.getId())) {
            throw new WorkException(HttpStatus.CONFLICT, "PROJECT_NAME_EXISTS",
                "Bạn đã có dự án đang hoạt động cùng tên.");
        }

        String beforeName = project.getName();
        String beforeDescription = project.getDescription();
        var beforeStartsOn = project.getStartsOn();
        var beforeEndsOn = project.getEndsOn();
        var now = clock.instant().truncatedTo(ChronoUnit.MICROS);

        project.updateDetails(request.name(), request.description(), request.startsOn(), request.endsOn(), now);
        Project saved = projects.saveAndFlush(project);
        activity.recordUpdated(saved, beforeName, beforeDescription, beforeStartsOn, beforeEndsOn, actor.userId(), now);
        return ProjectResponse.from(saved, access.role()).withDevelopmentState(permissions.developmentState(projectId));
    }
}


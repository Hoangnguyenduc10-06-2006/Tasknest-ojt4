package vn.tasknest.workservice.application.project;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.time.Clock;
import java.time.temporal.ChronoUnit;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;
import vn.tasknest.workservice.api.project.*;
import vn.tasknest.workservice.application.WorkException;
import vn.tasknest.workservice.application.security.*;
import vn.tasknest.workservice.domain.project.*;
import vn.tasknest.workservice.infrastructure.persistence.*;

@Service @Validated
public class CreateProjectService {
    private final ProjectRepository projects;
    private final ProjectMembershipRepository memberships;
    private final ProjectPermissionService permissions;
    private final Clock clock;
    private final ProjectActivityRepository activity;
    private final ProjectStorageRepository storage;
    public CreateProjectService(ProjectRepository projects, ProjectMembershipRepository memberships,
            ProjectPermissionService permissions, Clock clock, ProjectActivityRepository activity, ProjectStorageRepository storage) {
        this.projects = projects; this.memberships = memberships; this.permissions = permissions; this.clock = clock;
        this.activity = activity; this.storage = storage;
    }
    @Transactional
    public ProjectResponse create(WorkActor actor, @NotNull @Valid CreateProjectRequest request) {
        permissions.requireVerified(actor);
        if (projects.existsByOwnerUserIdAndStatusAndNameIgnoreCase(actor.userId(), ProjectStatus.ACTIVE, request.name()))
            throw new WorkException(HttpStatus.CONFLICT, "PROJECT_NAME_EXISTS", "Bạn đã có dự án đang hoạt động cùng tên.");
        var now = clock.instant().truncatedTo(ChronoUnit.MICROS);
        Project project = projects.saveAndFlush(Project.create(actor.userId(), request.name(), request.description(), request.startsOn(), request.endsOn(), now));
        memberships.saveAndFlush(ProjectMembership.join(project.getId(), actor.userId(), actor.userId(), now));
        storage.initialize(project.getId());
        activity.recordCreated(project, actor.userId());
        return ProjectResponse.from(project, ProjectRole.OWNER);
    }
}

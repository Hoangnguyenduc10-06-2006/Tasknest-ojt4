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
import vn.tasknest.workservice.api.project.ProjectStatusChangeRequest;
import vn.tasknest.workservice.application.WorkException;
import vn.tasknest.workservice.application.security.ProjectAccess;
import vn.tasknest.workservice.application.security.ProjectPermissionService;
import vn.tasknest.workservice.application.security.WorkActor;
import vn.tasknest.workservice.domain.project.Project;
import vn.tasknest.workservice.domain.project.ProjectStatus;
import vn.tasknest.workservice.infrastructure.persistence.ProjectActivityRepository;
import vn.tasknest.workservice.infrastructure.persistence.ProjectRepository;

@Service @Validated
public class ArchiveProjectService {
    private final ProjectRepository projects;
    private final ProjectPermissionService permissions;
    private final Clock clock;
    private final ProjectActivityRepository activity;

    public ArchiveProjectService(ProjectRepository projects, ProjectPermissionService permissions,
            Clock clock, ProjectActivityRepository activity) {
        this.projects = projects;
        this.permissions = permissions;
        this.clock = clock;
        this.activity = activity;
    }

    @Transactional
    public ProjectResponse archive(WorkActor actor, @NotNull Long projectId, @NotNull @Valid ProjectStatusChangeRequest request) {
        ProjectAccess access = permissions.requireOwner(projectId, actor);
        Project project = access.project();

        if (!request.version().equals(project.getVersion())) {
            throw new WorkException(HttpStatus.CONFLICT, "PROJECT_VERSION_CONFLICT",
                "Dự án đã được cập nhật ở nơi khác. Vui lòng tải lại trước khi lưu.");
        }

        if (project.getStatus() == ProjectStatus.ARCHIVED) {
            throw new WorkException(HttpStatus.CONFLICT, "PROJECT_ALREADY_ARCHIVED",
                "Dự án đã ở trạng thái lưu trữ.");
        }

        if ("COMPLETED".equals(permissions.developmentState(projectId))) {
            throw new WorkException(HttpStatus.CONFLICT, "COOPERATION_COMPLETED",
                "Dự án đã hoàn thành. Hãy yêu cầu bên còn lại đồng ý nếu cần tiếp tục dự án.");
        }

        long runningTimers = projects.countRunningTimersByProjectId(projectId);
        if (runningTimers > 0) {
            throw new WorkException(HttpStatus.CONFLICT, "PROJECT_HAS_RUNNING_TIMER",
                "Không thể lưu trữ dự án vì còn " + runningTimers + " phiên ghi giờ đang chạy. Vui lòng kết thúc các phiên trước.");
        }

        var now = clock.instant().truncatedTo(ChronoUnit.MICROS);
        project.archive(actor.userId(), now);
        Project saved = projects.saveAndFlush(project);
        activity.recordArchived(saved, actor.userId(), now);
        return ProjectResponse.from(saved, access.role()).withDevelopmentState(permissions.developmentState(projectId));
    }

    @Transactional
    public ProjectResponse reopen(WorkActor actor, @NotNull Long projectId, @NotNull @Valid ProjectStatusChangeRequest request) {
        ProjectAccess access = permissions.requireOwner(projectId, actor);
        Project project = access.project();

        if (!request.version().equals(project.getVersion())) {
            throw new WorkException(HttpStatus.CONFLICT, "PROJECT_VERSION_CONFLICT",
                "Dự án đã được cập nhật ở nơi khác. Vui lòng tải lại trước khi lưu.");
        }

        if (project.getStatus() == ProjectStatus.ACTIVE) {
            throw new WorkException(HttpStatus.CONFLICT, "PROJECT_ALREADY_ACTIVE",
                "Dự án đang ở trạng thái hoạt động.");
        }

        if (projects.existsByOwnerUserIdAndStatusAndNameIgnoreCaseAndIdNot(
                project.getOwnerUserId(), ProjectStatus.ACTIVE, project.getName(), project.getId())) {
            throw new WorkException(HttpStatus.CONFLICT, "PROJECT_NAME_EXISTS",
                "Bạn đã có dự án đang hoạt động cùng tên.");
        }

        var now = clock.instant().truncatedTo(ChronoUnit.MICROS);
        project.reopen(now);
        Project saved = projects.saveAndFlush(project);
        activity.recordReopened(saved, actor.userId(), now);
        return ProjectResponse.from(saved, access.role()).withDevelopmentState(permissions.developmentState(projectId));
    }
}

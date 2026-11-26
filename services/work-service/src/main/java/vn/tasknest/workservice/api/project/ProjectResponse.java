package vn.tasknest.workservice.api.project;

import java.time.Instant;
import java.time.LocalDate;
import vn.tasknest.workservice.domain.project.*;

public record ProjectResponse(Long id, String name, String description, String ownerUserId,
    String managerUserId, ProjectStatus status, ProjectRole role, LocalDate startsOn, LocalDate endsOn,
    boolean hasAvatar, Long version, Instant createdAt, Instant updatedAt, String developmentState) {
    public ProjectResponse(Long id,String name,String description,String ownerUserId,String managerUserId,ProjectStatus status,ProjectRole role,LocalDate startsOn,LocalDate endsOn,boolean hasAvatar,Long version,Instant createdAt,Instant updatedAt) {
        this(id,name,description,ownerUserId,managerUserId,status,role,startsOn,endsOn,hasAvatar,version,createdAt,updatedAt,"ACTIVE");
    }
    public ProjectResponse withDevelopmentState(String state) {
        return new ProjectResponse(id,name,description,ownerUserId,managerUserId,status,role,startsOn,endsOn,hasAvatar,version,createdAt,updatedAt,state==null?"ACTIVE":state);
    }
    public static ProjectResponse from(Project project, ProjectRole role) {
        return new ProjectResponse(project.getId(), project.getName(), project.getDescription(), project.getOwnerUserId(),
            project.getManagerUserId(), project.getStatus(), role, project.getStartsOn(), project.getEndsOn(),
            project.getAvatarStorageKey() != null, project.getVersion(), project.getCreatedAt(), project.getUpdatedAt());
    }
}

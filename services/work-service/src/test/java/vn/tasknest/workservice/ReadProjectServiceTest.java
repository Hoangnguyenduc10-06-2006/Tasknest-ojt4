package vn.tasknest.workservice;

import java.util.List;
import org.junit.jupiter.api.Test;
import vn.tasknest.workservice.application.project.ReadProjectService;
import vn.tasknest.workservice.application.security.*;
import vn.tasknest.workservice.domain.project.*;
import vn.tasknest.workservice.infrastructure.persistence.ProjectRepository;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;

class ReadProjectServiceTest {
    @Test void resolvesRolesFromCurrentDatabaseFieldsAndScopesQueryToActiveMembership() {
        ProjectRepository projects = mock(ProjectRepository.class);
        ProjectPermissionService permissions = mock(ProjectPermissionService.class);
        Project owner = mock(Project.class), manager = mock(Project.class), member = mock(Project.class);
        String user = "00000000-0000-4000-8000-000000000001";
        WorkActor actor = new WorkActor(user, true);
        when(permissions.resolveRole(owner,user)).thenReturn(ProjectRole.OWNER);
        when(permissions.resolveRole(manager,user)).thenReturn(ProjectRole.MANAGER);
        when(permissions.resolveRole(member,user)).thenReturn(ProjectRole.MEMBER);
        when(projects.findAccessible(user, MembershipStatus.ACTIVE)).thenReturn(List.of(owner, manager, member));
        var result = new ReadProjectService(projects, permissions).list(actor);
        assertEquals(List.of(ProjectRole.OWNER, ProjectRole.MANAGER, ProjectRole.MEMBER), result.stream().map(item -> item.role()).toList());
        verify(permissions).requireVerified(actor);
        verify(projects).findAccessible(user, MembershipStatus.ACTIVE);
    }
    @Test void detailUsesObjectPermissionCheckAndPreservesCurrentVersion() {
        ProjectRepository projects = mock(ProjectRepository.class);
        ProjectPermissionService permissions = mock(ProjectPermissionService.class);
        Project project = mock(Project.class);
        WorkActor actor = new WorkActor("00000000-0000-4000-8000-000000000001", true);
        when(project.getVersion()).thenReturn(4L);
        when(permissions.requireMember(7L, actor)).thenReturn(new ProjectAccess(project, ProjectRole.MEMBER));
        var result = new ReadProjectService(projects, permissions).get(actor, 7L);
        assertEquals(4L, result.version());
        assertEquals(ProjectRole.MEMBER, result.role());
        verifyNoInteractions(projects);
    }
}

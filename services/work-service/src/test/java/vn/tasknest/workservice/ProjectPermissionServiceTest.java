package vn.tasknest.workservice;

import java.util.Optional;
import org.junit.jupiter.api.*;
import vn.tasknest.workservice.application.WorkException;
import vn.tasknest.workservice.application.security.*;
import vn.tasknest.workservice.domain.project.*;
import vn.tasknest.workservice.infrastructure.persistence.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.junit.jupiter.api.Assertions.*;

class ProjectPermissionServiceTest {
    static final String OWNER="00000000-0000-4000-8000-000000000001", MANAGER="00000000-0000-4000-8000-000000000002", MEMBER="00000000-0000-4000-8000-000000000003";
    ProjectRepository projects; ProjectMembershipRepository members; Project project; ProjectPermissionService permissions;
    @BeforeEach void setup() {
        projects=mock(ProjectRepository.class); members=mock(ProjectMembershipRepository.class); project=mock(Project.class);
        permissions=new ProjectPermissionService(projects,members);
        when(project.getId()).thenReturn(1L);when(project.getOwnerUserId()).thenReturn(OWNER);when(project.getManagerUserId()).thenReturn(MANAGER);
        when(project.getStatus()).thenReturn(ProjectStatus.ACTIVE);
        when(projects.findById(1L)).thenReturn(Optional.of(project));when(projects.findForUpdate(1L)).thenReturn(Optional.of(project));
        when(members.existsByIdAndStatus(any(),eq(MembershipStatus.ACTIVE))).thenReturn(true);
    }
    @Test void resolvesRolesFromCurrentProject() {
        assertEquals(ProjectRole.OWNER,permissions.requireMember(1L,new WorkActor(OWNER,true)).role());
        assertEquals(ProjectRole.MANAGER,permissions.requireMember(1L,new WorkActor(MANAGER,true)).role());
        assertEquals(ProjectRole.MEMBER,permissions.requireMember(1L,new WorkActor(MEMBER,true)).role());
    }
    @Test void removedOwnerCannotAccessEvenWithMatchingOwnerId() {
        when(members.existsByIdAndStatus(any(),any())).thenReturn(false);
        assertEquals("PROJECT_NOT_FOUND",assertThrows(WorkException.class,()->permissions.requireMember(1L,new WorkActor(OWNER,true))).code());
    }
    @Test void memberCannotManageOrOwnProject() {
        assertEquals("PROJECT_FORBIDDEN",assertThrows(WorkException.class,()->permissions.requireManager(1L,new WorkActor(MEMBER,true))).code());
        assertThrows(WorkException.class,()->permissions.requireOwner(1L,new WorkActor(MANAGER,true)));
    }
    @Test void archivedProjectIsReadableButNotWritableAndOwnerCanReopen() {
        when(project.getStatus()).thenReturn(ProjectStatus.ARCHIVED);
        assertNotNull(permissions.requireMember(1L,new WorkActor(MEMBER,true)));
        assertEquals("PROJECT_ARCHIVED",assertThrows(WorkException.class,()->permissions.requireManager(1L,new WorkActor(OWNER,true))).code());
        assertNotNull(permissions.requireOwner(1L,new WorkActor(OWNER,true)));
    }
    @Test void demotionTakesEffectWithoutNewJwt() {
        WorkActor actor=new WorkActor(MANAGER,true);
        assertEquals(ProjectRole.MANAGER,permissions.requireManager(1L,actor).role());
        when(project.getManagerUserId()).thenReturn(null);
        assertThrows(WorkException.class,()->permissions.requireManager(1L,actor));
    }
    @Test void rejectsUnverifiedAndMissingActors() {
        assertEquals("EMAIL_NOT_VERIFIED",assertThrows(WorkException.class,()->permissions.requireVerified(new WorkActor(MEMBER,false))).code());
        assertEquals("UNAUTHENTICATED",assertThrows(WorkException.class,()->permissions.requireVerified(null)).code());
    }
    @Test void customerIsProjectScopedAndCannotUseDeveloperOrManagerWrites() {
        when(members.isCustomer(1L,MEMBER)).thenReturn(true);
        var actor=new WorkActor(MEMBER,true);
        assertEquals(ProjectRole.CUSTOMER,permissions.requireMember(1L,actor).role());
        assertEquals(org.springframework.http.HttpStatus.FORBIDDEN,assertThrows(WorkException.class,()->permissions.requireInternalMember(1L,actor)).status());
        assertThrows(WorkException.class,()->permissions.requireDeveloper(1L,actor));
        assertThrows(WorkException.class,()->permissions.requireManager(1L,actor));
        when(project.getId()).thenReturn(2L);
        assertEquals(ProjectRole.MEMBER,permissions.resolveRole(project,MEMBER));
    }
    @Test void confirmedCustomerRetainsReadAccessAfterMembershipRemoval() {
        when(members.existsByIdAndStatus(any(),any())).thenReturn(false);
        when(members.isConfirmedCustomer(1L,MEMBER)).thenReturn(true);
        when(members.isCustomer(1L,MEMBER)).thenReturn(true);
        assertEquals(ProjectRole.CUSTOMER,permissions.requireMember(1L,new WorkActor(MEMBER,true)).role());
        when(project.getStatus()).thenReturn(ProjectStatus.ARCHIVED);
        assertNotNull(permissions.requireMember(1L,new WorkActor(MEMBER,true)));
    }

    @Test void completedLifecycleLocksWritesAndRetainsReadAccess() {
        var actor=new WorkActor(OWNER,true);
        when(members.pendingKickoff(1L)).thenReturn(1L);
        assertEquals("PENDING_KICKOFF",permissions.developmentState(1L));
        assertEquals("KICKOFF_REQUIRED",assertThrows(WorkException.class,()->permissions.requireDeveloper(1L,actor)).code());
        when(members.completedEngagement(1L)).thenReturn(true);
        assertEquals("COMPLETED",permissions.developmentState(1L));
        assertEquals("COOPERATION_COMPLETED",assertThrows(WorkException.class,()->permissions.requireDeveloper(1L,actor)).code());
        assertNotNull(permissions.requireMember(1L,actor));
        assertEquals("COOPERATION_COMPLETED",assertThrows(WorkException.class,()->permissions.requireWritable(1L,actor)).code());
    }
}

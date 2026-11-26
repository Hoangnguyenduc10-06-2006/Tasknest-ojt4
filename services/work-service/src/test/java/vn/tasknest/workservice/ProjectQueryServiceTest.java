package vn.tasknest.workservice;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import vn.tasknest.workservice.api.PageResponse;
import vn.tasknest.workservice.api.project.ProjectListQuery;
import vn.tasknest.workservice.api.project.ProjectResponse;
import vn.tasknest.workservice.application.WorkException;
import vn.tasknest.workservice.application.project.ProjectQueryService;
import vn.tasknest.workservice.application.security.ProjectPermissionService;
import vn.tasknest.workservice.application.security.WorkActor;
import vn.tasknest.workservice.domain.project.MembershipId;
import vn.tasknest.workservice.domain.project.MembershipStatus;
import vn.tasknest.workservice.domain.project.Project;
import vn.tasknest.workservice.domain.project.ProjectRole;
import vn.tasknest.workservice.domain.project.ProjectStatus;
import vn.tasknest.workservice.infrastructure.persistence.ProjectMembershipRepository;
import vn.tasknest.workservice.infrastructure.persistence.ProjectRepository;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ProjectQueryServiceTest {
    static final String OWNER = "00000000-0000-4000-8000-000000000001";
    static final String MANAGER = "00000000-0000-4000-8000-000000000002";
    static final String MEMBER = "00000000-0000-4000-8000-000000000003";
    static final String OUTSIDER = "00000000-0000-4000-8000-000000000099";

    ProjectRepository projects;
    ProjectMembershipRepository memberships;
    ProjectPermissionService permissions;
    ProjectQueryService service;

    @BeforeEach
    void setUp() {
        projects = mock(ProjectRepository.class);
        memberships = mock(ProjectMembershipRepository.class);
        permissions = new ProjectPermissionService(projects, memberships);
        service = new ProjectQueryService(projects, permissions);
    }

    private static Project mockProject(Long id, String name, String owner, String manager, ProjectStatus status) {
        Project p = mock(Project.class);
        when(p.getId()).thenReturn(id);
        when(p.getName()).thenReturn(name);
        when(p.getDescription()).thenReturn("Mô tả chi tiết dự án " + name);
        when(p.getOwnerUserId()).thenReturn(owner);
        when(p.getManagerUserId()).thenReturn(manager);
        when(p.getStatus()).thenReturn(status);
        when(p.getStartsOn()).thenReturn(LocalDate.of(2026, 10, 19));
        when(p.getEndsOn()).thenReturn(LocalDate.of(2026, 11, 15));
        when(p.getVersion()).thenReturn(0L);
        when(p.getCreatedAt()).thenReturn(Instant.EPOCH);
        when(p.getUpdatedAt()).thenReturn(Instant.EPOCH);
        return p;
    }

    @Test
    void listsActiveMemberProjectsAndResolvesCurrentRoles() {
        Project pOwner = mockProject(1L, "Dự án Owner", MEMBER, MANAGER, ProjectStatus.ACTIVE);
        Project pManager = mockProject(2L, "Dự án Manager", OWNER, MEMBER, ProjectStatus.ACTIVE);
        Project pMember = mockProject(3L, "Dự án Member", OWNER, MANAGER, ProjectStatus.ARCHIVED);

        PageRequest expectedPage = PageRequest.of(
                0, 20, Sort.by(Sort.Order.desc("updatedAt"), Sort.Order.desc("id")));
        when(projects.findMemberProjects(
                eq(MEMBER),
                eq(MembershipStatus.ACTIVE),
                isNull(),
                eq("ALL"),
                eq(""),
                eq(expectedPage)))
                .thenReturn(new PageImpl<>(List.of(pOwner, pManager, pMember), expectedPage, 3));

        PageResponse<ProjectResponse> result = service.list(
                new WorkActor(MEMBER, true),
                new ProjectListQuery(null, null, null, null, null, null));

        assertEquals(0, result.page());
        assertEquals(20, result.size());
        assertEquals(3L, result.totalElements());
        assertEquals(1, result.totalPages());
        assertEquals(ProjectRole.OWNER, result.content().get(0).role());
        assertEquals(ProjectRole.MANAGER, result.content().get(1).role());
        assertEquals(ProjectRole.MEMBER, result.content().get(2).role());
    }

    @Test
    void filtersByStatusRoleEscapesSearchWildcardsAndAppliesSecondaryIdSort() {
        for (int allowedSize : List.of(10, 20, 50)) {
            PageRequest expectedPage = PageRequest.of(
                    1, allowedSize, Sort.by(Sort.Order.asc("name"), Sort.Order.asc("id")));
            when(projects.findMemberProjects(
                    eq(MANAGER),
                    eq(MembershipStatus.ACTIVE),
                    eq(ProjectStatus.ACTIVE),
                    eq("MANAGER"),
                    eq("%100\\%\\_test\\\\q%"),
                    eq(expectedPage)))
                    .thenReturn(new PageImpl<>(List.of(), expectedPage, 0));

            PageResponse<ProjectResponse> result = service.list(
                    new WorkActor(MANAGER, true),
                    new ProjectListQuery(" 100%_test\\q ", ProjectStatus.ACTIVE, ProjectRole.MANAGER, 1, allowedSize,
                            ProjectListQuery.Sort.NAME_ASC));

            assertEquals(1, result.page());
            assertEquals(allowedSize, result.size());
            assertEquals(0L, result.totalElements());
        }
    }

    @Test
    void supportsNameDescSortWithSecondaryIdOrder() {
        PageRequest expectedPage = PageRequest.of(
                0, 50, Sort.by(Sort.Order.desc("name"), Sort.Order.asc("id")));
        when(projects.findMemberProjects(
                eq(OWNER),
                eq(MembershipStatus.ACTIVE),
                eq(ProjectStatus.ARCHIVED),
                eq("OWNER"),
                eq("%tasknest%"),
                eq(expectedPage)))
                .thenReturn(new PageImpl<>(List.of(), expectedPage, 0));

        PageResponse<ProjectResponse> result = service.list(
                new WorkActor(OWNER, true),
                new ProjectListQuery("tasknest", ProjectStatus.ARCHIVED, ProjectRole.OWNER, 0, 50,
                        ProjectListQuery.Sort.NAME_DESC));
        assertEquals(50, result.size());
    }

    @Test
    void getsDetailWithCurrentRoleAndBlocksOutsidersOrRemovedMembers() {
        Project project = mockProject(10L, "TaskNest Core", OWNER, MANAGER, ProjectStatus.ACTIVE);
        when(projects.findById(10L)).thenReturn(Optional.of(project));
        when(memberships.existsByIdAndStatus(new MembershipId(10L, OWNER), MembershipStatus.ACTIVE)).thenReturn(true);
        when(memberships.existsByIdAndStatus(new MembershipId(10L, MANAGER), MembershipStatus.ACTIVE)).thenReturn(true);
        when(memberships.existsByIdAndStatus(new MembershipId(10L, MEMBER), MembershipStatus.ACTIVE)).thenReturn(true);
        when(memberships.existsByIdAndStatus(new MembershipId(10L, OUTSIDER), MembershipStatus.ACTIVE))
                .thenReturn(false);

        assertEquals(ProjectRole.OWNER, service.getDetail(new WorkActor(OWNER, true), 10L).role());
        assertEquals(ProjectRole.MANAGER, service.getDetail(new WorkActor(MANAGER, true), 10L).role());
        assertEquals(ProjectRole.MEMBER, service.getDetail(new WorkActor(MEMBER, true), 10L).role());

        when(project.getManagerUserId()).thenReturn(null);
        assertEquals(ProjectRole.MEMBER, service.getDetail(new WorkActor(MANAGER, true), 10L).role());

        WorkException outsiderEx = assertThrows(
                WorkException.class,
                () -> service.getDetail(new WorkActor(OUTSIDER, true), 10L));
        assertEquals("PROJECT_NOT_FOUND", outsiderEx.code());
        assertEquals(404, outsiderEx.status().value());

        when(memberships.existsByIdAndStatus(new MembershipId(10L, MEMBER), MembershipStatus.ACTIVE)).thenReturn(false);
        WorkException removedEx = assertThrows(
                WorkException.class,
                () -> service.getDetail(new WorkActor(MEMBER, true), 10L));
        assertEquals("PROJECT_NOT_FOUND", removedEx.code());
        assertEquals(404, removedEx.status().value());
    }

    @Test
    void rejectsPageOffsetOverflow() {
        WorkException ex = assertThrows(
                WorkException.class,
                () -> service.list(new WorkActor(MEMBER, true),
                        new ProjectListQuery("", null, null, Integer.MAX_VALUE, 50, ProjectListQuery.Sort.UPDATED_DESC)));
        assertEquals("INVALID_PAGE", ex.code());
        assertEquals(400, ex.status().value());
        verifyNoInteractions(projects, memberships);
    }

    @Test
    void rejectsUnverifiedOrUnauthenticatedUsersFromListingOrViewingDetail() {
        assertEquals("UNAUTHENTICATED", assertThrows(
                WorkException.class,
                () -> service.list(null, new ProjectListQuery(null, null, null, null, null, null))).code());
        assertEquals("EMAIL_NOT_VERIFIED", assertThrows(
                WorkException.class,
                () -> service.list(new WorkActor(MEMBER, false),
                        new ProjectListQuery(null, null, null, null, null, null)))
                .code());
        assertEquals("EMAIL_NOT_VERIFIED", assertThrows(
                WorkException.class,
                () -> service.getDetail(new WorkActor(MEMBER, false), 10L)).code());
        verifyNoInteractions(projects, memberships);
    }
}

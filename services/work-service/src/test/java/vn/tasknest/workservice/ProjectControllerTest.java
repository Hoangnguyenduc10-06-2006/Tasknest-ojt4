package vn.tasknest.workservice;

import java.time.*;
import java.util.List;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import vn.tasknest.workservice.api.*;
import vn.tasknest.workservice.api.project.*;
import vn.tasknest.workservice.application.*;
import vn.tasknest.workservice.application.project.CreateProjectService;
import vn.tasknest.workservice.application.project.ProjectQueryService;
import vn.tasknest.workservice.application.project.ReadProjectService;
import vn.tasknest.workservice.application.project.UpdateProjectService;
import vn.tasknest.workservice.application.security.*;
import vn.tasknest.workservice.config.SecurityConfiguration;
import vn.tasknest.workservice.domain.project.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = ProjectController.class, properties = {"spring.config.import=", "spring.cloud.config.enabled=false"})
@Import({SecurityConfiguration.class, WorkExceptionHandler.class})
class ProjectControllerTest {
    static final String USER = "00000000-0000-4000-8000-000000000001";
    static final String OUTSIDER = "00000000-0000-4000-8000-000000000099";
    static final String BODY = "{\"name\":\"  TaskNest  \",\"description\":\"  Mô tả dự án TaskNest  \",\"startsOn\":\"2026-10-19\",\"endsOn\":\"2026-11-15\"}";

    @Autowired MockMvc mvc;
    @MockitoBean IdentitySessionVerifier verifier;
    @MockitoBean CreateProjectService creation;
    @MockitoBean UpdateProjectService updating;
    @MockitoBean vn.tasknest.workservice.application.project.ArchiveProjectService archiving;
    @MockitoBean ProjectQueryService queries;
    @MockitoBean ReadProjectService reading;

    @BeforeEach void session() { when(verifier.verify("test-token")).thenReturn(new WorkActor(USER, true)); }

    @Test void createsWithSessionPrincipalAndTrimmedInputWithoutCsrfCookie() throws Exception {
        when(creation.create(any(), any())).thenReturn(new ProjectResponse(7L,"TaskNest","Mô tả dự án TaskNest",USER,null,
            ProjectStatus.ACTIVE,ProjectRole.OWNER,LocalDate.of(2026,10,19),LocalDate.of(2026,11,15),false,0L,Instant.EPOCH,Instant.EPOCH));
        mvc.perform(post("/api/work/projects").header("Authorization","Bearer test-token").contentType("application/json").content(BODY))
            .andExpect(status().isCreated()).andExpect(header().string("Location","/api/work/projects/7"))
            .andExpect(jsonPath("$.data.role").value("OWNER"));
        verify(creation).create(eq(new WorkActor(USER,true)),argThat(input -> input.name().equals("TaskNest") && input.description().equals("Mô tả dự án TaskNest")));
    }

    @Test void ignoresForgedOwnerAndRoleFields() throws Exception {
        when(creation.create(any(), any())).thenReturn(new ProjectResponse(7L,"TaskNest","Mô tả dự án TaskNest",USER,null,
            ProjectStatus.ACTIVE,ProjectRole.OWNER,LocalDate.of(2026,10,19),LocalDate.of(2026,11,15),false,0L,Instant.EPOCH,Instant.EPOCH));
        mvc.perform(post("/api/work/projects").header("Authorization","Bearer test-token").contentType("application/json")
            .content(BODY.replace("{", "{\"ownerUserId\":\"someone-else\",\"role\":\"OWNER\",")))
            .andExpect(status().isCreated());
        verify(creation).create(eq(new WorkActor(USER,true)),any());
    }

    @Test void rejectsForgedHeadersAndCookieOnlyRequest() throws Exception {
        mvc.perform(post("/api/work/projects").header("X-User-Id",USER).header("X-Role","OWNER")
            .cookie(new jakarta.servlet.http.Cookie("accessToken","test-token")).contentType("application/json").content(BODY))
            .andExpect(status().isUnauthorized());
        verifyNoInteractions(verifier,creation);
    }

    @Test void rejectsUnverifiedEmail() throws Exception {
        when(verifier.verify(anyString())).thenReturn(new WorkActor(USER,false));
        mvc.perform(post("/api/work/projects").header("Authorization","Bearer test-token").contentType("application/json").content(BODY))
            .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("EMAIL_NOT_VERIFIED"));
        verifyNoInteractions(creation);
    }

    @Test void rejectsRevokedSession() throws Exception {
        when(verifier.verify(anyString())).thenThrow(new WorkException(org.springframework.http.HttpStatus.UNAUTHORIZED,"INVALID_SESSION","Phiên đã thu hồi."));
        mvc.perform(post("/api/work/projects").header("Authorization","Bearer test-token").contentType("application/json").content(BODY))
            .andExpect(status().isUnauthorized());
        verifyNoInteractions(creation);
    }

    @Test void failsClosedWhenIdentityUnavailable() throws Exception {
        when(verifier.verify(anyString())).thenThrow(new WorkException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE,"IDENTITY_UNAVAILABLE","Không thể kiểm tra phiên."));
        mvc.perform(post("/api/work/projects").header("Authorization","Bearer test-token").contentType("application/json").content(BODY))
            .andExpect(status().isServiceUnavailable());
        verifyNoInteractions(creation);
    }

    @Test void rejectsInvalidDateRange() throws Exception {
        mvc.perform(post("/api/work/projects").header("Authorization","Bearer test-token").contentType("application/json").content(BODY.replace("2026-11-15","2026-10-18")))
            .andExpect(status().isBadRequest());
        verifyNoInteractions(creation);
    }

    @Test void rejectsBlankNameAfterTrimming() throws Exception {
        mvc.perform(post("/api/work/projects").header("Authorization","Bearer test-token").contentType("application/json").content(BODY.replace("TaskNest  ","  ")))
            .andExpect(status().isBadRequest());
        verifyNoInteractions(creation);
    }

    @Test void updatesProjectDetailsForOwnerOrManagerWithNormalizedWhitespace() throws Exception {
        String updateBody = "{\"name\":\"  TaskNest   Portal  \",\"description\":\"  Mô tả dự án cập nhật hợp lệ  \",\"startsOn\":\"2026-10-19\",\"endsOn\":\"2026-11-20\",\"version\":2}";
        when(updating.update(any(), eq(7L), any())).thenReturn(new ProjectResponse(7L,"TaskNest Portal","Mô tả dự án cập nhật hợp lệ",USER,null,
            ProjectStatus.ACTIVE,ProjectRole.MANAGER,LocalDate.of(2026,10,19),LocalDate.of(2026,11,20),false,3L,Instant.EPOCH,Instant.EPOCH));
        mvc.perform(put("/api/work/projects/7").header("Authorization","Bearer test-token").contentType("application/json").content(updateBody))
            .andExpect(status().isOk()).andExpect(jsonPath("$.code").value("PROJECT_UPDATED"))
            .andExpect(jsonPath("$.data.name").value("TaskNest Portal"))
            .andExpect(jsonPath("$.data.role").value("MANAGER"));
        verify(updating).update(eq(new WorkActor(USER,true)),eq(7L),argThat(input ->
            input.name().equals("TaskNest Portal") && input.description().equals("Mô tả dự án cập nhật hợp lệ") && input.version().equals(2L)));
    }

    @Test void rejectsUpdateWhenMemberOrInvalidDateRange() throws Exception {
        String invalidDates = "{\"name\":\"TaskNest Portal\",\"description\":\"Mô tả dự án cập nhật hợp lệ\",\"startsOn\":\"2026-11-20\",\"endsOn\":\"2026-10-19\",\"version\":1}";
        mvc.perform(put("/api/work/projects/7").header("Authorization","Bearer test-token").contentType("application/json").content(invalidDates))
            .andExpect(status().isBadRequest());
        verifyNoInteractions(updating);
    }
    @Test void rejectsUpdateWhenProjectIsArchived() throws Exception {
        String validBody = "{\"name\":\"TaskNest Portal\",\"description\":\"Mô tả dự án cập nhật hợp lệ\",\"startsOn\":\"2026-10-19\",\"endsOn\":\"2026-11-20\",\"version\":1}";
        when(updating.update(any(), eq(7L), any())).thenThrow(new WorkException(
            org.springframework.http.HttpStatus.CONFLICT, "PROJECT_ARCHIVED", "Dự án đã lưu trữ chỉ được xem lại."));
        mvc.perform(put("/api/work/projects/7").header("Authorization","Bearer test-token")
            .contentType("application/json").content(validBody))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("PROJECT_ARCHIVED"))
            .andExpect(jsonPath("$.message").value("Dự án đã lưu trữ chỉ được xem lại."));
    }

    @Test void readsCompleteProjectIndexThroughDedicatedService() throws Exception {
        when(reading.list(new WorkActor(USER,true))).thenReturn(List.of());
        mvc.perform(get("/api/work/projects/index").header("Authorization","Bearer test-token"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data").isArray());
        verify(reading).list(new WorkActor(USER,true));
        verifyNoInteractions(queries);
    }
    @Test void archivesAndReopensProjectWithVersionCheckForOwner() throws Exception {
        when(archiving.archive(any(), eq(7L), any())).thenReturn(new ProjectResponse(7L,"TaskNest","Mô tả dự án TaskNest",USER,null,
            ProjectStatus.ARCHIVED,ProjectRole.OWNER,LocalDate.of(2026,10,19),LocalDate.of(2026,11,15),false,2L,Instant.EPOCH,Instant.EPOCH));
        mvc.perform(post("/api/work/projects/7/archive").header("Authorization","Bearer test-token")
            .contentType("application/json").content("{\"version\":1}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.code").value("PROJECT_ARCHIVED"))
            .andExpect(jsonPath("$.data.status").value("ARCHIVED"))
            .andExpect(jsonPath("$.data.version").value(2));
        verify(archiving).archive(eq(new WorkActor(USER,true)), eq(7L), eq(new ProjectStatusChangeRequest(1L)));

        when(archiving.reopen(any(), eq(7L), any())).thenReturn(new ProjectResponse(7L,"TaskNest","Mô tả dự án TaskNest",USER,null,
            ProjectStatus.ACTIVE,ProjectRole.OWNER,LocalDate.of(2026,10,19),LocalDate.of(2026,11,15),false,3L,Instant.EPOCH,Instant.EPOCH));
        mvc.perform(post("/api/work/projects/7/reopen").header("Authorization","Bearer test-token")
            .contentType("application/json").content("{\"version\":2}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.code").value("PROJECT_REOPENED"))
            .andExpect(jsonPath("$.data.status").value("ACTIVE"))
            .andExpect(jsonPath("$.data.version").value(3));
        verify(archiving).reopen(eq(new WorkActor(USER,true)), eq(7L), eq(new ProjectStatusChangeRequest(2L)));
    }
    @Test void rejectsArchiveWhenProjectHasRunningTimerOrMissingVersion() throws Exception {
        mvc.perform(post("/api/work/projects/7/archive").header("Authorization","Bearer test-token")
            .contentType("application/json").content("{}"))
            .andExpect(status().isBadRequest());
        verifyNoInteractions(archiving);

        when(archiving.archive(any(), eq(7L), any())).thenThrow(new WorkException(
            org.springframework.http.HttpStatus.CONFLICT, "PROJECT_HAS_RUNNING_TIMER",
            "Không thể lưu trữ dự án khi vẫn còn phiên ghi giờ đang chạy. Vui lòng dừng tất cả phiên ghi giờ trước."));
        mvc.perform(post("/api/work/projects/7/archive").header("Authorization","Bearer test-token")
            .contentType("application/json").content("{\"version\":1}"))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("PROJECT_HAS_RUNNING_TIMER"));
    }

    @Test void listsParticipatingProjectsWithDefaultsAndPagination20() throws Exception {
        ProjectResponse item = new ProjectResponse(7L, "TaskNest", "Mô tả dự án TaskNest", USER, null,
            ProjectStatus.ACTIVE, ProjectRole.OWNER, LocalDate.of(2026, 10, 19), LocalDate.of(2026, 11, 15), false, 0L, Instant.EPOCH, Instant.EPOCH);
        when(queries.list(eq(new WorkActor(USER, true)), any())).thenReturn(new PageResponse<>(List.of(item), 0, 20, 1L, 1));
        mvc.perform(get("/api/work/projects").header("Authorization", "Bearer test-token"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.message").value("Lấy danh sách dự án thành công."))
            .andExpect(jsonPath("$.httpStatus").value("200 OK"))
            .andExpect(jsonPath("$.errors").doesNotExist())
            .andExpect(jsonPath("$.data.page").value(0))
            .andExpect(jsonPath("$.data.size").value(20))
            .andExpect(jsonPath("$.data.totalElements").value(1))
            .andExpect(jsonPath("$.data.content[0].id").value(7))
            .andExpect(jsonPath("$.data.content[0].role").value("OWNER"));
        verify(queries).list(eq(new WorkActor(USER, true)), eq(new ProjectListQuery("", null, null, 0, 20, ProjectListQuery.Sort.UPDATED_DESC)));
    }

    @Test void listsWithStatusRoleSearchAndAllowedPageSizes10_20_50() throws Exception {
        when(queries.list(any(), any())).thenReturn(new PageResponse<>(List.of(), 1, 50, 0L, 0));
        mvc.perform(get("/api/work/projects")
                .header("Authorization", "Bearer test-token")
                .param("q", "  TaskNest  ")
                .param("status", "ARCHIVED")
                .param("role", "MANAGER")
                .param("page", "1")
                .param("size", "50")
                .param("sort", "NAME_ASC"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.httpStatus").value("200 OK"));
        verify(queries).list(eq(new WorkActor(USER, true)),
            eq(new ProjectListQuery("TaskNest", ProjectStatus.ARCHIVED, ProjectRole.MANAGER, 1, 50, ProjectListQuery.Sort.NAME_ASC)));
    }

    @Test void rejectsInvalidPageSizeNegativePageAndExcessiveOffset() throws Exception {
        mvc.perform(get("/api/work/projects").header("Authorization", "Bearer test-token").param("size", "15"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.httpStatus").value("400 BAD_REQUEST"))
            .andExpect(jsonPath("$.errors.size").value("Kích thước trang phải là 10, 20 hoặc 50."));
        mvc.perform(get("/api/work/projects").header("Authorization", "Bearer test-token").param("page", "-1"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.httpStatus").value("400 BAD_REQUEST"));
        mvc.perform(get("/api/work/projects").header("Authorization", "Bearer test-token")
                .param("page", "2147483647").param("size", "50"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.httpStatus").value("400 BAD_REQUEST"))
            .andExpect(jsonPath("$.errors.page").value("Chỉ số trang và kích thước vượt quá giới hạn cho phép."));
        mvc.perform(get("/api/work/projects").header("Authorization", "Bearer test-token").param("status", "INVALID_STATUS"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.httpStatus").value("400 BAD_REQUEST"));
        verifyNoInteractions(queries);
    }

    @Test void getsProjectDetailWithCurrentRole() throws Exception {
        ProjectResponse detail = new ProjectResponse(7L, "TaskNest", "Mô tả dự án TaskNest", USER, OUTSIDER,
            ProjectStatus.ACTIVE, ProjectRole.MANAGER, LocalDate.of(2026, 10, 19), LocalDate.of(2026, 11, 15), false, 2L, Instant.EPOCH, Instant.EPOCH);
        when(queries.getDetail(new WorkActor(USER, true), 7L)).thenReturn(detail);
        mvc.perform(get("/api/work/projects/7").header("Authorization", "Bearer test-token"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.message").value("Lấy thông tin dự án thành công."))
            .andExpect(jsonPath("$.httpStatus").value("200 OK"))
            .andExpect(jsonPath("$.errors").doesNotExist())
            .andExpect(jsonPath("$.data.id").value(7))
            .andExpect(jsonPath("$.data.role").value("MANAGER"));
    }

    @Test void outsiderCannotViewProjectDetail() throws Exception {
        when(verifier.verify("outsider-token")).thenReturn(new WorkActor(OUTSIDER, true));
        when(queries.getDetail(new WorkActor(OUTSIDER, true), 7L))
            .thenThrow(new WorkException(HttpStatus.NOT_FOUND, "PROJECT_NOT_FOUND", "Không tìm thấy dự án hoặc không có quyền truy cập."));
        mvc.perform(get("/api/work/projects/7").header("Authorization", "Bearer outsider-token"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.message").value("Không tìm thấy dự án hoặc không có quyền truy cập."))
            .andExpect(jsonPath("$.httpStatus").value("404 NOT_FOUND"))
            .andExpect(jsonPath("$.data").doesNotExist());
    }

    @Test void rejectsUnauthenticatedAndUnverifiedReadRequests() throws Exception {
        mvc.perform(get("/api/work/projects").header("X-User-Id", USER).header("X-Role", "OWNER"))
            .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/work/projects/7").header("X-User-Id", USER).header("X-Role", "OWNER"))
            .andExpect(status().isUnauthorized());

        when(verifier.verify("unverified-token")).thenReturn(new WorkActor(USER, false));
        mvc.perform(get("/api/work/projects").header("Authorization", "Bearer unverified-token"))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("EMAIL_NOT_VERIFIED"));
        mvc.perform(get("/api/work/projects/7").header("Authorization", "Bearer unverified-token"))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("EMAIL_NOT_VERIFIED"));
        verifyNoInteractions(queries);
    }

    @Test void rejectsNonNumericProjectIdPathVariable() throws Exception {
        mvc.perform(get("/api/work/projects/not-a-number").header("Authorization", "Bearer test-token"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
        verifyNoInteractions(queries);
    }
    @Test void databaseContentionReturnsConflictWithoutLeakingDetailsOrReportingLogout() throws Exception {
        when(creation.create(any(), any())).thenThrow(new org.springframework.dao.CannotAcquireLockException("private SQL details"));
        mvc.perform(post("/api/work/projects").header("Authorization","Bearer test-token").contentType("application/json").content(BODY))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("WRITE_CONFLICT"))
            .andExpect(jsonPath("$.message").value("Dữ liệu đang được cập nhật ở nơi khác. Vui lòng tải lại rồi thử lại thao tác."));
    }
}

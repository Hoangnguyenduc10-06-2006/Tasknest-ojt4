package vn.tasknest.workservice;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import vn.tasknest.workservice.api.WorkExceptionHandler;
import vn.tasknest.workservice.api.project.ProjectMembersController;
import vn.tasknest.workservice.application.members.ProjectMembersService;
import vn.tasknest.workservice.application.security.IdentitySessionVerifier;
import vn.tasknest.workservice.application.security.WorkActor;
import vn.tasknest.workservice.config.SecurityConfiguration;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers=ProjectMembersController.class, properties={"spring.config.import=", "spring.cloud.config.enabled=false"})
@Import({SecurityConfiguration.class, WorkExceptionHandler.class})
class ProjectMembersControllerTest {
    @Autowired MockMvc mvc;
    @MockitoBean IdentitySessionVerifier verifier;
    @MockitoBean ProjectMembersService members;
    final WorkActor actor=new WorkActor("00000000-0000-4000-8000-000000000001",true);
    @BeforeEach void setup() { when(verifier.verify("test-token")).thenReturn(actor); }
    @Test void normalizedEmailCannotOverrideMemberRole() throws Exception {
        when(members.invite(actor,1L,"member@example.com")).thenReturn(7L);
        mvc.perform(post("/api/work/projects/1/invitations").header("Authorization","Bearer test-token")
            .contentType("application/json").content("{\"email\":\" Member@Example.com \",\"role\":\"OWNER\"}"))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.data").value(7));
        verify(members).invite(actor,1L,"member@example.com");
    }
    @Test void invalidEmailDoesNotReachService() throws Exception {
        mvc.perform(post("/api/work/projects/1/invitations").header("Authorization","Bearer test-token")
            .contentType("application/json").content("{\"email\":\"invalid\"}"))
            .andExpect(status().isBadRequest());
        verifyNoInteractions(members);
    }
    @Test void forgedHeadersCannotReadMembers() throws Exception {
        mvc.perform(get("/api/work/projects/1/members").header("X-User-Id",actor.userId()).header("X-Role","OWNER"))
            .andExpect(status().isUnauthorized());
        verifyNoInteractions(members);
    }
    @Test void cannotPromoteOwnerThroughMemberRoleEndpoint() throws Exception {
        mvc.perform(put("/api/work/projects/1/members/other/role").header("Authorization","Bearer test-token")
            .contentType("application/json").content("{\"role\":\"Owner\"}"))
            .andExpect(status().isBadRequest());
        verifyNoInteractions(members);
    }
}

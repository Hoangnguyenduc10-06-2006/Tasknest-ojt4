package vn.tasknest.workservice;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import vn.tasknest.workservice.api.WorkExceptionHandler;
import vn.tasknest.workservice.api.community.TeamWorkspaceController;
import vn.tasknest.workservice.application.community.TeamWorkspaceService;
import vn.tasknest.workservice.application.security.*;
import vn.tasknest.workservice.config.SecurityConfiguration;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
@WebMvcTest(controllers=TeamWorkspaceController.class, properties={"spring.config.import=","spring.cloud.config.enabled=false"})
@Import({SecurityConfiguration.class,WorkExceptionHandler.class})
class TeamWorkspaceControllerTest {
    @Autowired MockMvc mvc;
    @MockitoBean TeamWorkspaceService teams;
    @MockitoBean IdentitySessionVerifier sessions;
    @MockitoBean WorkRequestBudget budget;
    final String id="00000000-0000-4000-8000-000000000001";
    @BeforeEach void setup(){when(sessions.verify("valid")).thenReturn(new WorkActor(id,true));when(budget.consume(anyString(),anyString(),anyInt())).thenReturn(true);}
    @Test void privateTeamDirectoryAndProjectsRequireSession() throws Exception {
        for(String path:List.of("people?search=An","invitations","projects"))mvc.perform(get("/api/work/community/teams/1/"+path)).andExpect(status().isUnauthorized());
        verifyNoInteractions(teams);
    }
    @Test void assignmentRejectsFreeTextAndEmptySelection() throws Exception {
        for(String body:List.of("{\"userIds\":[]}","{\"userIds\":[\"fake\"]}"))mvc.perform(post("/api/work/community/teams/1/projects/2/members").header("Authorization","Bearer valid").contentType("application/json").content(body)).andExpect(status().isBadRequest());
        verifyNoInteractions(teams);
    }
    @Test void inviteUsesSelectedAccountInsteadOfClientSuppliedName() throws Exception {
        mvc.perform(post("/api/work/community/teams/1/invitations/by-user").header("Authorization","Bearer valid").contentType("application/json").content("{\"userId\":\""+id+"\",\"name\":\"Fake\"}")).andExpect(status().isOk());
        verify(teams).invite(new WorkActor(id,true),1,id);
    }
    @Test void unverifiedAccountCannotSearchDirectory() throws Exception {
        when(sessions.verify("unverified")).thenReturn(new WorkActor(id,false));
        mvc.perform(get("/api/work/community/teams/1/people?search=An").header("Authorization","Bearer unverified")).andExpect(status().isForbidden());verifyNoInteractions(teams);
    }
}

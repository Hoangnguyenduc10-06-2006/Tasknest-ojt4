package vn.tasknest.workservice;

import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import vn.tasknest.workservice.api.WorkExceptionHandler;
import vn.tasknest.workservice.api.community.CommunityController;
import vn.tasknest.workservice.application.community.CommunityService;
import vn.tasknest.workservice.application.security.*;
import vn.tasknest.workservice.config.SecurityConfiguration;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers=CommunityController.class, properties={"spring.config.import=","spring.cloud.config.enabled=false"})
@Import({SecurityConfiguration.class, WorkExceptionHandler.class})
class CommunityControllerTest {
    private static final WorkActor CUSTOMER = new WorkActor("00000000-0000-4000-8000-000000000002", true);
    @Autowired MockMvc mvc;
    @MockitoBean CommunityService community;
    @MockitoBean IdentitySessionVerifier sessions;
    @MockitoBean WorkRequestBudget budget;
    @BeforeEach void setup() {
        when(sessions.verify("valid")).thenReturn(CUSTOMER);
        when(budget.consume(anyString(),eq("COMMUNITY"),eq(30))).thenReturn(true);
    }
    @Test void publicProfilesWorkWithoutSession() throws Exception {
        when(community.team(1,null,0)).thenReturn(Map.of("name","Đội phát triển"));
        mvc.perform(get("/api/work/community/teams/1")).andExpect(status().isOk())
            .andExpect(jsonPath("$.data.name").value("Đội phát triển"));
        verifyNoInteractions(sessions);
    }
    @Test void forgedIdentityCannotLikeOrInspectInvitations() throws Exception {
        mvc.perform(put("/api/work/community/likes/TEAM/1").header("X-User-Id",CUSTOMER.userId())
            .contentType("application/json").content("{\"value\":true}")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/work/community/me")).andExpect(status().isUnauthorized());
        verifyNoInteractions(community,budget);
    }
    @Test void likesUseVerifiedSessionAndRequireExplicitState() throws Exception {
        mvc.perform(put("/api/work/community/likes/TEAM/1").header("Authorization","Bearer valid")
            .contentType("application/json").content("{\"value\":true,\"userId\":\"someone-else\"}"))
            .andExpect(status().isOk());
        verify(community).like(CUSTOMER,"TEAM","1",true);
        mvc.perform(put("/api/work/community/likes/TEAM/1").header("Authorization","Bearer valid")
            .contentType("application/json").content("{}")).andExpect(status().isBadRequest());
    }
    @Test void outOfRangeReviewNeverReachesDatabase() throws Exception {
        mvc.perform(put("/api/work/projects/1/reputation/review").header("Authorization","Bearer valid")
            .contentType("application/json").content("{\"quality\":6,\"schedule\":5,\"communication\":5,\"support\":5,\"comment\":\"Tốt\"}"))
            .andExpect(status().isBadRequest());
        verifyNoInteractions(community);
    }
    @Test void unverifiedAccountCannotCreateTeam() throws Exception {
        when(sessions.verify("unverified")).thenReturn(new WorkActor(CUSTOMER.userId(),false));
        mvc.perform(post("/api/work/community/teams").header("Authorization","Bearer unverified")
            .contentType("application/json").content("{}")).andExpect(status().isForbidden());
        verifyNoInteractions(community);
    }
    @Test void nullStrengthIsInvalidBeforePersistence() throws Exception {
        mvc.perform(put("/api/work/projects/1/reputation/recognitions").header("Authorization","Bearer valid")
            .contentType("application/json").content("{\"userId\":\"" + CUSTOMER.userId() + "\",\"comment\":\"Rất tốt\",\"strengths\":[null]}"))
            .andExpect(status().isBadRequest());
        verifyNoInteractions(community);
    }
}

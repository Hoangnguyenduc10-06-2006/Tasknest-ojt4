package vn.tasknest.identityservice.api;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import vn.tasknest.identityservice.api.controller.OnboardingController;
import vn.tasknest.identityservice.config.SecurityConfiguration;
import vn.tasknest.identityservice.service.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers=OnboardingController.class,properties={"spring.config.import=","spring.cloud.config.enabled=false"})
@Import(SecurityConfiguration.class)
class OnboardingControllerTest {
    @Autowired MockMvc mvc;
    @MockitoBean JwtDecoder decoder;
    @MockitoBean OnboardingService onboarding;
    @MockitoBean ProfileService profiles;
    @MockitoBean AuthRateLimitService limits;
    private static final String BODY="""
        {"purpose":"CLIENT","status":"DEFERRED","step":2,"version":0,"userId":"forged",
         "draft":{"company":"","location":"","goals":"","headline":"","about":"","skills":[],"publishProfile":false,"shareAvatar":false}}
        """;
    @Test void privateSetupRequiresSessionAndRejectsForeignOrigin() throws Exception {
        mvc.perform(get("/api/identity/onboarding")).andExpect(status().isUnauthorized());
        mvc.perform(put("/api/identity/onboarding").header("Origin","https://foreign.example.test").with(jwt()).with(csrf()).contentType("application/json").content(BODY)).andExpect(status().isForbidden());verifyNoInteractions(onboarding);
    }
    @Test void writesOnlyTheAuthenticatedSubjectAndRejectsAuthorizationRoleValues() throws Exception {
        mvc.perform(put("/api/identity/onboarding").header("Origin","http://localhost:3000").with(jwt().jwt(jwt->jwt.subject("current"))).with(csrf()).contentType("application/json").content(BODY)).andExpect(status().isOk());
        verify(onboarding).save(eq("current"),any());
        mvc.perform(put("/api/identity/onboarding").header("Origin","http://localhost:3000").with(jwt()).with(csrf()).contentType("application/json").content(BODY.replace("CLIENT","ADMIN"))).andExpect(status().isBadRequest());
    }
    @Test void publicAvatarDoesNotRequireLoginAndUsesNoStore() throws Exception {
        String id="00000000-0000-4000-8000-000000000001";
        when(profiles.publicAvatar(id)).thenReturn(new byte[]{1,2});
        mvc.perform(get("/api/identity/public/avatars/"+id)).andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store")).andExpect(content().contentType("image/png"));
    }
}

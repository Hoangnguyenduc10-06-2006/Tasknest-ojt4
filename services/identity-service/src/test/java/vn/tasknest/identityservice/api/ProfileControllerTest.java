package vn.tasknest.identityservice.api;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import vn.tasknest.identityservice.api.controller.ProfileController;
import vn.tasknest.identityservice.config.SecurityConfiguration;
import vn.tasknest.identityservice.service.ProfileService;
import vn.tasknest.identityservice.service.AuthRateLimitService;
import vn.tasknest.identityservice.api.dto.user.response.UserResponse;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;

@WebMvcTest(controllers=ProfileController.class,properties={"spring.config.import=","spring.cloud.config.enabled=false"})
@Import(SecurityConfiguration.class)
class ProfileControllerTest {
    @Autowired MockMvc mvc;
    @MockitoBean JwtDecoder decoder;
    @MockitoBean ProfileService profiles;
    @MockitoBean AuthRateLimitService limits;
    private static final String BODY="{\"fullName\":\"New Name\",\"jobTitle\":\"Developer\",\"bio\":\"Hello\",\"version\":0,\"userId\":\"someone-else\",\"email\":\"forged@example.test\"}";
    @Test void requiresAuthenticationAndCsrf() throws Exception {
        mvc.perform(get("/api/identity/profile/avatar")).andExpect(status().isUnauthorized());
        mvc.perform(put("/api/identity/profile").header("Origin","http://localhost:3000").with(csrf()).contentType("application/json").content(BODY)).andExpect(status().isUnauthorized());
        verifyNoInteractions(profiles);
    }
    @Test void ignoresForgedIdentityAndUsesJwtSubject() throws Exception {
        when(profiles.update(eq("current-user"),any())).thenReturn(UserResponse.builder().id("current-user").fullName("New Name").build());
        mvc.perform(put("/api/identity/profile").header("Origin","http://localhost:3000").with(csrf()).with(jwt().jwt(j->j.subject("current-user"))).contentType("application/json").content(BODY))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.id").value("current-user"));
        verify(profiles).update(eq("current-user"),any());
    }
    @Test void rejectsForeignOrigin() throws Exception {
        mvc.perform(put("/api/identity/profile").header("Origin","https://foreign.example.test").with(csrf()).with(jwt()).contentType("application/json").content(BODY)).andExpect(status().isForbidden());
        verifyNoInteractions(profiles);
    }
}

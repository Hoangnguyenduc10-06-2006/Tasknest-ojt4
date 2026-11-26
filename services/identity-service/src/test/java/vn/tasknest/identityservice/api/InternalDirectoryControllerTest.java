package vn.tasknest.identityservice.api;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import vn.tasknest.identityservice.api.controller.InternalDirectoryController;
import vn.tasknest.identityservice.config.SecurityConfiguration;
import vn.tasknest.identityservice.repository.UserRepository;
import vn.tasknest.identityservice.domain.User;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
@WebMvcTest(controllers=InternalDirectoryController.class,properties={"spring.config.import=","spring.cloud.config.enabled=false"})
@Import(SecurityConfiguration.class)
class InternalDirectoryControllerTest {
    @Autowired MockMvc mvc;
    @MockitoBean JwtDecoder decoder;
    @MockitoBean UserRepository users;
    static final String ID="00000000-0000-4000-8000-000000000001";
    @Test void rejectsAnonymousDirectoryEnumeration() throws Exception {
        mvc.perform(get("/internal/identity/profiles").param("ids",ID)).andExpect(status().isUnauthorized());
        verifyNoInteractions(users);
    }
    @Test void returnsDisplayNameWithoutEmailBioOrCredentials() throws Exception {
        User user=new User("Tên thật","private@example.invalid","private-hash"); user.setId(ID); user.setBio("Private bio");
        when(users.findAllById(any())).thenReturn(List.of(user));
        mvc.perform(get("/internal/identity/profiles").param("ids",ID).with(jwt()))
            .andExpect(status().isOk()).andExpect(jsonPath("$[0].fullName").value("Tên thật"))
            .andExpect(jsonPath("$[0].email").doesNotExist()).andExpect(jsonPath("$[0].bio").doesNotExist())
            .andExpect(jsonPath("$[0].passwordHash").doesNotExist());
    }
    @Test void validatesIdsAndLimitsBatchSize() throws Exception {
        mvc.perform(get("/internal/identity/profiles").param("ids","invalid").with(jwt())).andExpect(status().isBadRequest());
        mvc.perform(get("/internal/identity/profiles").param("ids",String.join(",",java.util.Collections.nCopies(101,ID))).with(jwt())).andExpect(status().isBadRequest());
        verifyNoInteractions(users);
    }
    @Test void candidateLookupIsBoundedAndReturnsNoEmailOrCredentials() throws Exception {
        User user=new User("Tên thật","private@example.invalid","secret");user.setId(ID);user.setEmailVerified(true);
        when(users.findInvitationCandidates(eq("Tên"),any())).thenReturn(List.of(user));
        mvc.perform(get("/internal/identity/invitation-users").param("search","Tên").with(jwt()))
            .andExpect(status().isOk()).andExpect(jsonPath("$[0].id").value(ID)).andExpect(jsonPath("$[0].fullName").value("Tên thật"))
            .andExpect(jsonPath("$[0].email").doesNotExist()).andExpect(jsonPath("$[0].passwordHash").doesNotExist());
        mvc.perform(get("/internal/identity/invitation-users").param("search","a").with(jwt())).andExpect(status().isBadRequest());
        mvc.perform(get("/internal/identity/invitation-users").param("search","Tên")).andExpect(status().isUnauthorized());
    }
    @Test void selectedUserMustStillHaveVerifiedAccount() throws Exception {
        User user=new User("Tên thật","private@example.invalid","secret");user.setId(ID);
        when(users.findById(ID)).thenReturn(java.util.Optional.of(user));
        mvc.perform(get("/internal/identity/invitation-users/"+ID).with(jwt())).andExpect(status().isNotFound());
        user.setEmailVerified(true);
        mvc.perform(get("/internal/identity/invitation-users/"+ID).with(jwt())).andExpect(status().isOk()).andExpect(jsonPath("$.email").doesNotExist());
    }
}

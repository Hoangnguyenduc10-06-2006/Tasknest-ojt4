package vn.tasknest.notificationservice;
import vn.tasknest.notificationservice.api.StatusController;
import vn.tasknest.notificationservice.config.SecurityConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
@WebMvcTest(controllers = StatusController.class, properties = {
    "spring.config.import=", "spring.cloud.config.enabled=false", "spring.security.user.password=test-only-unused-password"
})
@Import(SecurityConfiguration.class)
class StatusSecurityTest {
    @Autowired MockMvc mvc;
    @Test void exposesOnlyScaffoldStatus() throws Exception {
        mvc.perform(get("/api/notifications/status"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.service").value("notification-service"))
            .andExpect(jsonPath("$.stage").value("scaffold"));
    }
    @Test void rejectsUnimplementedBusinessEndpoints() throws Exception {
        mvc.perform(get("/api/notifications/private")).andExpect(status().isUnauthorized());
    }
    @Test void rejectsWritesWithoutCsrf() throws Exception {
        mvc.perform(post("/api/notifications/private")).andExpect(status().isForbidden());
    }
}

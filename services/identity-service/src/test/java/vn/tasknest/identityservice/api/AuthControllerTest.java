package vn.tasknest.identityservice.api;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import jakarta.servlet.http.Cookie;
import java.time.Instant;
import java.time.ZonedDateTime;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import vn.tasknest.identityservice.api.controller.AuthController;
import vn.tasknest.identityservice.api.dto.auth.request.LoginRequest;
import vn.tasknest.identityservice.api.dto.auth.request.RegisterRequest;
import vn.tasknest.identityservice.api.dto.auth.response.VerifyEmailResponse;
import vn.tasknest.identityservice.api.dto.user.response.UserResponse;
import vn.tasknest.identityservice.config.IdentityProperties;
import vn.tasknest.identityservice.config.RsaKeyConfiguration;
import vn.tasknest.identityservice.config.SecurityConfiguration;
import vn.tasknest.identityservice.exception.CooldownException;
import vn.tasknest.identityservice.exception.DuplicateEmailException;
import vn.tasknest.identityservice.exception.GlobalExceptionHandler;
import vn.tasknest.identityservice.exception.InvalidCredentialsException;
import vn.tasknest.identityservice.exception.InvalidRefreshTokenException;
import vn.tasknest.identityservice.exception.RateLimitExceededException;
import vn.tasknest.identityservice.exception.TokenExpiredException;
import vn.tasknest.identityservice.exception.TokenNotFoundException;
import vn.tasknest.identityservice.exception.ValidationException;
import vn.tasknest.identityservice.service.AccountService;
import vn.tasknest.identityservice.service.AuthResult;
import vn.tasknest.identityservice.service.AuthService;
import vn.tasknest.identityservice.service.AuthSessionService;

@WebMvcTest(controllers = {AuthController.class, GlobalExceptionHandler.class}, properties = {
    "spring.config.import=", "spring.cloud.config.enabled=false", "spring.security.user.password=test-only-unused-password"
})
@Import({vn.tasknest.identityservice.security.ClientAddress.class, SecurityConfiguration.class, RsaKeyConfiguration.class, vn.tasknest.identityservice.config.TimeConfiguration.class})
class AuthControllerTest {
    @org.springframework.test.context.DynamicPropertySource
    static void keys(org.springframework.test.context.DynamicPropertyRegistry registry) {
        registry.add("tasknest.identity.jwt.private-key-base64", () -> vn.tasknest.identityservice.support.TestKeys.PRIVATE_KEY);
    }


    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private AccountService accountService;

    @MockitoBean
    private AuthService authService;

    @MockitoBean
    private AuthSessionService authSessionService;

    @MockitoBean
    private vn.tasknest.identityservice.service.AuthRateLimitService rateLimits;

    @Test
    void session_requiresValidAuthentication() throws Exception {
        mvc.perform(get("/api/identity/auth/session")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/identity/auth/session").header("Authorization", "Bearer invalid"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void session_returnsOnlyCurrentAuthenticatedUser() throws Exception {
        when(authService.currentUser("00000000-0000-4000-8000-000000000007")).thenReturn(UserResponse.builder().id("00000000-0000-4000-8000-000000000007").fullName("Current User")
            .email("current@example.com").emailVerified(true).build());
        mvc.perform(get("/api/identity/auth/session")
            .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt()
                .jwt(jwt -> jwt.subject("00000000-0000-4000-8000-000000000007"))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.id").value("00000000-0000-4000-8000-000000000007"))
            .andExpect(jsonPath("$.data.passwordHash").doesNotExist());
        verify(authService).currentUser("00000000-0000-4000-8000-000000000007");
    }

    @Test
    void register_success_returns201AndUserResponseWithoutPassword() throws Exception {
        UserResponse response = UserResponse.builder()
            .id("00000000-0000-4000-8000-000000000001")
            .fullName("Nguyen Van A")
            .email("user@example.com")
            .emailVerified(false)
            .createdAt(Instant.parse("2026-10-26T00:00:00Z"))
            .build();
        when(accountService.register(any(RegisterRequest.class))).thenReturn(response);

        String json = """
            {
                "fullName": "Nguyen Van A",
                "email": "user@example.com",
                "password": "password123",
                "confirmPassword": "password123"
            }
            """;

        mvc.perform(post("/api/identity/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.message").value("Đăng ký thành công"))
            .andExpect(jsonPath("$.data.id").value("00000000-0000-4000-8000-000000000001"))
            .andExpect(jsonPath("$.data.fullName").value("Nguyen Van A"))
            .andExpect(jsonPath("$.data.email").value("user@example.com"))
            .andExpect(jsonPath("$.data.emailVerified").value(false))
            .andExpect(jsonPath("$.data.password").doesNotExist())
            .andExpect(jsonPath("$.data.passwordHash").doesNotExist());
    }

    @Test
    void register_validationFailure_returns400() throws Exception {
        when(accountService.register(any(RegisterRequest.class)))
            .thenThrow(new ValidationException("Họ tên phải có độ dài từ 2 đến 100 ký tự"));

        String json = """
            {
                "fullName": "A",
                "email": "user@example.com",
                "password": "password123",
                "confirmPassword": "password123"
            }
            """;

        mvc.perform(post("/api/identity/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.message").value("Họ tên phải có độ dài từ 2 đến 100 ký tự"));
    }

    @Test
    void register_duplicateEmail_returns409() throws Exception {
        when(accountService.register(any(RegisterRequest.class)))
            .thenThrow(new DuplicateEmailException("Email đã tồn tại trong hệ thống"));

        String json = """
            {
                "fullName": "Nguyen Van A",
                "email": "existing@example.com",
                "password": "password123",
                "confirmPassword": "password123"
            }
            """;

        mvc.perform(post("/api/identity/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.message").value("Email đã tồn tại trong hệ thống"));
    }

    @Test
    void verifyEmail_success_returns200() throws Exception {
        VerifyEmailResponse verifyResponse = VerifyEmailResponse.builder()
            .email("user@example.com")
            .verified(true)
            .message("Xác nhận email thành công")
            .verifiedAt(ZonedDateTime.now())
            .build();
        when(accountService.verifyEmail("valid-token")).thenReturn(verifyResponse);

        mvc.perform(get("/api/identity/auth/verify-email").param("token", "valid-token"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.message").value("Xác nhận email thành công"))
            .andExpect(jsonPath("$.data.verified").value(true))
            .andExpect(jsonPath("$.data.email").value("user@example.com"));
    }

    @Test
    void verifyEmail_tokenNotFound_returns404() throws Exception {
        when(accountService.verifyEmail("unknown-token"))
            .thenThrow(new TokenNotFoundException("Token xác thực không tồn tại hoặc không hợp lệ"));

        mvc.perform(get("/api/identity/auth/verify-email").param("token", "unknown-token"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.message").value("Token xác thực không tồn tại hoặc không hợp lệ"));
    }

    @Test
    void verifyEmail_tokenExpired_returns400() throws Exception {
        when(accountService.verifyEmail("expired-token"))
            .thenThrow(new TokenExpiredException("Token xác thực đã hết hạn"));

        mvc.perform(get("/api/identity/auth/verify-email").param("token", "expired-token"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.message").value("Token xác thực đã hết hạn"));
    }

    @Test
    void resendVerification_success_returns200() throws Exception {
        doNothing().when(accountService).resendVerificationEmail("user@example.com");

        String json = """
            {
                "email": "user@example.com"
            }
            """;

        mvc.perform(post("/api/identity/auth/resend-verification")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.message").value("Gửi lại email xác nhận thành công"));
    }

    @Test
    void resendVerification_cooldownActive_returns429() throws Exception {
        doThrow(new CooldownException("Vui lòng đợi thêm 45 giây trước khi yêu cầu gửi lại email", 45))
            .when(accountService).resendVerificationEmail("user@example.com");

        String json = """
            {
                "email": "user@example.com"
            }
            """;

        mvc.perform(post("/api/identity/auth/resend-verification")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json))
            .andExpect(status().isTooManyRequests())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.data.remainingSeconds").value(45));
    }

    @Test
    void resendVerification_rateLimitExceeded_returns429() throws Exception {
        doThrow(new RateLimitExceededException("Bạn đã vượt quá số lần gửi lại email xác thực (tối đa 5 lần/giờ). Vui lòng thử lại sau."))
            .when(accountService).resendVerificationEmail("user@example.com");

        String json = """
            {
                "email": "user@example.com"
            }
            """;

        mvc.perform(post("/api/identity/auth/resend-verification")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json))
            .andExpect(status().isTooManyRequests())
            .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    void login_success_setsHttpOnlyCookieAndNoRefreshTokenInBody() throws Exception {
        UserResponse userResp = UserResponse.builder()
            .id("00000000-0000-4000-8000-000000000001")
            .fullName("Nguyen Van A")
            .email("user@example.com")
            .emailVerified(true)
            .build();
        Instant sessionExp = Instant.now().plusSeconds(604800);
        AuthResult authResult = new AuthResult("mock.jwt.rs256", 900L, "raw-refresh-secret", sessionExp, userResp);
        when(authService.login(any(LoginRequest.class), any(), any())).thenReturn(authResult);

        String json = """
            {
                "email": "user@example.com",
                "password": "Password123@"
            }
            """;

        mvc.perform(post("/api/identity/auth/login").header("Origin", "http://localhost:3000")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.accessToken").value("mock.jwt.rs256"))
            // AUTH-04: refreshToken không được nằm trong JSON response
            .andExpect(jsonPath("$.data.refreshToken").doesNotExist())
            .andExpect(jsonPath("$.data.tokenType").value("Bearer"))
            .andExpect(jsonPath("$.data.user.email").value("user@example.com"))
            // Cookie HttpOnly phải được set
            .andExpect(header().string("Set-Cookie", Matchers.containsString("tasknest_refresh=raw-refresh-secret")))
            .andExpect(header().string("Set-Cookie", Matchers.containsString("HttpOnly")));
    }

    @Test
    void login_invalidCredentials_returns401() throws Exception {
        when(authService.login(any(LoginRequest.class), any(), any()))
            .thenThrow(new InvalidCredentialsException("Email hoặc mật khẩu không chính xác"));

        String json = """
            {
                "email": "user@example.com",
                "password": "WrongPassword@"
            }
            """;

        mvc.perform(post("/api/identity/auth/login").header("Origin", "http://localhost:3000")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.message").value("Email hoặc mật khẩu không chính xác"));
    }

    @Test
    void refreshToken_withoutCsrf_returns403() throws Exception {
        // CSRF bảo vệ refresh-token khi chuyển sang cookie (SEC-07)
        mvc.perform(post("/api/identity/auth/refresh-token").header("Origin", "http://localhost:3000")
                .cookie(new Cookie("tasknest_refresh", "some-cookie-val")))
            .andExpect(status().isForbidden());
    }

    @Test
    void refreshToken_withCsrfAndCookie_returns200AndNewCookie() throws Exception {
        Instant sessionExp = Instant.now().plusSeconds(500000);
        AuthResult authResult = new AuthResult("new.jwt.rs256", 900L, "next-raw-refresh", sessionExp, null);
        when(authService.refresh(eq("my-old-refresh-token"), any())).thenReturn(authResult);

        mvc.perform(post("/api/identity/auth/refresh-token").header("Origin", "http://localhost:3000")
                .with(csrf())
                .cookie(new Cookie("tasknest_refresh", "my-old-refresh-token")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.accessToken").value("new.jwt.rs256"))
            .andExpect(jsonPath("$.data.refreshToken").doesNotExist())
            .andExpect(header().string("Set-Cookie", Matchers.containsString("tasknest_refresh=next-raw-refresh")))
            .andExpect(header().string("Set-Cookie", Matchers.containsString("HttpOnly")));
    }

    @Test
    void refreshToken_withoutCookie_returns401() throws Exception {
        mvc.perform(post("/api/identity/auth/refresh-token").header("Origin", "http://localhost:3000")
                .with(csrf()))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.message").value("Refresh token không được để trống"));
    }

    @Test
    void logout_withCsrfAndCookie_clearsCookieAndRevokesSession() throws Exception {
        mvc.perform(post("/api/identity/auth/logout").header("Origin", "http://localhost:3000")
                .with(csrf())
                .cookie(new Cookie("tasknest_refresh", "token-to-logout")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(header().string("Set-Cookie", Matchers.containsString("Max-Age=0")));

        verify(authService).logout("token-to-logout");
    }

    @Test
    void getJwks_returns200AndJwkKeys() throws Exception {
        mvc.perform(get("/api/identity/.well-known/jwks.json"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.keys").isArray())
            .andExpect(jsonPath("$.keys[0].kty").value("RSA"))
            .andExpect(jsonPath("$.keys[0].kid").value(Matchers.startsWith("rsa-")));

        mvc.perform(get("/api/identity/auth/.well-known/jwks.json"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.keys").isArray());
    }
    @Test
    void refreshRejectsUntrustedOrMissingOriginEvenWithValidCsrf() throws Exception {
        mvc.perform(post("/api/identity/auth/refresh-token").with(csrf())
            .header("Origin", "https://not-allowed.example.test")
            .cookie(new Cookie("tasknest_refresh", "test-token")))
            .andExpect(status().isForbidden());
        mvc.perform(post("/api/identity/auth/refresh-token").with(csrf())
            .cookie(new Cookie("tasknest_refresh", "test-token")))
            .andExpect(status().isForbidden());
        org.mockito.Mockito.verifyNoInteractions(authService);
    }

}

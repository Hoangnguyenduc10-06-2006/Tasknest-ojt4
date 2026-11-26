package vn.tasknest.identityservice.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import vn.tasknest.identityservice.api.dto.auth.request.LoginRequest;
import vn.tasknest.identityservice.domain.AuthSession;
import vn.tasknest.identityservice.domain.User;
import vn.tasknest.identityservice.exception.InvalidCredentialsException;
import vn.tasknest.identityservice.exception.InvalidRefreshTokenException;
import vn.tasknest.identityservice.repository.UserRepository;
import vn.tasknest.identityservice.service.AuthSessionService.RotationResult;
import vn.tasknest.identityservice.service.AuthSessionService.RotationStatus;
import vn.tasknest.identityservice.service.AuthSessionService.SessionTokens;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private AuthSessionService authSessionService;

    @Mock
    private TokenService tokenService;

    @Mock private vn.tasknest.identityservice.service.AuthRateLimitService rateLimits;
    private AuthService authService;

    @BeforeEach
    void setUp() {
        when(passwordEncoder.encode(anyString())).thenReturn("dummy-encoded");
        authService = new AuthService(userRepository, passwordEncoder, authSessionService, tokenService, rateLimits);
    }

    @Test
    void currentUser_resolvesUuidSubject() {
        String id = "00000000-0000-4000-8000-000000000006";
        User user = new User("Nguyen Van A", "user@example.com", "hash");
        user.setId(id);
        user.markEmailVerified(Instant.now());
        when(userRepository.findById(id)).thenReturn(Optional.of(user));
        assertEquals(id, authService.currentUser(id).getId());
    }

    @Test
    void currentUser_rejectsLegacyNumericSubjectWithoutLookingUpAnotherAccount() {
        assertThrows(InvalidCredentialsException.class, () -> authService.currentUser("6"));
        verifyNoInteractions(userRepository);
    }

    @Test
    void login_Success() {
        LoginRequest req = new LoginRequest("user@example.com", "Password123@");
        User user = new User("Nguyen Van A", "user@example.com", "hashedPassword");
        user.setId("00000000-0000-4000-8000-000000000001");
        user.markEmailVerified(Instant.now());

        AuthSession session = new AuthSession();
        session.setId("session-1");
        session.setExpiresAt(Instant.now().plusSeconds(604800));

        when(userRepository.findByEmail("user@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("Password123@", "hashedPassword")).thenReturn(true);
        when(authSessionService.startSession(eq(user), any())).thenReturn(
            new SessionTokens(session, user, "raw-refresh-secret"));
        when(tokenService.generateAccessToken(eq(user), eq(session))).thenReturn(
            new TokenService.AccessToken("jwt.token.val", Instant.now().plusSeconds(900), 900L));

        AuthResult result = authService.login(req, "Mozilla/5.0", "127.0.0.1");

        assertNotNull(result);
        assertEquals("jwt.token.val", result.getAccessToken());
        assertEquals("raw-refresh-secret", result.getRefreshToken());
        assertEquals(900L, result.getExpiresInSeconds());
        assertEquals("user@example.com", result.getUser().getEmail());
    }

    @Test
    void login_UnverifiedAccountDoesNotCreateSession() {
        User user = new User("Pending User", "pending@example.com", "hash");
        when(userRepository.findByEmail("pending@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("Password123@", "hash")).thenReturn(true);
        assertThrows(vn.tasknest.identityservice.exception.EmailNotVerifiedException.class,
            () -> authService.login(new LoginRequest("pending@example.com", "Password123@"), "test", "127.0.0.1"));
        verifyNoInteractions(authSessionService, tokenService);
    }

    @Test
    void login_InvalidPassword_ThrowsInvalidCredentials() {
        LoginRequest req = new LoginRequest("user@example.com", "WrongPassword");
        User user = new User("Nguyen Van A", "user@example.com", "hashedPassword");

        when(userRepository.findByEmail("user@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("WrongPassword", "hashedPassword")).thenReturn(false);

        assertThrows(InvalidCredentialsException.class, () -> authService.login(req, "Mozilla/5.0", "127.0.0.1"));
    }

    @Test
    void login_UserNotFound_ThrowsInvalidCredentials() {
        LoginRequest req = new LoginRequest("unknown@example.com", "Password123@");
        when(userRepository.findByEmail("unknown@example.com")).thenReturn(Optional.empty());

        assertThrows(InvalidCredentialsException.class, () -> authService.login(req, "Mozilla/5.0", "127.0.0.1"));
    }

    @Test
    void refresh_Success() {
        String oldRawToken = "old-raw-token";
        User user = new User("Nguyen Van A", "user@example.com", "hashedPassword");
        user.setId("00000000-0000-4000-8000-000000000001");
        user.markEmailVerified(Instant.now());

        AuthSession session = new AuthSession();
        session.setId("session-1");
        session.setExpiresAt(Instant.now().plusSeconds(500000));

        SessionTokens tokens = new SessionTokens(session, user, "new-raw-token");
        when(authSessionService.rotate(oldRawToken)).thenReturn(
            new RotationResult(RotationStatus.ROTATED, tokens));
        when(tokenService.generateAccessToken(user, session)).thenReturn(
            new TokenService.AccessToken("new.jwt.val", Instant.now().plusSeconds(900), 900L));

        AuthResult result = authService.refresh(oldRawToken, "127.0.0.1");

        assertNotNull(result);
        assertEquals("new.jwt.val", result.getAccessToken());
        assertEquals("new-raw-token", result.getRefreshToken());
    }

    @Test
    void refresh_ReplayDetected_ThrowsInvalidRefreshTokenException() {
        // [P1] issue #6: Khi replay xảy ra, AuthSessionService đã commit việc thu hồi phiên
        // AuthService ném lỗi SAU khi giao dịch thu hồi đã hoàn tất.
        when(authSessionService.rotate("replayed-token")).thenReturn(
            new RotationResult(RotationStatus.REPLAY_DETECTED, null));

        assertThrows(InvalidRefreshTokenException.class, () -> authService.refresh("replayed-token", "127.0.0.1"));
    }

    @Test
    void logout_DelegatesToAuthSessionService() {
        authService.logout("token-to-revoke");
        verify(authSessionService).revokeSessionByRefreshToken("token-to-revoke");
    }
}

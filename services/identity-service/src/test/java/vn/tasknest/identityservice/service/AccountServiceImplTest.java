package vn.tasknest.identityservice.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import vn.tasknest.identityservice.api.dto.auth.request.RegisterRequest;
import vn.tasknest.identityservice.api.dto.auth.response.VerifyEmailResponse;
import vn.tasknest.identityservice.api.dto.user.response.UserResponse;
import vn.tasknest.identityservice.domain.AccountToken;
import vn.tasknest.identityservice.domain.User;
import vn.tasknest.identityservice.exception.CooldownException;
import vn.tasknest.identityservice.exception.DuplicateEmailException;
import vn.tasknest.identityservice.exception.EmailAlreadyVerifiedException;
import vn.tasknest.identityservice.exception.NotFoundUser;
import vn.tasknest.identityservice.exception.RateLimitExceededException;
import vn.tasknest.identityservice.exception.TokenExpiredException;
import vn.tasknest.identityservice.exception.TokenNotFoundException;
import vn.tasknest.identityservice.exception.ValidationException;
import vn.tasknest.identityservice.repository.AccountTokenRepository;
import vn.tasknest.identityservice.repository.UserRepository;

@ExtendWith(MockitoExtension.class)
class AccountServiceImplTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private AccountTokenRepository accountTokenRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private OutboxService outboxService;

    private final Instant fixedNow = Instant.parse("2026-10-27T10:00:00Z");
    private final Clock clock = Clock.fixed(fixedNow, ZoneId.of("UTC"));

    private AccountServiceImpl accountService;

    @BeforeEach
    void setUp() {
        accountService = new AccountServiceImpl(
            userRepository,
            accountTokenRepository,
            passwordEncoder,
            outboxService,
            clock
        );
    }

    @Test
    void register_Success() {
        RegisterRequest request = new RegisterRequest();
        request.setFullName("Nguyen Van A");
        request.setEmail("Test@Example.com");
        request.setPassword("password123");
        request.setConfirmPassword("password123");

        when(userRepository.findByEmail("test@example.com")).thenReturn(java.util.Optional.empty());
        when(passwordEncoder.encode("password123")).thenReturn("hashedPassword");

        User savedUser = new User("Nguyen Van A", "test@example.com", "hashedPassword");
        savedUser.setId("00000000-0000-4000-8000-000000000010");
        savedUser.setEmailVerified(false);
        savedUser.setCreatedAt(fixedNow);
        when(userRepository.saveAndFlush(any(User.class))).thenReturn(savedUser);

        UserResponse response = accountService.register(request);

        assertNotNull(response);
        assertEquals("00000000-0000-4000-8000-000000000010", response.getId());
        assertEquals("Nguyen Van A", response.getFullName());
        assertEquals("test@example.com", response.getEmail());
        assertFalse(response.isEmailVerified());

        verify(accountTokenRepository).saveAndFlush(any(AccountToken.class));
        verify(outboxService).enqueueEmailVerification(eq(savedUser), any(String.class), any(Instant.class));
    }

    @Test
    void register_NullRequest_ThrowsValidationException() {
        assertThrows(ValidationException.class, () -> accountService.register(null));
    }

    @Test
    void registrationRetainsPurposeAndHonorsExplicitDeferral() {
        when(userRepository.findByEmail("new@example.test")).thenReturn(Optional.empty());
        when(passwordEncoder.encode("password123")).thenReturn("hash");
        when(userRepository.saveAndFlush(any(User.class))).thenAnswer(invocation -> {
            User user=invocation.getArgument(0);user.setId("00000000-0000-4000-8000-000000000011");return user;
        });
        for(String purpose:java.util.List.of("CLIENT","DEVELOPER","BOTH","UNDECIDED")) {
            var request=new RegisterRequest("New User","new@example.test","password123","password123",purpose);
            var response=accountService.register(request);
            assertEquals(purpose,response.getAccountPurpose());
            assertEquals(purpose.equals("UNDECIDED")?"DEFERRED":"NOT_STARTED",response.getOnboardingStatus());
            assertEquals(purpose.equals("UNDECIDED")?0:1,response.getOnboardingStep());
        }
    }

    @Test
    void register_InvalidFullName_ThrowsValidationException() {
        RegisterRequest req = new RegisterRequest();
        req.setFullName("  ");
        req.setEmail("a@b.com");
        req.setPassword("12345678");
        req.setConfirmPassword("12345678");
        assertThrows(ValidationException.class, () -> accountService.register(req));

        req.setFullName("A");
        assertThrows(ValidationException.class, () -> accountService.register(req));
    }

    @Test
    void register_InvalidEmail_ThrowsValidationException() {
        RegisterRequest req = new RegisterRequest();
        req.setFullName("Valid Name");
        req.setEmail("invalid-email");
        req.setPassword("12345678");
        req.setConfirmPassword("12345678");
        assertThrows(ValidationException.class, () -> accountService.register(req));
    }

    @Test
    void register_DuplicateEmail_ThrowsDuplicateEmailException() {
        RegisterRequest req = new RegisterRequest();
        req.setFullName("Valid Name");
        req.setEmail("dup@example.com");
        req.setPassword("12345678");
        req.setConfirmPassword("12345678");

        User verified = new User("Existing", "dup@example.com", "hash");
        verified.setEmailVerified(true);
        when(userRepository.findByEmail("dup@example.com")).thenReturn(java.util.Optional.of(verified));
        assertThrows(DuplicateEmailException.class, () -> accountService.register(req));
    }

    @Test
    void register_DuplicateEmailOnConcurrency_ThrowsDuplicateEmailException() {
        RegisterRequest req = new RegisterRequest();
        req.setFullName("Valid Name");
        req.setEmail("dup@example.com");
        req.setPassword("12345678");
        req.setConfirmPassword("12345678");

        when(userRepository.findByEmail("dup@example.com")).thenReturn(java.util.Optional.empty());
        when(passwordEncoder.encode("12345678")).thenReturn("hashed");
        when(userRepository.saveAndFlush(any(User.class)))
            .thenThrow(new DataIntegrityViolationException("Duplicate", new java.sql.SQLException("Duplicate entry for key uq_users_email", "23000", 1062)));

        assertThrows(DuplicateEmailException.class, () -> accountService.register(req));
    }

    @Test
    void register_PasswordMismatch_ThrowsValidationException() {
        RegisterRequest req = new RegisterRequest();
        req.setFullName("Valid Name");
        req.setEmail("a@b.com");
        req.setPassword("12345678");
        req.setConfirmPassword("different123");
        assertThrows(ValidationException.class, () -> accountService.register(req));
    }

    @Test
    void verifyEmail_Success() {
        String token = "valid-token-123";
        User user = new User("Nguyen A", "a@example.com", "hash");
        user.setId("00000000-0000-4000-8000-000000000001");
        user.setEmailVerified(false);

        AccountToken accountToken = new AccountToken();
        accountToken.setId(100L);
        accountToken.setUserId("00000000-0000-4000-8000-000000000001");
        accountToken.setCreatedAt(fixedNow.minusSeconds(3600));
        accountToken.setExpiresAt(fixedNow.plusSeconds(3600));

        when(accountTokenRepository.findUserIdByTokenHash(any(byte[].class), eq(AccountToken.PURPOSE_EMAIL_VERIFICATION)))
            .thenReturn(Optional.of("00000000-0000-4000-8000-000000000001"));
        when(userRepository.findByIdForUpdate("00000000-0000-4000-8000-000000000001")).thenReturn(Optional.of(user));
        when(accountTokenRepository.findByTokenHashForUpdate(any(byte[].class), eq(AccountToken.PURPOSE_EMAIL_VERIFICATION)))
            .thenReturn(Optional.of(accountToken));

        VerifyEmailResponse res = accountService.verifyEmail(token);

        assertNotNull(res);
        assertTrue(res.isVerified());
        assertEquals("a@example.com", res.getEmail());
        assertTrue(user.isEmailVerified());
        assertNotNull(user.getEmailVerifiedAt());
        assertNotNull(accountToken.getUsedAt());

        verify(userRepository).save(user);
        verify(accountTokenRepository).save(accountToken);
    }

    @Test
    void verifyEmail_NotFound_ThrowsTokenNotFoundException() {
        when(accountTokenRepository.findUserIdByTokenHash(any(byte[].class), eq(AccountToken.PURPOSE_EMAIL_VERIFICATION)))
            .thenReturn(Optional.empty());

        assertThrows(TokenNotFoundException.class, () -> accountService.verifyEmail("unknown-token"));
    }

    @Test
    void verifyEmail_AlreadyUsed_ThrowsTokenExpiredException() {
        User user = new User("Nguyen A", "a@example.com", "hash");
        user.setId("00000000-0000-4000-8000-000000000001");

        AccountToken accountToken = new AccountToken();
        accountToken.setId(100L);
        accountToken.setUserId("00000000-0000-4000-8000-000000000001");
        accountToken.setCreatedAt(fixedNow.minusSeconds(3600));
        accountToken.setExpiresAt(fixedNow.plusSeconds(3600));
        accountToken.setUsedAt(fixedNow.minusSeconds(1800));

        when(accountTokenRepository.findUserIdByTokenHash(any(byte[].class), eq(AccountToken.PURPOSE_EMAIL_VERIFICATION)))
            .thenReturn(Optional.of("00000000-0000-4000-8000-000000000001"));
        when(userRepository.findByIdForUpdate("00000000-0000-4000-8000-000000000001")).thenReturn(Optional.of(user));
        when(accountTokenRepository.findByTokenHashForUpdate(any(byte[].class), eq(AccountToken.PURPOSE_EMAIL_VERIFICATION)))
            .thenReturn(Optional.of(accountToken));

        assertThrows(TokenExpiredException.class, () -> accountService.verifyEmail("used-token"));
    }

    @Test
    void verifyEmail_Expired_ThrowsTokenExpiredException() {
        User user = new User("Nguyen A", "a@example.com", "hash");
        user.setId("00000000-0000-4000-8000-000000000001");

        AccountToken accountToken = new AccountToken();
        accountToken.setId(100L);
        accountToken.setUserId("00000000-0000-4000-8000-000000000001");
        accountToken.setCreatedAt(fixedNow.minusSeconds(7200));
        accountToken.setExpiresAt(fixedNow.minusSeconds(100)); // expired

        when(accountTokenRepository.findUserIdByTokenHash(any(byte[].class), eq(AccountToken.PURPOSE_EMAIL_VERIFICATION)))
            .thenReturn(Optional.of("00000000-0000-4000-8000-000000000001"));
        when(userRepository.findByIdForUpdate("00000000-0000-4000-8000-000000000001")).thenReturn(Optional.of(user));
        when(accountTokenRepository.findByTokenHashForUpdate(any(byte[].class), eq(AccountToken.PURPOSE_EMAIL_VERIFICATION)))
            .thenReturn(Optional.of(accountToken));

        assertThrows(TokenExpiredException.class, () -> accountService.verifyEmail("expired-token"));
    }

    @Test
    void resendVerificationEmail_Success() {
        String email = "resend@example.com";
        User user = new User("Nguyen A", email, "hash");
        user.setId("00000000-0000-4000-8000-000000000005");
        user.setEmailVerified(false);

        when(userRepository.findByEmailForUpdate(email)).thenReturn(Optional.of(user));
        // Token cũ tạo 120s trước (> 60s cooldown)
        AccountToken oldToken = new AccountToken();
        oldToken.setCreatedAt(fixedNow.minusSeconds(120));
        when(accountTokenRepository.findTopByUserIdAndPurposeOrderByCreatedAtDesc("00000000-0000-4000-8000-000000000005", AccountToken.PURPOSE_EMAIL_VERIFICATION))
            .thenReturn(Optional.of(oldToken));
        when(accountTokenRepository.countByUserIdAndPurposeAndIssueSourceAndCreatedAtAfter(eq("00000000-0000-4000-8000-000000000005"), eq(AccountToken.PURPOSE_EMAIL_VERIFICATION), eq("RESEND"), any(Instant.class)))
            .thenReturn(1L);

        accountService.resendVerificationEmail(email);

        verify(accountTokenRepository).revokeActive(eq("00000000-0000-4000-8000-000000000005"), eq(AccountToken.PURPOSE_EMAIL_VERIFICATION), eq(fixedNow));
        verify(accountTokenRepository).saveAndFlush(any(AccountToken.class));
        verify(outboxService).enqueueEmailVerification(eq(user), any(String.class), any(Instant.class));
    }

    @Test
    void resendVerificationEmail_UserNotFound_ThrowsNotFoundUser() {
        when(userRepository.findByEmailForUpdate("notfound@example.com")).thenReturn(Optional.empty());
        assertThrows(NotFoundUser.class, () -> accountService.resendVerificationEmail("notfound@example.com"));
    }

    @Test
    void resendVerificationEmail_AlreadyVerified_ThrowsEmailAlreadyVerifiedException() {
        User user = new User("A", "a@example.com", "hash");
        user.setEmailVerified(true);
        when(userRepository.findByEmailForUpdate("a@example.com")).thenReturn(Optional.of(user));

        assertThrows(EmailAlreadyVerifiedException.class, () -> accountService.resendVerificationEmail("a@example.com"));
    }

    @Test
    void resendVerificationEmail_CooldownViolation_ThrowsCooldownException() {
        User user = new User("A", "a@example.com", "hash");
        user.setId("00000000-0000-4000-8000-000000000002");
        user.setEmailVerified(false);
        when(userRepository.findByEmailForUpdate("a@example.com")).thenReturn(Optional.of(user));

        // Mới tạo 30s trước -> còn 30s
        AccountToken recent = new AccountToken();
        recent.setCreatedAt(fixedNow.minusSeconds(30));
        when(accountTokenRepository.findTopByUserIdAndPurposeOrderByCreatedAtDesc("00000000-0000-4000-8000-000000000002", AccountToken.PURPOSE_EMAIL_VERIFICATION))
            .thenReturn(Optional.of(recent));

        CooldownException ex = assertThrows(CooldownException.class, () -> accountService.resendVerificationEmail("a@example.com"));
        assertEquals(30, ex.getRemainingSeconds());
    }

    @Test
    void resendVerificationEmail_RateLimitExceeded_ThrowsRateLimitExceededException() {
        User user = new User("A", "a@example.com", "hash");
        user.setId("00000000-0000-4000-8000-000000000002");
        user.setEmailVerified(false);
        when(userRepository.findByEmailForUpdate("a@example.com")).thenReturn(Optional.of(user));

        AccountToken old = new AccountToken();
        old.setCreatedAt(fixedNow.minusSeconds(100));
        when(accountTokenRepository.findTopByUserIdAndPurposeOrderByCreatedAtDesc("00000000-0000-4000-8000-000000000002", AccountToken.PURPOSE_EMAIL_VERIFICATION))
            .thenReturn(Optional.of(old));
        when(accountTokenRepository.countByUserIdAndPurposeAndIssueSourceAndCreatedAtAfter(eq("00000000-0000-4000-8000-000000000002"), eq(AccountToken.PURPOSE_EMAIL_VERIFICATION), eq("RESEND"), any(Instant.class)))
            .thenReturn(5L); // đã đạt 5 lần/giờ

        assertThrows(RateLimitExceededException.class, () -> accountService.resendVerificationEmail("a@example.com"));
    }
    @Test
    void oversizedEmailIsValidationErrorBeforeDatabaseAccess() {
        var request = new RegisterRequest("Review User", "a".repeat(250) + "@example.test", "password123", "password123");
        assertThrows(ValidationException.class, () -> accountService.register(request));
        verifyNoInteractions(userRepository, passwordEncoder, outboxService);
    }

    @Test
    void unrelatedDatabaseConstraintIsNotReportedAsDuplicateEmail() {
        var request = new RegisterRequest("Review User", "review@example.test", "password123", "password123");
        when(passwordEncoder.encode(anyString())).thenReturn("hash");
        when(userRepository.saveAndFlush(any(User.class))).thenThrow(new DataIntegrityViolationException("other constraint"));
        assertThrows(DataIntegrityViolationException.class, () -> accountService.register(request));
    }

}

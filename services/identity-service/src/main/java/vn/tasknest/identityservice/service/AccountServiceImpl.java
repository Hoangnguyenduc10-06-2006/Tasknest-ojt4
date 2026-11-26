package vn.tasknest.identityservice.service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Locale;
import vn.tasknest.identityservice.security.CredentialPolicy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
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
import vn.tasknest.identityservice.security.TokenHasher;

/**
 * Triển khai nghiệp vụ đăng ký và xác minh email tài khoản.
 * 
 * <p>Quy tắc nghiệp vụ:
 * <ul>
 *   <li>ACC-01 -> ACC-04: Validate chuẩn họ tên, email chuẩn hóa chữ thường, băm mật khẩu BCrypt.</li>
 *   <li>VERIFY-01 -> VERIFY-05: Tài khoản ban đầu chưa xác thực; token ngẫu nhiên hiệu lực 24 giờ.</li>
 *   <li>VERIFY-04: Cooldown 60 giây giữa 2 lần gửi lại; tối đa 5 lần gửi lại trong 1 giờ.</li>
 *   <li>SEC-11: Tuyệt đối không log token thô hoặc link xác nhận chứa secret.</li>
 *   <li>Outbox Pattern: Lỗi gửi email không rollback việc tạo tài khoản người dùng (VERIFY-05).</li>
 * </ul>
 */
@Service
public class AccountServiceImpl implements AccountService {

    private static final Logger log = LoggerFactory.getLogger(AccountServiceImpl.class);

    public static final ZoneId ZONE_VN = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final int COOLDOWN_SECONDS = 60;
    private static final int MAX_RESENDS_PER_HOUR = 5;
    private static final int TOKEN_EXPIRY_HOURS = 24;

    private final UserRepository userRepository;
    private final AccountTokenRepository accountTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final OutboxService outboxService;
    private final Clock clock;

    public AccountServiceImpl(
        UserRepository userRepository,
        AccountTokenRepository accountTokenRepository,
        PasswordEncoder passwordEncoder,
        OutboxService outboxService,
        Clock clock
    ) {
        this.userRepository = userRepository;
        this.accountTokenRepository = accountTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.outboxService = outboxService;
        this.clock = clock;
    }

    /**
     * Đăng ký tài khoản người dùng mới (ACC-01 -> ACC-04, VERIFY-01).
     * 
     * @param request dữ liệu đăng ký đầu vào
     * @return {@link UserResponse} thông tin người dùng được lưu (chưa xác nhận email)
     */
    @Override
    @Transactional
    public UserResponse register(RegisterRequest request) {
        if (request == null) {
            throw new ValidationException("Dữ liệu đăng ký không hợp lệ");
        }

        // ACC-02: Họ tên có nội dung sau khi bỏ khoảng trắng đầu/cuối. Độ dài 2–100 ký tự.
        if (request.getFullName() == null) {
            throw new ValidationException("Họ tên không được để trống");
        }
        String trimmedFullName = request.getFullName().trim();
        if (trimmedFullName.isEmpty()) {
            throw new ValidationException("Họ tên không được để trống");
        }
        if (trimmedFullName.length() < 2 || trimmedFullName.length() > 100) {
            throw new ValidationException("Họ tên phải có độ dài từ 2 đến 100 ký tự");
        }

        // ACC-03: Email theo định dạng được hỗ trợ, trim đầu/cuối, chuyển thường, duy nhất trong hệ thống.
        if (request.getEmail() == null) {
            throw new ValidationException("Email không được để trống");
        }
        String trimmedEmail = request.getEmail().trim();
        if (trimmedEmail.isEmpty()) {
            throw new ValidationException("Email không được để trống");
        }
        String normalizedEmail = trimmedEmail.toLowerCase(Locale.ROOT);
        if (normalizedEmail.length() > 255) throw new ValidationException("Email không được vượt quá 255 ký tự");
        if (!CredentialPolicy.validEmail(normalizedEmail)) {
            throw new ValidationException("Email không đúng định dạng");
        }
        var existing = userRepository.findByEmail(normalizedEmail).orElse(null);
        if (existing != null) {
            if (!existing.isEmailVerified()) throw new vn.tasknest.identityservice.exception.EmailNotVerifiedException();
            throw new DuplicateEmailException("Email đã tồn tại trong hệ thống");
        }

        // ACC-04: Mật khẩu tối thiểu 8 ký tự; xác nhận mật khẩu phải khớp. Lưu dạng băm BCrypt, không trả qua API.
        if (!CredentialPolicy.validPassword(request.getPassword())) {
            throw new ValidationException("Mật khẩu cần ít nhất 8 ký tự và tối đa 72 byte UTF-8");
        }
        if (request.getConfirmPassword() == null || !request.getPassword().equals(request.getConfirmPassword())) {
            throw new ValidationException("Xác nhận mật khẩu không khớp");
        }

        String passwordHash = passwordEncoder.encode(request.getPassword());
        // VERIFY-01: Tài khoản mới tạo ở trạng thái Chưa xác nhận email (is_email_verified = false)
        User user = new User(trimmedFullName, normalizedEmail, passwordHash);
        String purpose=request.getAccountPurpose()==null ? "UNDECIDED" : request.getAccountPurpose();
        if (!java.util.Set.of("UNDECIDED","CLIENT","DEVELOPER","BOTH").contains(purpose)) throw new ValidationException("Mục đích sử dụng không hợp lệ");
        user.setAccountPurpose(purpose);
        user.setOnboardingStatus("UNDECIDED".equals(request.getAccountPurpose()) ? "DEFERRED" : "NOT_STARTED");
        user.setOnboardingStep("UNDECIDED".equals(purpose) ? 0 : 1);
        User saved;
        try {
            saved = userRepository.saveAndFlush(user);
        } catch (DataIntegrityViolationException ex) {
            // Chốt chặn cuối cùng nếu có 2 request đăng ký cùng email đồng thời (Race condition)
            Throwable cause = ex;
            while (cause != null) {
                if (cause instanceof java.sql.SQLException sql && sql.getErrorCode() == 1062
                    && sql.getMessage() != null && sql.getMessage().contains("uq_users_email")) {
                    throw new DuplicateEmailException("Email đã tồn tại trong hệ thống");
                }
                cause = cause.getCause();
            }
            throw ex;
        }

        // VERIFY-01, VERIFY-03, VERIFY-05: Sinh token ngẫu nhiên hiệu lực 24h, chỉ lưu hash trong DB;
        // đẩy email verification event vào bảng outbox_events cùng transaction.
        issueVerificationToken(saved, "REGISTER");

        return UserResponse.from(saved);
    }

    /**
     * Xác nhận email của tài khoản bằng mã token xác thực (VERIFY-03).
     * 
     * @param token token dạng base64url nhận từ URL
     * @return kết quả xác nhận email
     */
    @Override
    @Transactional
    public VerifyEmailResponse verifyEmail(String token) {
        if (token == null || token.trim().isEmpty()) {
            throw new TokenNotFoundException("Token xác thực không được để trống");
        }
        byte[] hash = TokenHasher.sha256(token.trim());

        // Thứ tự khóa luôn là người dùng -> token (cùng thứ tự với resend) để phòng tránh Deadlock
        String userId = accountTokenRepository
            .findUserIdByTokenHash(hash, AccountToken.PURPOSE_EMAIL_VERIFICATION)
            .orElseThrow(() -> new TokenNotFoundException("Token xác thực không tồn tại hoặc không hợp lệ"));
        User user = userRepository.findByIdForUpdate(userId)
            .orElseThrow(() -> new TokenNotFoundException("Token xác thực không tồn tại hoặc không hợp lệ"));
        AccountToken verificationToken = accountTokenRepository
            .findByTokenHashForUpdate(hash, AccountToken.PURPOSE_EMAIL_VERIFICATION)
            .orElseThrow(() -> new TokenNotFoundException("Token xác thực không tồn tại hoặc không hợp lệ"));

        Instant now = now();
        // VERIFY-03: Token chỉ dùng thành công 1 lần duy nhất, có hiệu lực 24 giờ, chưa bị vô hiệu hóa
        if (verificationToken.getRevokedAt() != null) {
            throw new TokenExpiredException("Token xác thực đã bị vô hiệu hóa");
        }
        if (verificationToken.getUsedAt() != null) {
            throw new TokenExpiredException("Token xác thực đã được sử dụng");
        }
        if (!verificationToken.getExpiresAt().isAfter(now)) {
            throw new TokenExpiredException("Token xác thực đã hết hạn");
        }

        // Cập nhật cả cờ is_email_verified và timestamp email_verified_at để thỏa mãn constraint ck_user_verified
        user.markEmailVerified(now);
        userRepository.save(user);
        verificationToken.setUsedAt(now);
        accountTokenRepository.save(verificationToken);

        // SEC-11: Chỉ ghi log định danh userId an toàn, tuyệt đối không in token hoặc email thô
        log.info("Email verified successfully for userId={}", user.getId());

        return VerifyEmailResponse.builder()
            .email(user.getEmail())
            .verified(true)
            .message("Xác nhận email thành công")
            .verifiedAt(ZonedDateTime.ofInstant(now, ZONE_VN))
            .build();
    }

    /**
     * Gửi lại email xác nhận tài khoản (VERIFY-04).
     * 
     * @param email địa chỉ email cần gửi lại
     */
    @Override
    @Transactional
    public void resendVerificationEmail(String email) {
        if (email == null || email.trim().isEmpty()) {
            throw new ValidationException("Email không được để trống");
        }
        String normalizedEmail = email.trim().toLowerCase(Locale.ROOT);

        if (!CredentialPolicy.validEmail(normalizedEmail)) throw new ValidationException("Email không đúng định dạng");

        // Khóa bi quan hàng User (SELECT ... FOR UPDATE) để tuần tự hóa các yêu cầu gửi lại đồng thời
        User user = userRepository.findByEmailForUpdate(normalizedEmail)
            .orElseThrow(() -> new NotFoundUser("Không tìm thấy người dùng với email: " + normalizedEmail));

        // Nếu đã xác thực trước đó thì từ chối gửi lại
        if (user.isEmailVerified()) {
            throw new EmailAlreadyVerifiedException("Tài khoản đã được xác nhận email trước đó");
        }

        Instant now = now();

        // VERIFY-04: Cooldown tối thiểu 60 giây giữa 2 lần gửi
        accountTokenRepository
            .findTopByUserIdAndPurposeOrderByCreatedAtDesc(user.getId(), AccountToken.PURPOSE_EMAIL_VERIFICATION)
            .ifPresent(latestToken -> {
                long secondsSinceLast = Duration.between(latestToken.getCreatedAt(), now).getSeconds();
                if (secondsSinceLast < COOLDOWN_SECONDS) {
                    long remainingSeconds = COOLDOWN_SECONDS - secondsSinceLast;
                    throw new CooldownException(
                        "Vui lòng đợi thêm " + remainingSeconds + " giây trước khi yêu cầu gửi lại email",
                        remainingSeconds
                    );
                }
            });

        // VERIFY-04: Tối đa chỉ được gửi 5 lần/giờ cho 1 tài khoản
        long countLastHour = accountTokenRepository.countByUserIdAndPurposeAndIssueSourceAndCreatedAtAfter(
            user.getId(), AccountToken.PURPOSE_EMAIL_VERIFICATION, "RESEND", now.minus(1, ChronoUnit.HOURS));
        if (countLastHour >= MAX_RESENDS_PER_HOUR) {
            throw new RateLimitExceededException(
                "Bạn đã vượt quá số lần gửi lại email xác thực (tối đa 5 lần/giờ). Vui lòng thử lại sau."
            );
        }

        // VERIFY-03: Vô hiệu hóa toàn bộ token xác nhận cũ của tài khoản (kể cả token quá hạn chưa đánh dấu)
        accountTokenRepository.revokeActive(user.getId(), AccountToken.PURPOSE_EMAIL_VERIFICATION, now);

        // Sinh token mới 24h và ghi sự kiện outbox
        issueVerificationToken(user, "RESEND");
    }

    /**
     * Helper sinh token xác nhận và đưa vào bảng outbox_events.
     * Token gốc chỉ truyền vào sensitive_payload đã được mã hóa AES-256-GCM.
     */
    private void issueVerificationToken(User user, String issueSource) {
        Instant now = now();
        String rawToken = TokenHasher.generateOpaqueToken();
        Instant expiresAt = now.plus(TOKEN_EXPIRY_HOURS, ChronoUnit.HOURS);

        AccountToken accountToken = new AccountToken();
        accountToken.setUserId(user.getId());
        accountToken.setPurpose(AccountToken.PURPOSE_EMAIL_VERIFICATION);
        accountToken.setIssueSource(issueSource);
        accountToken.setTokenHash(TokenHasher.sha256(rawToken));
        accountToken.setCreatedAt(now);
        accountToken.setExpiresAt(expiresAt);
        accountTokenRepository.saveAndFlush(accountToken);

        // Token gốc chỉ đi vào sensitive_payload đã mã hóa; không bao giờ ghi ra log (SEC-11)
        outboxService.enqueueEmailVerification(user, rawToken, expiresAt);
    }

    private Instant now() {
        return Instant.now(clock).truncatedTo(ChronoUnit.MICROS);
    }
}

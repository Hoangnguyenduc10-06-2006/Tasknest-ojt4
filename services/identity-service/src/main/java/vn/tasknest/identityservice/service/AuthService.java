package vn.tasknest.identityservice.service;

import java.util.Locale;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import vn.tasknest.identityservice.api.dto.auth.request.LoginRequest;
import vn.tasknest.identityservice.api.dto.user.response.UserResponse;
import vn.tasknest.identityservice.domain.User;
import vn.tasknest.identityservice.exception.InvalidCredentialsException;
import vn.tasknest.identityservice.exception.InvalidRefreshTokenException;
import vn.tasknest.identityservice.repository.UserRepository;
import vn.tasknest.identityservice.service.AuthSessionService.RotationResult;
import vn.tasknest.identityservice.service.AuthSessionService.SessionTokens;

/**
 * Service điều phối các hoạt động xác thực người dùng (Đăng nhập, Làm mới Token, Đăng xuất).
 * 
 * <p>Kiến trúc & Ranh giới giao dịch (Transaction Boundary):
 * <ul>
 *   <li>Lớp này <b>không</b> mở {@code @Transactional} cấp method để đảm bảo khi phát hiện lỗi replay token,
 *   giao dịch thu hồi phiên của {@link AuthSessionService} đã hoàn thành commit trước khi ngoại lệ
 *   {@link InvalidRefreshTokenException} được ném ra ngoài (giải quyết triệt để lỗi rollback giao dịch thu hồi).</li>
 *   <li>Chống tấn công thời gian (Timing Attack - SEC-06): Dùng {@code dummyPasswordHash} so khớp khi email
 *   không tồn tại, làm cho thời gian phản hồi giữa email sai và mật khẩu sai tương đương nhau.</li>
 * </ul>
 */
@Service
public class AuthService {

    private static final String INVALID_CREDENTIALS = "Email hoặc mật khẩu không chính xác";
    private static final String INVALID_REFRESH = "Phiên đăng nhập không hợp lệ hoặc đã hết hạn";
    
    /** Hash giả để thời gian xử lý khi email không tồn tại gần với trường hợp sai mật khẩu (SEC-06). */
    private final String dummyPasswordHash;

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthSessionService authSessionService;
    private final TokenService tokenService;
    private final AuthRateLimitService rateLimits;

    public AuthService(
        UserRepository userRepository,
        PasswordEncoder passwordEncoder,
        AuthSessionService authSessionService,
        TokenService tokenService,
        AuthRateLimitService rateLimits
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.authSessionService = authSessionService;
        this.tokenService = tokenService;
        this.rateLimits = rateLimits;
        this.dummyPasswordHash = passwordEncoder.encode("tasknest-dummy-password");
    }

    /**
     * Xác thực thông tin đăng nhập và tạo phiên làm việc mới (AUTH-01, AUTH-02).
     * 
     * @param request thông tin gồm email và mật khẩu
     * @param userAgent chuỗi định danh trình duyệt / thiết bị của người dùng
     * @return {@link AuthResult} chứa Access Token, Refresh Token ngẫu nhiên (chỉ lưu bộ nhớ để đặt cookie),
     *         mốc hết hạn tuyệt đối của phiên và thông tin người dùng
     */
    public AuthResult login(LoginRequest request, String userAgent, String clientAddress) {
        if (request == null || request.getEmail() == null || request.getPassword() == null) {
            throw new InvalidCredentialsException(INVALID_CREDENTIALS);
        }
        String normalizedEmail = request.getEmail().trim().toLowerCase(Locale.ROOT);
        rejectRateLimit(rateLimits.consumeLogin(normalizedEmail, clientAddress));
        if (!vn.tasknest.identityservice.security.CredentialPolicy.validEmail(normalizedEmail)
            || !vn.tasknest.identityservice.security.CredentialPolicy.validPassword(request.getPassword()))
            throw new InvalidCredentialsException(INVALID_CREDENTIALS);
        User user = userRepository.findByEmail(normalizedEmail).orElse(null);

        // Luôn so khớp mật khẩu ngay cả khi user null (với dummy hash) để tránh enumeration attack theo timing
        boolean matches = passwordEncoder.matches(
            request.getPassword(), user != null ? user.getPasswordHash() : dummyPasswordHash);
        if (user == null || !matches) {
            throw new InvalidCredentialsException(INVALID_CREDENTIALS);
        }

        if (!user.isEmailVerified()) throw new vn.tasknest.identityservice.exception.EmailNotVerifiedException();

        // Bắt đầu phiên làm việc mới trong DB
        return toResult(authSessionService.startSession(user, userAgent));
    }

    /**
     * Xoay vòng Refresh Token (Token Rotation - AUTH-05).
     * 
     * @param rawRefreshToken token dạng chuỗi nhận từ HttpOnly cookie
     * @return {@link AuthResult} chứa Access Token mới và Refresh Token mới
     */
    public AuthResult refresh(String rawRefreshToken, String clientAddress) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) {
            throw new InvalidRefreshTokenException(INVALID_REFRESH);
        }
        rejectRateLimit(rateLimits.consumeRefresh(authSessionService.findSessionIdForRateLimit(rawRefreshToken.trim()), clientAddress));
        RotationResult result = authSessionService.rotate(rawRefreshToken.trim());
        if (!result.isRotated()) {
            // Giao dịch thu hồi của rotate() đã commit thành công vào DB trước khi ném ngoại lệ ở đây
            throw new InvalidRefreshTokenException(INVALID_REFRESH);
        }
        return toResult(result.getTokens());
    }

    /**
     * Đăng xuất và thu hồi phiên đăng nhập tương ứng phía máy chủ (AUTH-07).
     * 
     * @param rawRefreshToken token nhận từ cookie để xác định phiên cần thu hồi
     */
    public void logout(String rawRefreshToken) {
        if (rawRefreshToken != null && !rawRefreshToken.isBlank()) {
            authSessionService.revokeSessionByRefreshToken(rawRefreshToken.trim());
        }
    }

    public UserResponse currentUser(String subject) {
        try {
            return userRepository.findById(java.util.UUID.fromString(subject).toString()).filter(User::isEmailVerified)
                .map(UserResponse::from).orElseThrow(() -> new InvalidCredentialsException(INVALID_REFRESH));
        } catch (IllegalArgumentException ex) {
            throw new InvalidCredentialsException(INVALID_REFRESH);
        }
    }

    private void rejectRateLimit(long retryAfter) {
        if (retryAfter > 0) throw new vn.tasknest.identityservice.exception.RateLimitExceededException(
            "Quá nhiều yêu cầu xác thực. Vui lòng thử lại sau.", retryAfter);
    }

    /**
     * Chuyển đổi kết quả phiên thành {@link AuthResult} và cấp Access Token RS256 tương ứng.
     */
    private AuthResult toResult(SessionTokens tokens) {
        TokenService.AccessToken access = tokenService.generateAccessToken(tokens.getUser(), tokens.getSession());
        return new AuthResult(
            access.getValue(),
            access.getExpiresInSeconds(),
            tokens.getRawRefreshToken(),
            tokens.getSession().getExpiresAt(),
            UserResponse.from(tokens.getUser()));
    }
}

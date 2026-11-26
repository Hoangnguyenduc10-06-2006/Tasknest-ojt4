package vn.tasknest.identityservice.api.controller;

import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vn.tasknest.identityservice.api.dto.auth.request.LoginRequest;
import vn.tasknest.identityservice.api.dto.auth.request.RegisterRequest;
import vn.tasknest.identityservice.api.dto.auth.request.ResendVerificationEmailRequest;
import vn.tasknest.identityservice.api.dto.auth.response.LoginResponse;
import vn.tasknest.identityservice.api.dto.auth.response.TokenRefreshResponse;
import vn.tasknest.identityservice.api.dto.auth.response.VerifyEmailResponse;
import vn.tasknest.identityservice.api.dto.common.response.ApiDataResponse;
import vn.tasknest.identityservice.api.dto.user.response.UserResponse;
import vn.tasknest.identityservice.config.IdentityProperties;
import vn.tasknest.identityservice.exception.InvalidRefreshTokenException;
import vn.tasknest.identityservice.service.AccountService;
import vn.tasknest.identityservice.service.AuthResult;
import vn.tasknest.identityservice.service.AuthService;

/**
 * Controller xử lý các tác vụ xác thực (Authentication) và quản lý tài khoản người dùng.
 * 
 * <p>Kiến trúc & Bảo mật:
 * <ul>
 *   <li>Chuẩn hóa đường dẫn canonical theo tiền tố: {@code /api/identity/auth/*}.</li>
 *   <li>Tuân thủ AUTH-04: Refresh Token không trả về qua JSON body mà chỉ trao đổi qua HttpOnly Cookie.</li>
 *   <li>Tuân thủ AUTH-07: Đăng xuất thu hồi phiên phía máy chủ và xóa cookie.</li>
 *   <li>Tuân thủ SEC-07: Bắt buộc bảo vệ CSRF trên các endpoint thay đổi trạng thái dùng cookie (refresh, logout).</li>
 * </ul>
 */
@RestController
@RequestMapping
public class AuthController {

    private final AccountService accountService;
    private final AuthService authService;
    private final IdentityProperties identityProperties;
    private final RSAKey rsaKey;
    private final vn.tasknest.identityservice.security.ClientAddress clientAddress;
    private final vn.tasknest.identityservice.service.AuthRateLimitService rateLimits;

    public AuthController(
            AccountService accountService,
            AuthService authService,
            IdentityProperties identityProperties,
            RSAKey rsaKey, vn.tasknest.identityservice.security.ClientAddress clientAddress,
            vn.tasknest.identityservice.service.AuthRateLimitService rateLimits) {
        this.accountService = accountService;
        this.authService = authService;
        this.identityProperties = identityProperties;
        this.rsaKey = rsaKey;
        this.clientAddress = clientAddress;
        this.rateLimits = rateLimits;
    }

    private void rejectBudget(long retryAfter) {
        if (retryAfter > 0) throw new vn.tasknest.identityservice.exception.RateLimitExceededException("Quá nhiều yêu cầu. Vui lòng thử lại sau.", retryAfter);
    }

    @GetMapping("/api/identity/auth/session")
    public ResponseEntity<ApiDataResponse<UserResponse>> currentSession(
        @org.springframework.security.core.annotation.AuthenticationPrincipal org.springframework.security.oauth2.jwt.Jwt jwt) {
        return ResponseEntity.ok(new ApiDataResponse<>(true, "Phiên đăng nhập hợp lệ",
            authService.currentUser(jwt.getSubject()), null, HttpStatus.OK));
    }

    /**
     * Đăng ký tài khoản người dùng mới.
     * 
     * @param request dữ liệu đăng ký gồm fullName, email, password, confirmPassword (ACC-01 -> ACC-04)
     * @return {@link UserResponse} thông tin tài khoản được tạo (chưa xác thực email, không chứa mật khẩu)
     */
    @PostMapping("/api/identity/auth/register")
    public ResponseEntity<ApiDataResponse<UserResponse>> register(@Valid @RequestBody RegisterRequest request, HttpServletRequest servletRequest) {
        rejectBudget(rateLimits.consumeMailRequest("REGISTER", clientAddress.resolve(servletRequest)));
        return new ResponseEntity<>(
                new ApiDataResponse<>(
                        true,
                        "Đăng ký thành công",
                        accountService.register(request),
                        null,
                        HttpStatus.CREATED),
                HttpStatus.CREATED);
    }

    /**
     * Xác nhận địa chỉ email thông qua token xác thực một lần.
     * 
     * @param token mã token xác nhận (VERIFY-03: dùng 1 lần, hiệu lực 24h)
     * @return {@link VerifyEmailResponse} kết quả xác nhận thành công
     */
    @GetMapping("/api/identity/auth/verify-email")
    public ResponseEntity<ApiDataResponse<VerifyEmailResponse>> verifyEmail(@RequestParam("token") String token) {
        return new ResponseEntity<>(
                new ApiDataResponse<>(
                        true,
                        "Xác nhận email thành công",
                        accountService.verifyEmail(token),
                        null,
                        HttpStatus.OK),
                HttpStatus.OK);
    }

    /**
     * Yêu cầu gửi lại email xác nhận tài khoản.
     * 
     * @param request chứa email cần gửi lại (áp dụng cooldown 60s và tối đa 5 lần/giờ theo VERIFY-04)
     * @return thông báo gửi lại thành công
     */
    @PostMapping("/api/identity/auth/resend-verification")
    public ResponseEntity<ApiDataResponse<Void>> resendVerification(
            @Valid @RequestBody ResendVerificationEmailRequest request, HttpServletRequest servletRequest) {
        rejectBudget(rateLimits.consumeMailRequest("RESEND", clientAddress.resolve(servletRequest)));
        accountService.resendVerificationEmail(request.getEmail());
        return new ResponseEntity<>(
                new ApiDataResponse<>(
                        true,
                        "Gửi lại email xác nhận thành công",
                        null,
                        null,
                        HttpStatus.OK),
                HttpStatus.OK);
    }

    /**
     * Đăng nhập hệ thống.
     * 
     * <p>Xác thực thông tin tài khoản, tạo phiên đăng nhập mới tại {@code auth_sessions} với hạn tuyệt đối 7 ngày.
     * Cấp Access Token RS256 chứa claim {@code sid} trong response body.
     * Cấp Refresh Token dạng ngẫu nhiên bảo mật lưu qua Set-Cookie HttpOnly (AUTH-04).
     * 
     * @param request thông tin đăng nhập gồm email và password
     * @param servletRequest đối tượng request lấy User-Agent ghi nhận thông tin thiết bị
     * @param servletResponse đối tượng response để đính kèm header Set-Cookie HttpOnly
     * @return {@link LoginResponse} Access Token và thông tin người dùng
     */
    @PostMapping("/api/identity/auth/login")
    public ResponseEntity<ApiDataResponse<LoginResponse>> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletRequest servletRequest,
            HttpServletResponse servletResponse) {
        String userAgent = servletRequest.getHeader(HttpHeaders.USER_AGENT);
        AuthResult result = authService.login(request, userAgent, clientAddress.resolve(servletRequest));

        // Đính kèm Refresh Token vào Cookie HttpOnly bảo mật
        ResponseCookie cookie = buildRefreshCookie(result.getRefreshToken(), result.getSessionExpiresAt());
        servletResponse.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());

        LoginResponse responseData = LoginResponse.builder()
                .accessToken(result.getAccessToken())
                .tokenType("Bearer")
                .expiresIn(result.getExpiresInSeconds())
                .sessionExpiresAt(result.getSessionExpiresAt())
                .user(result.getUser())
                .build();

        return ResponseEntity.ok(
                new ApiDataResponse<>(
                        true,
                        "Đăng nhập thành công",
                        responseData,
                        null,
                        HttpStatus.OK));
    }

    /**
     * Làm mới Access Token thông qua Refresh Token Rotation (AUTH-05).
     * 
     * <p>Refresh Token được đọc trực tiếp từ HttpOnly Cookie. Token cũ bị đánh dấu đã dùng,
     * token mới được sinh ra và ghi đè vào Set-Cookie.
     * Bắt buộc có CSRF Token hợp lệ (SEC-07).
     * 
     * @param refreshToken giá trị refresh token lấy từ HttpOnly cookie
     * @param servletResponse đối tượng response ghi nhận cookie mới
     * @return {@link TokenRefreshResponse} Access Token mới
     */
    @PostMapping("/api/identity/auth/refresh-token")
    public ResponseEntity<ApiDataResponse<TokenRefreshResponse>> refreshToken(
            @CookieValue(name = "${tasknest.identity.cookie.name:tasknest_refresh}", required = false) String refreshToken,
            HttpServletRequest servletRequest,
            HttpServletResponse servletResponse) {
        if (refreshToken == null || refreshToken.isBlank()) {
            throw new InvalidRefreshTokenException("Refresh token không được để trống");
        }

        AuthResult result = authService.refresh(refreshToken, clientAddress.resolve(servletRequest));

        ResponseCookie cookie = buildRefreshCookie(result.getRefreshToken(), result.getSessionExpiresAt());
        servletResponse.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());

        TokenRefreshResponse responseData = TokenRefreshResponse.builder()
                .accessToken(result.getAccessToken())
                .tokenType("Bearer")
                .expiresIn(result.getExpiresInSeconds())
                .sessionExpiresAt(result.getSessionExpiresAt())
                .build();

        return ResponseEntity.ok(
                new ApiDataResponse<>(
                        true,
                        "Làm mới token thành công",
                        responseData,
                        null,
                        HttpStatus.OK));
    }

    /**
     * Đăng xuất phiên làm việc hiện tại (AUTH-07).
     * 
     * <p>Thu hồi phiên đăng nhập tương ứng trong bảng {@code auth_sessions} và vô hiệu hóa cookie refresh token.
     * Bắt buộc có CSRF Token hợp lệ (SEC-07).
     * 
     * @param refreshToken giá trị refresh token lấy từ cookie để xác định phiên cần thu hồi
     * @param servletResponse đối tượng response ghi nhận Set-Cookie với Max-Age = 0
     * @return thông báo đăng xuất thành công
     */
    @PostMapping("/api/identity/auth/logout")
    public ResponseEntity<ApiDataResponse<Void>> logout(
            @CookieValue(name = "${tasknest.identity.cookie.name:tasknest_refresh}", required = false) String refreshToken,
            HttpServletResponse servletResponse) {
        if (refreshToken != null && !refreshToken.isBlank()) {
            authService.logout(refreshToken);
        }

        // Xóa cookie phía client bằng Max-Age = 0
        ResponseCookie cookie = buildClearRefreshCookie();
        servletResponse.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());

        return ResponseEntity.ok(
                new ApiDataResponse<>(
                        true,
                        "Đăng xuất thành công",
                        null,
                        null,
                        HttpStatus.OK));
    }

    /**
     * Endpoint công khai khóa công khai RSA (RFC 7517 JWK Set) phục vụ Gateway và các Resource Server
     * xác thực chữ ký của Access Token độc lập.
     * 
     * @return JWK Set JSON chứa Public Key RS256
     */
    @GetMapping(value = { "/api/identity/.well-known/jwks.json",
            "/api/identity/auth/.well-known/jwks.json" }, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> getJwks() {
        return ResponseEntity.ok(new JWKSet(rsaKey.toPublicJWK()).toJSONObject());
    }

    /**
     * Helper tạo ResponseCookie an toàn cho Refresh Token:
     * - HttpOnly: Chặn JavaScript truy cập (chống XSS đánh cắp token).
     * - Secure: Chỉ truyền qua kết nối mã hóa (HTTPS trong production).
     * - SameSite: Ngăn chặn gửi kèm trong các request cross-site (chống CSRF).
     * - MaxAge: Hạn định đúng theo thời gian còn lại của phiên 7 ngày tuyệt đối (AUTH-02).
     */
    private ResponseCookie buildRefreshCookie(String tokenValue, Instant sessionExpiresAt) {
        IdentityProperties.Cookie props = identityProperties.getCookie();
        long maxAge = Math.max(0, Duration.between(Instant.now(), sessionExpiresAt).getSeconds());
        return ResponseCookie.from(props.getName(), tokenValue)
                .httpOnly(true)
                .secure(props.isSecure())
                .sameSite(props.getSameSite())
                .path(props.getPath())
                .maxAge(maxAge)
                .build();
    }

    /**
     * Helper tạo Cookie xóa token (Max-Age = 0).
     */
    private ResponseCookie buildClearRefreshCookie() {
        IdentityProperties.Cookie props = identityProperties.getCookie();
        return ResponseCookie.from(props.getName(), "")
                .httpOnly(true)
                .secure(props.isSecure())
                .sameSite(props.getSameSite())
                .path(props.getPath())
                .maxAge(0)
                .build();
    }
}

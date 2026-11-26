package vn.tasknest.identityservice.security;

import java.util.function.Predicate;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import vn.tasknest.identityservice.service.TokenService;

/**
 * Từ chối Access Token có {@code sid} trỏ tới phiên đã bị thu hồi/hết hạn, kể cả khi chữ ký và exp còn hợp lệ.
 * Nhờ đó đăng xuất (hoặc phát hiện replay) vô hiệu hóa ngay quyền của Access Token thuộc phiên đó (AUTH-07).
 */
public class SessionActiveValidator implements OAuth2TokenValidator<Jwt> {

    private static final OAuth2Error SESSION_ERROR =
        new OAuth2Error("invalid_token", "Phiên đăng nhập đã bị thu hồi hoặc hết hạn", null);

    private final Predicate<String> sessionActive;

    public SessionActiveValidator(Predicate<String> sessionActive) {
        this.sessionActive = sessionActive;
    }

    @Override
    public OAuth2TokenValidatorResult validate(Jwt jwt) {
        String sid = jwt.getClaimAsString(TokenService.CLAIM_SESSION_ID);
        if (sid == null || !sessionActive.test(sid)) {
            return OAuth2TokenValidatorResult.failure(SESSION_ERROR);
        }
        return OAuth2TokenValidatorResult.success();
    }
}

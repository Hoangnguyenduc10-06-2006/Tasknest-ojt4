package vn.tasknest.identityservice.service;

import lombok.AllArgsConstructor;
import lombok.Getter;
import java.time.Instant;
import vn.tasknest.identityservice.api.dto.user.response.UserResponse;

/**
 * Kết quả đăng nhập/làm mới ở tầng service. {@code refreshToken} chỉ dành cho controller đặt vào cookie,
 * không được đưa vào body JSON hay log.
 */
@Getter
@AllArgsConstructor
public class AuthResult {

    private final String accessToken;
    private final long expiresInSeconds;
    private final String refreshToken;
    private final Instant sessionExpiresAt;
    private final UserResponse user;
}

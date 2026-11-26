package vn.tasknest.identityservice.api.dto.auth.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import vn.tasknest.identityservice.api.dto.user.response.UserResponse;

/** Refresh Token không nằm trong JSON: chỉ được đặt qua cookie HttpOnly (AUTH-04). */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LoginResponse {

    private java.time.Instant sessionExpiresAt;
    private String accessToken;
    @Builder.Default
    private String tokenType = "Bearer";
    private Long expiresIn;
    private UserResponse user;
}

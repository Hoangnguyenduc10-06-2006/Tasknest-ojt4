package vn.tasknest.identityservice.api.dto.auth.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Refresh Token mới chỉ được trả qua Set-Cookie HttpOnly, không có trong JSON (AUTH-04). */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TokenRefreshResponse {

    private java.time.Instant sessionExpiresAt;
    private String accessToken;
    @Builder.Default
    private String tokenType = "Bearer";
    private Long expiresIn;
}

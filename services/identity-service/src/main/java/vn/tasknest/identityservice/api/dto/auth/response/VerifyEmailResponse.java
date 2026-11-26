package vn.tasknest.identityservice.api.dto.auth.response;

import java.time.ZonedDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VerifyEmailResponse {

    private String email;
    private boolean verified;
    private String message;
    private ZonedDateTime verifiedAt;
}

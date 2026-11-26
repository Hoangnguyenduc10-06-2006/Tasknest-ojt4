package vn.tasknest.identityservice.api.dto.auth.request;


import jakarta.validation.constraints.NotBlank;
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
public class ResendVerificationEmailRequest {

    @NotBlank(message = "Email không được để trống")
    @vn.tasknest.identityservice.api.validation.AccountEmail
    private String email;
}

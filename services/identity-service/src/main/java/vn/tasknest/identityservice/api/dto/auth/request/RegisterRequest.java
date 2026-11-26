package vn.tasknest.identityservice.api.dto.auth.request;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RegisterRequest {

    @NotBlank(message = "Họ tên không được để trống")
    private String fullName;

    @NotBlank(message = "Email không được để trống")
    @vn.tasknest.identityservice.api.validation.AccountEmail
    private String email;

    @NotBlank(message = "Mật khẩu không được để trống")
    private String password;

    @NotBlank(message = "Xác nhận mật khẩu không được để trống")
    private String confirmPassword;

    @jakarta.validation.constraints.Pattern(regexp="UNDECIDED|CLIENT|DEVELOPER|BOTH", message="Mục đích sử dụng không hợp lệ")
    private String accountPurpose;

    public RegisterRequest(String fullName, String email, String password, String confirmPassword) {
        this(fullName,email,password,confirmPassword,null);
    }
}

package vn.tasknest.identityservice.api.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import vn.tasknest.identityservice.api.dto.common.response.ApiDataResponse;
import vn.tasknest.identityservice.service.*;
import vn.tasknest.identityservice.security.ClientAddress;
import vn.tasknest.identityservice.exception.RateLimitExceededException;

@RestController @RequestMapping("/api/identity/auth")
public class AccountSecurityController {
    private final AccountSecurityService service;
    private final AuthRateLimitService limits;
    private final ClientAddress addresses;
    public AccountSecurityController(AccountSecurityService service, AuthRateLimitService limits, ClientAddress addresses) { this.service=service;this.limits=limits;this.addresses=addresses; }
    public record Email(@NotBlank @Size(max=255) String email) {}
    public record Reset(@NotBlank @Size(max=200) String token,@NotBlank @Size(max=100) String newPassword,@NotBlank @Size(max=100) String confirmPassword) {}
    public record Change(@NotBlank @Size(max=100) String currentPassword,@NotBlank @Size(max=100) String newPassword,@NotBlank @Size(max=100) String confirmPassword) {}
    private <T> ApiDataResponse<T> ok(String message,T data) { return new ApiDataResponse<>(true,message,data,null,HttpStatus.OK); }
    private void budget(String action,HttpServletRequest request) { long delay=limits.consumeMailRequest(action,addresses.resolve(request)); if(delay>0) throw new RateLimitExceededException("Quá nhiều yêu cầu. Vui lòng thử lại sau.",delay); }
    @PostMapping("/forgot-password") public ApiDataResponse<Void> forgot(@Valid @RequestBody Email body,HttpServletRequest request) { budget("PASSWORD_RESET",request);service.requestReset(body.email());return ok("Nếu tài khoản đủ điều kiện, hướng dẫn đặt lại mật khẩu sẽ được gửi qua email.",null); }
    @PostMapping("/reset-password") public ApiDataResponse<Void> reset(@Valid @RequestBody Reset body,HttpServletRequest request) { budget("RESET_ATTEMPT",request);service.reset(body.token(),body.newPassword(),body.confirmPassword());return ok("Đã đặt lại mật khẩu. Vui lòng đăng nhập lại trên các thiết bị.",null); }
    @PostMapping("/change-password") public ApiDataResponse<Void> change(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody Change body) { long delay=limits.consumeProfile(jwt.getSubject());if(delay>0)throw new RateLimitExceededException("Vui lòng thử lại sau.",delay);service.change(jwt.getSubject(),body.currentPassword(),body.newPassword(),body.confirmPassword());return ok("Đã đổi mật khẩu và thu hồi các phiên đăng nhập.",null); }
    @GetMapping("/sessions") public ApiDataResponse<Map<String,Object>> sessions(@AuthenticationPrincipal Jwt jwt) { return ok("Các phiên đăng nhập của bạn.",Map.of("currentSessionId",jwt.getClaimAsString("sid"),"items",service.sessions(jwt.getSubject()))); }
    @PostMapping("/sessions/{id}/revoke") public ApiDataResponse<Void> revoke(@AuthenticationPrincipal Jwt jwt,@PathVariable String id) { service.revoke(jwt.getSubject(),id);return ok("Đã thu hồi phiên.",null); }
    @PostMapping("/logout-all") public ApiDataResponse<Void> all(@AuthenticationPrincipal Jwt jwt) { service.revokeAll(jwt.getSubject(),"LOGOUT_ALL");return ok("Đã đăng xuất tất cả thiết bị.",null); }
}

package vn.tasknest.identityservice.api.controller;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import vn.tasknest.identityservice.api.dto.user.request.UpdateProfileRequest;
import vn.tasknest.identityservice.api.dto.user.response.UserResponse;
import vn.tasknest.identityservice.api.dto.common.response.ApiDataResponse;
import vn.tasknest.identityservice.service.ProfileService;
import vn.tasknest.identityservice.service.AuthRateLimitService;
import vn.tasknest.identityservice.exception.RateLimitExceededException;

@RestController
@RequestMapping("/api/identity/profile")
public class ProfileController {
    private final ProfileService profiles;
    private final AuthRateLimitService limits;
    public ProfileController(ProfileService profiles, AuthRateLimitService limits) { this.profiles=profiles; this.limits=limits; }
    @PutMapping
    public ApiDataResponse<UserResponse> update(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody UpdateProfileRequest request) {
        long retry=limits.consumeProfile(jwt.getSubject());
        if (retry>0) throw new RateLimitExceededException("Quá nhiều lần cập nhật hồ sơ. Vui lòng thử lại sau.",retry);
        return new ApiDataResponse<>(true,"Đã lưu hồ sơ",profiles.update(jwt.getSubject(),request),null,HttpStatus.OK);
    }
    @GetMapping("/avatar")
    public ResponseEntity<byte[]> avatar(@AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok().contentType(MediaType.IMAGE_PNG).cacheControl(CacheControl.noStore())
            .header("X-Content-Type-Options","nosniff").body(profiles.avatar(jwt.getSubject()));
    }
    public record Cover(@NotBlank @Size(max=6990508) String imageBase64, boolean visible) {}

    @GetMapping("/cover")
    public ResponseEntity<byte[]> cover(@AuthenticationPrincipal Jwt jwt) {
        return coverResponse(profiles.cover(jwt.getSubject(),false));
    }

    @PutMapping("/cover")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void saveCover(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody Cover cover) {
        checkCoverBudget(jwt);
        profiles.saveCover(jwt.getSubject(),cover.imageBase64(),cover.visible());
    }

    @DeleteMapping("/cover")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeCover(@AuthenticationPrincipal Jwt jwt) {
        checkCoverBudget(jwt);
        profiles.removeCover(jwt.getSubject());
    }

    static ResponseEntity<byte[]> coverResponse(byte[] bytes) {
        return ResponseEntity.ok().contentType(MediaType.IMAGE_PNG).cacheControl(CacheControl.noStore())
            .header("X-Content-Type-Options","nosniff").body(bytes);
    }

    private void checkCoverBudget(Jwt jwt) {
        long retry=limits.consumeProfile(jwt.getSubject());
        if (retry>0) throw new RateLimitExceededException("Quá nhiều lần cập nhật hồ sơ. Vui lòng thử lại sau.",retry);
    }
}

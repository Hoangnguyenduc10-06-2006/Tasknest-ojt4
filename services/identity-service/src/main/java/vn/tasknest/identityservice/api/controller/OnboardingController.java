package vn.tasknest.identityservice.api.controller;

import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import vn.tasknest.identityservice.api.dto.common.response.ApiDataResponse;
import vn.tasknest.identityservice.exception.RateLimitExceededException;
import vn.tasknest.identityservice.service.*;

@RestController
public class OnboardingController {
    private final OnboardingService onboarding;
    private final ProfileService profiles;
    private final AuthRateLimitService limits;
    public OnboardingController(OnboardingService onboarding,ProfileService profiles,AuthRateLimitService limits){this.onboarding=onboarding;this.profiles=profiles;this.limits=limits;}
    @GetMapping("/api/identity/onboarding")
    public ApiDataResponse<OnboardingService.State> get(@AuthenticationPrincipal Jwt jwt){return new ApiDataResponse<>(true,"Thiết lập tài khoản",onboarding.get(jwt.getSubject()),null,HttpStatus.OK);}
    @PutMapping("/api/identity/onboarding")
    public ApiDataResponse<OnboardingService.State> save(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody OnboardingService.Input input){
        long retry=limits.consumeOnboarding(jwt.getSubject());
        if(retry>0)throw new RateLimitExceededException("Quá nhiều lần lưu thiết lập. Vui lòng thử lại sau.",retry);
        return new ApiDataResponse<>(true,"Đã lưu thiết lập",onboarding.save(jwt.getSubject(),input),null,HttpStatus.OK);
    }
    @GetMapping("/api/identity/public/avatars/{id}")
    public ResponseEntity<byte[]> avatar(@PathVariable UUID id){return ResponseEntity.ok().contentType(MediaType.IMAGE_PNG).cacheControl(CacheControl.noStore()).header("X-Content-Type-Options","nosniff").body(profiles.publicAvatar(id.toString()));}
    @GetMapping("/api/identity/public/covers/{id}")
    public ResponseEntity<byte[]> cover(@PathVariable UUID id) {
        return ProfileController.coverResponse(profiles.cover(id.toString(),true));
    }
}

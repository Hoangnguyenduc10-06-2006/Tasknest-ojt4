package vn.tasknest.identityservice.api.controller;

import java.util.UUID;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import vn.tasknest.identityservice.service.ProfileService;

@RestController
public class InternalAvatarController {
    private final ProfileService profiles;
    public InternalAvatarController(ProfileService profiles) { this.profiles=profiles; }
    @GetMapping("/internal/identity/profiles/{id}/avatar")
    public ResponseEntity<byte[]> avatar(@PathVariable UUID id) {
        return ResponseEntity.ok().contentType(MediaType.IMAGE_PNG).cacheControl(CacheControl.noStore())
            .header("X-Content-Type-Options","nosniff").body(profiles.avatar(id.toString()));
    }
}

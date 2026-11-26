package vn.tasknest.workservice.api.community;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.tasknest.workservice.api.WorkResponse;
import vn.tasknest.workservice.application.WorkException;
import vn.tasknest.workservice.application.community.ProfessionalProfileService;
import vn.tasknest.workservice.application.security.*;

@RestController
@RequestMapping("/api/work/community/profile")
public class ProfessionalProfileController {
    private final ProfessionalProfileService profiles;
    private final WorkRequestBudget budget;
    public ProfessionalProfileController(ProfessionalProfileService profiles, WorkRequestBudget budget) {
        this.profiles = profiles;
        this.budget = budget;
    }
    public record Portfolio(@NotBlank @Size(max=120) String title, @NotBlank @Size(max=100) String role,
            @NotNull @Size(max=800) String description, @Size(max=2048) String url) {}
    public record Input(@NotNull @Size(max=150) String headline, @NotNull @Size(max=2000) String about,
            @NotNull @Size(max=100) String location, @Min(0) @Max(50) Integer experienceYears,
            @NotNull @Size(max=20) List<@NotBlank @Size(max=40) String> skills,
            @NotNull @Size(max=8) List<@NotBlank @Size(max=60) String> desiredRoles,
            @NotNull @Size(max=3) Set<@NotBlank String> collaborationModes,
            @NotBlank String availability, @Min(1) @Max(80) Integer weeklyHours,
            @Size(max=2048) String githubUrl, @Size(max=2048) String linkedinUrl, @Size(max=2048) String websiteUrl,
            @Email @Size(max=254) String contactEmail, @Size(max=2048) String socialUrl,
            @NotNull @Size(max=6) List<@NotNull @Valid Portfolio> portfolioItems, @NotNull Boolean isPublic, @PositiveOrZero Long version) {
        ProfessionalProfileService.Input value() {
            return new ProfessionalProfileService.Input(headline,about,location,experienceYears,skills,desiredRoles,
                collaborationModes,availability,weeklyHours,githubUrl,linkedinUrl,websiteUrl,contactEmail,socialUrl,
                portfolioItems.stream().map(p -> new ProfessionalProfileService.Portfolio(p.title(),p.role(),p.description(),p.url())).toList(),
                isPublic,version);
        }
    }
    @GetMapping
    public WorkResponse<Map<String,Object>> own(@AuthenticationPrincipal WorkActor actor) {
        return WorkResponse.read(profiles.own(actor));
    }
    @PutMapping
    public WorkResponse<Map<String,Object>> save(@AuthenticationPrincipal WorkActor actor, @Valid @RequestBody Input input) {
        if (!budget.consume(actor.userId(),"COMMUNITY",30)) {
            throw new WorkException(HttpStatus.TOO_MANY_REQUESTS,"RATE_LIMIT","Quá nhiều thao tác. Vui lòng thử lại sau.");
        }
        return WorkResponse.ok("Đã lưu hồ sơ nghề nghiệp.", profiles.save(actor,input.value()));
    }
}

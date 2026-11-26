package vn.tasknest.workservice.api.project;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.tasknest.workservice.api.WorkResponse;
import vn.tasknest.workservice.application.members.ProjectMembersService;
import vn.tasknest.workservice.application.security.WorkActor;

@RestController
@RequestMapping("/api/work/projects/{projectId}")
public class ProjectMembersController {
    private final ProjectMembersService members;
    public ProjectMembersController(ProjectMembersService members) { this.members = members; }
    public record Invite(@NotBlank @Email @Size(max=255) String email) {
        public Invite { email = email == null ? null : email.strip().toLowerCase(java.util.Locale.ROOT); }
    }
    public record Decision(@NotNull Boolean accept) {}
    public record Role(@NotNull @Pattern(regexp="Manager|Member") String role) {}
    public record LinkAction(@NotNull @Pattern(regexp="CREATE|ROTATE|DISABLE") String action) {}
    @GetMapping("/members")
    public WorkResponse<ProjectMembersService.Snapshot> list(@AuthenticationPrincipal WorkActor actor, @PathVariable Long projectId,
            @RequestParam(defaultValue="members") String tab, @RequestParam(defaultValue="0") int page, @RequestParam(defaultValue="20") int size) {
        return WorkResponse.read(members.list(actor, projectId, tab, page, size));
    }
    @PostMapping("/invitations")
    @ResponseStatus(org.springframework.http.HttpStatus.CREATED)
    public WorkResponse<Long> invite(@AuthenticationPrincipal WorkActor actor, @PathVariable Long projectId, @Valid @RequestBody Invite input) {
        return WorkResponse.created("Đã tạo lời mời. Email sẽ được xử lý trong hàng đợi.", members.invite(actor, projectId, input.email()));
    }
    @PutMapping("/invitations/{id}/cancel")
    public WorkResponse<Void> cancel(@AuthenticationPrincipal WorkActor actor,@PathVariable Long projectId,@PathVariable Long id) {
        members.cancel(actor,projectId,id); return WorkResponse.ok("Đã hủy lời mời.",null);
    }
    @PutMapping("/join-requests/{id}/decision")
    public WorkResponse<Void> decide(@AuthenticationPrincipal WorkActor actor,@PathVariable Long projectId,@PathVariable Long id,@Valid @RequestBody Decision input) {
        members.decide(actor,projectId,id,input.accept()); return WorkResponse.ok("Đã xử lý yêu cầu.",null);
    }
    @PutMapping("/members/{userId}/role")
    public WorkResponse<Void> role(@AuthenticationPrincipal WorkActor actor,@PathVariable Long projectId,@PathVariable String userId,@Valid @RequestBody Role input) {
        members.role(actor,projectId,userId,input.role()); return WorkResponse.ok("Đã cập nhật vai trò.",null);
    }
    @PutMapping("/members/{userId}/remove")
    public WorkResponse<Void> remove(@AuthenticationPrincipal WorkActor actor,@PathVariable Long projectId,@PathVariable String userId) {
        members.remove(actor,projectId,userId); return WorkResponse.ok("Đã xóa thành viên khỏi dự án.",null);
    }
    @GetMapping("/invitation-link")
    public WorkResponse<ProjectMembersService.Link> link(@AuthenticationPrincipal WorkActor actor,@PathVariable Long projectId) {
        return WorkResponse.read(members.link(actor,projectId));
    }
    @PutMapping("/invitation-link")
    public WorkResponse<ProjectMembersService.Link> updateLink(@AuthenticationPrincipal WorkActor actor,@PathVariable Long projectId,@Valid @RequestBody LinkAction input) {
        return WorkResponse.ok("Đã cập nhật liên kết.",members.changeLink(actor,projectId,input.action()));
    }
}

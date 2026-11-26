package vn.tasknest.workservice.api.workspace;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import vn.tasknest.workservice.api.WorkResponse;
import vn.tasknest.workservice.application.security.WorkActor;
import vn.tasknest.workservice.application.workspace.WorkspaceWriteService;
@RestController @RequestMapping("/api/work/projects/workspace")
public class JoinLinkController {
    private final WorkspaceWriteService writing;
    public JoinLinkController(WorkspaceWriteService writing) { this.writing=writing; }
    @GetMapping("/join-links/{code}") public WorkResponse<WorkspaceWriteService.JoinLink> preview(@AuthenticationPrincipal WorkActor actor,@PathVariable String code) { return WorkResponse.read(writing.link(actor,code)); }
    public record Join(@NotBlank @Pattern(regexp="[0-9a-f]{64}") String code,@Size(max=500) String reason) {}
    @PostMapping("/join-requests") @ResponseStatus(org.springframework.http.HttpStatus.CREATED) public WorkResponse<Long> join(@AuthenticationPrincipal WorkActor actor,@Valid @RequestBody Join request) { return WorkResponse.created("Yêu cầu đã được gửi và đang chờ duyệt.",writing.join(actor,request.code(),request.reason())); }
}

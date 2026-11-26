package vn.tasknest.workservice.api.workspace;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.tasknest.workservice.api.WorkResponse;
import vn.tasknest.workservice.application.security.WorkActor;
import vn.tasknest.workservice.application.workspace.ReadWorkspaceService;
@RestController
@RequestMapping("/api/work/projects/workspace")
public class WorkspaceController {
    private final ReadWorkspaceService reading;
    public WorkspaceController(ReadWorkspaceService reading) { this.reading = reading; }
    @GetMapping public WorkResponse<WorkspaceResponse> read(@AuthenticationPrincipal WorkActor actor) {
        return WorkResponse.ok("Tải dữ liệu làm việc thành công.",reading.read(actor));
    }
}

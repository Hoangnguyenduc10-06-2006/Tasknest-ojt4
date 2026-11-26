package vn.tasknest.workservice.api.workspace;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.List;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.tasknest.workservice.api.WorkResponse;
import vn.tasknest.workservice.application.security.WorkActor;
import vn.tasknest.workservice.application.workspace.TaskOrganizationService;
@RestController
@RequestMapping("/api/work/projects/{project}/tasks/{task}/organization")
public class TaskOrganizationController {
    private final TaskOrganizationService service;
    public TaskOrganizationController(TaskOrganizationService service){this.service=service;}
    public record Input(@PositiveOrZero long version,@NotNull @Size(max=100) List<TaskOrganizationService.Item> checklist,@NotNull @Size(max=5) List<@NotBlank String> tags){}
    @GetMapping public WorkResponse<TaskOrganizationService.Snapshot> read(@AuthenticationPrincipal WorkActor actor,@PathVariable long project,@PathVariable long task){return WorkResponse.read(service.read(actor,project,task));}
    @PutMapping public WorkResponse<TaskOrganizationService.Snapshot> save(@AuthenticationPrincipal WorkActor actor,@PathVariable long project,@PathVariable long task,@Valid @RequestBody Input input){return WorkResponse.ok("Đã cập nhật checklist và nhãn.",service.save(actor,project,task,input.version(),input.checklist(),input.tags()));}
}

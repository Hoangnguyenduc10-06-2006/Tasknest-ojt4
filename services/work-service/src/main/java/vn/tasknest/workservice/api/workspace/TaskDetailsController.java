package vn.tasknest.workservice.api.workspace;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.tasknest.workservice.application.security.WorkActor;
import vn.tasknest.workservice.application.workspace.TaskDetailsService;
import vn.tasknest.workservice.api.WorkResponse;
@RestController @RequestMapping("/api/work/projects/{projectId}/tasks/{taskId}")
public class TaskDetailsController {
    private final TaskDetailsService service;
    public TaskDetailsController(TaskDetailsService service){this.service=service;}
    public record Update(@NotNull @PositiveOrZero Long version,@NotNull @Valid CreateTaskRequest task){}
    public record Block(@NotNull @PositiveOrZero Long version,boolean blocked,@NotBlank @Size(max=2000) String reason){}
    @PutMapping public WorkResponse<Void> update(@AuthenticationPrincipal WorkActor actor,@PathVariable long projectId,@PathVariable long taskId,@Valid @RequestBody Update input){service.update(actor,projectId,taskId,input.version(),input.task());return WorkResponse.ok("Đã lưu nhiệm vụ.",null);}
    @PutMapping("/blocked") public WorkResponse<Void> blocked(@AuthenticationPrincipal WorkActor actor,@PathVariable long projectId,@PathVariable long taskId,@Valid @RequestBody Block input){service.block(actor,projectId,taskId,input.version(),input.blocked(),input.reason());return WorkResponse.ok("Đã cập nhật cờ bị chặn.",null);}
    @GetMapping("/history") public WorkResponse<List<Map<String,Object>>> history(@AuthenticationPrincipal WorkActor actor,@PathVariable long projectId,@PathVariable long taskId){return WorkResponse.read(service.history(actor,projectId,taskId));}
}

package vn.tasknest.workservice.api.workspace;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.tasknest.workservice.api.WorkResponse;
import vn.tasknest.workservice.application.security.WorkActor;
import vn.tasknest.workservice.application.workspace.WorkspaceWriteService;
@RestController @RequestMapping("/api/work/projects/{projectId}")
public class WorkspaceWriteController {
    private final WorkspaceWriteService writing;
    private final vn.tasknest.workservice.application.workspace.TaskWorkflowService workflow;
    public WorkspaceWriteController(WorkspaceWriteService writing, vn.tasknest.workservice.application.workspace.TaskWorkflowService workflow) { this.writing=writing; this.workflow=workflow; }
    @PostMapping("/tasks") @ResponseStatus(org.springframework.http.HttpStatus.CREATED) public WorkResponse<Long> create(@AuthenticationPrincipal WorkActor actor,@PathVariable Long projectId,@Valid @RequestBody CreateTaskRequest request) {
        return WorkResponse.created("Tạo nhiệm vụ thành công.",writing.createTask(actor,projectId,request));
    }
    public record Version(@NotNull @PositiveOrZero Long version) {}
    @PutMapping("/tasks/{taskId}/start") public WorkResponse<Void> start(@AuthenticationPrincipal WorkActor actor,@PathVariable Long projectId,@PathVariable Long taskId,@Valid @RequestBody Version request) {
        workflow.transition(actor,projectId,taskId,request.version(),"IN_PROGRESS",null,false); return WorkResponse.ok("Thao tác thành công.",null);
    }
    @GetMapping("/tasks/{taskId}/submission") public WorkResponse<vn.tasknest.workservice.application.workspace.TaskWorkflowService.Submission> submission(@AuthenticationPrincipal WorkActor actor,@PathVariable Long projectId,@PathVariable Long taskId) {
        return WorkResponse.ok("Đã tải kết quả lần nộp gần nhất.",workflow.latestSubmission(actor,projectId,taskId));
    }
    public record Transition(@NotNull @PositiveOrZero Long version,
        @NotNull @Pattern(regexp="IN_PROGRESS|REVIEW|DONE|CANCELLED") String status,
        @Size(max=4000) String note, boolean confirmed, java.time.LocalDate deadlineOn, @Positive Long estimatedSeconds, @Size(max=2048) String resultUrl, @Positive Long resultFileId) {}
    @PutMapping("/tasks/{taskId}/status") public WorkResponse<Void> transition(@AuthenticationPrincipal WorkActor actor,@PathVariable Long projectId,@PathVariable Long taskId,@Valid @RequestBody Transition request) {
        workflow.transition(actor,projectId,taskId,request.version(),request.status(),request.note(),request.confirmed(),request.deadlineOn(),request.estimatedSeconds(),request.resultUrl(),request.resultFileId());
        return WorkResponse.ok("Đã cập nhật trạng thái nhiệm vụ.",null);
    }
    @PostMapping("/tasks/{taskId}/timer") @ResponseStatus(org.springframework.http.HttpStatus.CREATED) public WorkResponse<Long> timer(@AuthenticationPrincipal WorkActor actor,@PathVariable Long projectId,@PathVariable Long taskId) {
        return WorkResponse.created("Đã bắt đầu ghi giờ.",writing.startTimer(actor,projectId,taskId));
    }
    @PutMapping("/time-entries/{entryId}/stop") public WorkResponse<Void> stop(@AuthenticationPrincipal WorkActor actor,@PathVariable Long projectId,@PathVariable Long entryId) {
        writing.stopTimer(actor,projectId,entryId); return WorkResponse.ok("Thao tác thành công.",null);
    }
    @PutMapping("/invitations/{id}/accept") public WorkResponse<Void> accept(@AuthenticationPrincipal WorkActor actor,@PathVariable Long projectId,@PathVariable Long id) {
        writing.invitation(actor,projectId,id,true); return WorkResponse.ok("Thao tác thành công.",null);
    }
    @PutMapping("/invitations/{id}/decline") public WorkResponse<Void> decline(@AuthenticationPrincipal WorkActor actor,@PathVariable Long projectId,@PathVariable Long id) {
        writing.invitation(actor,projectId,id,false); return WorkResponse.ok("Thao tác thành công.",null);
    }
    @PutMapping("/join-requests/{id}/cancel") public WorkResponse<Void> cancel(@AuthenticationPrincipal WorkActor actor,@PathVariable Long projectId,@PathVariable Long id) {
        writing.cancelRequest(actor,projectId,id); return WorkResponse.ok("Thao tác thành công.",null);
    }
}

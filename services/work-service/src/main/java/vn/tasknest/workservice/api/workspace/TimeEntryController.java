package vn.tasknest.workservice.api.workspace;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.List;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.tasknest.workservice.api.WorkResponse;
import vn.tasknest.workservice.application.security.WorkActor;
import vn.tasknest.workservice.application.workspace.TimeEntryService;

@RestController
@RequestMapping("/api/work/projects")
public class TimeEntryController {
    private final TimeEntryService time;
    public TimeEntryController(TimeEntryService time) { this.time = time; }
    public record Manual(@NotNull Instant startedAt, @NotNull Instant endedAt, @NotBlank @Size(max=4000) String reason) {}
    public record Edit(@NotNull @PositiveOrZero Long version, @NotNull Instant startedAt, @NotNull Instant endedAt, @NotBlank @Size(max=4000) String reason) {}
    @PostMapping("/{projectId}/tasks/{taskId}/time-entries")
    @ResponseStatus(org.springframework.http.HttpStatus.CREATED)
    public WorkResponse<Long> add(@AuthenticationPrincipal WorkActor actor, @PathVariable Long projectId, @PathVariable Long taskId, @Valid @RequestBody Manual request) {
        return WorkResponse.created("Đã bổ sung giờ.",time.add(actor,projectId,taskId,request.startedAt(),request.endedAt(),request.reason()));
    }
    @PutMapping("/{projectId}/time-entries/{entryId}")
    public WorkResponse<Void> edit(@AuthenticationPrincipal WorkActor actor, @PathVariable Long projectId, @PathVariable Long entryId, @Valid @RequestBody Edit request) {
        time.edit(actor,projectId,entryId,request.version(),request.startedAt(),request.endedAt(),request.reason());
        return WorkResponse.ok("Đã cập nhật phiên ghi giờ.",null);
    }
    @GetMapping("/workspace/time-revisions")
    public WorkResponse<List<TimeEntryService.Revision>> revisions(@AuthenticationPrincipal WorkActor actor) {
        return WorkResponse.ok("Đã tải lịch sử điều chỉnh giờ.",time.revisions(actor));
    }
}

package vn.tasknest.workservice.api.submission;

import jakarta.validation.Valid;
import java.nio.charset.StandardCharsets;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.tasknest.workservice.api.PageResponse;
import vn.tasknest.workservice.api.WorkResponse;
import vn.tasknest.workservice.application.security.WorkActor;
import vn.tasknest.workservice.application.submission.TaskSubmissionHistoryService;

@RestController
@RequestMapping("/api/work/projects/{projectId}/tasks/{taskId}/submissions")
public class TaskSubmissionHistoryController {
    private final TaskSubmissionHistoryService history;

    public TaskSubmissionHistoryController(TaskSubmissionHistoryService history) {
        this.history = history;
    }

    @GetMapping
    public ResponseEntity<WorkResponse<PageResponse<TaskSubmissionResponse>>> list(@AuthenticationPrincipal WorkActor actor,
            @PathVariable long projectId, @PathVariable long taskId, @Valid @ModelAttribute SubmissionHistoryQuery query) {
        return ResponseEntity.ok().header(HttpHeaders.CACHE_CONTROL, "private, no-store")
            .body(WorkResponse.ok("Đã tải lịch sử nộp và duyệt.", history.list(actor, projectId, taskId, query)));
    }

    @GetMapping("/{submissionId}/file")
    public ResponseEntity<byte[]> file(@AuthenticationPrincipal WorkActor actor, @PathVariable long projectId,
            @PathVariable long taskId, @PathVariable long submissionId) {
        var file = history.download(actor, projectId, taskId, submissionId);
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(file.mime()))
            .header(HttpHeaders.CACHE_CONTROL, "private, no-store")
            .header("X-Content-Type-Options", "nosniff")
            .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                .filename(file.name(), StandardCharsets.UTF_8).build().toString())
            .body(file.bytes());
    }
}

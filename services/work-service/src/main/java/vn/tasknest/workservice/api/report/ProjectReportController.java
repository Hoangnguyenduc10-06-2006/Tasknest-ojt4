package vn.tasknest.workservice.api.report;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.tasknest.workservice.application.report.ProjectReportService;
import vn.tasknest.workservice.application.report.ProjectReportService.ReportType;
import vn.tasknest.workservice.application.security.WorkActor;

@RestController
@RequestMapping("/api/work/projects/{projectId}/reports")
public class ProjectReportController {
    private final ProjectReportService reports;

    public ProjectReportController(ProjectReportService reports) {
        this.reports = reports;
    }

    @GetMapping("/export")
    public ResponseEntity<byte[]> export(@AuthenticationPrincipal WorkActor actor, @PathVariable long projectId,
            @RequestParam ReportType type, @RequestParam LocalDate from, @RequestParam LocalDate to) {
        var file = reports.export(actor, projectId, type, from, to);
        return ResponseEntity.ok()
            .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
            .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(file.filename()).build().toString())
            .header(HttpHeaders.CACHE_CONTROL, "no-store")
            .header("X-Content-Type-Options", "nosniff")
            .body(file.content());
    }
}

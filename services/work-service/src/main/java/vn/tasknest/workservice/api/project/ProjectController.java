package vn.tasknest.workservice.api.project;

import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.tasknest.workservice.api.ApiDataResponse;
import vn.tasknest.workservice.api.PageResponse;
import vn.tasknest.workservice.api.WorkResponse;
import vn.tasknest.workservice.application.project.ArchiveProjectService;
import vn.tasknest.workservice.application.project.CreateProjectService;
import vn.tasknest.workservice.application.project.ProjectQueryService;
import vn.tasknest.workservice.application.project.ReadProjectService;
import vn.tasknest.workservice.application.project.UpdateProjectService;
import vn.tasknest.workservice.application.security.WorkActor;

@RestController
@RequestMapping("/api/work/projects")
public class ProjectController {
    private final CreateProjectService creation;
    private final UpdateProjectService updating;
    private final ArchiveProjectService archiving;
    private final ProjectQueryService queries;
    private final ReadProjectService reading;

    public ProjectController(CreateProjectService creation, UpdateProjectService updating, ProjectQueryService queries, ReadProjectService reading, ArchiveProjectService archiving) {
        this.archiving = archiving;
        this.creation = creation;
        this.updating = updating;
        this.queries = queries;
        this.reading = reading;
    }

    @PostMapping
    public ResponseEntity<WorkResponse<ProjectResponse>> create(@AuthenticationPrincipal WorkActor actor,
            @Valid @RequestBody CreateProjectRequest request) {
        ProjectResponse result = creation.create(actor, request);
        return ResponseEntity.created(URI.create("/api/work/projects/" + result.id()))
                .body(WorkResponse.created(result));
    }

    @GetMapping
    public ResponseEntity<ApiDataResponse<PageResponse<ProjectResponse>>> list(
            @AuthenticationPrincipal WorkActor actor,
            @Valid @ModelAttribute ProjectListQuery query) {
        PageResponse<ProjectResponse> result = queries.list(actor, query);
        return ResponseEntity.ok(new ApiDataResponse<>(true,
                "Lấy danh sách dự án thành công.", result, null, HttpStatus.OK));
    }

    @GetMapping("/index")
    public WorkResponse<List<ProjectResponse>> index(@AuthenticationPrincipal WorkActor actor) {
        return WorkResponse.read(reading.list(actor));
    }

    @GetMapping("/{projectId}")
    public ResponseEntity<ApiDataResponse<ProjectResponse>> getDetail(
            @AuthenticationPrincipal WorkActor actor,
            @PathVariable Long projectId) {
        ProjectResponse result = queries.getDetail(actor, projectId);
        return ResponseEntity.ok(new ApiDataResponse<>(true,
                "Lấy thông tin dự án thành công.", result, null, HttpStatus.OK));
    }

    @PutMapping("/{projectId}")
    public ResponseEntity<WorkResponse<ProjectResponse>> update(@AuthenticationPrincipal WorkActor actor,
            @PathVariable Long projectId, @Valid @RequestBody UpdateProjectRequest request) {
        ProjectResponse result = updating.update(actor, projectId, request);
        return ResponseEntity.ok(WorkResponse.updated(result));
    }
    @PostMapping("/{projectId}/archive")
    public ResponseEntity<WorkResponse<ProjectResponse>> archive(@AuthenticationPrincipal WorkActor actor,
            @PathVariable Long projectId, @Valid @RequestBody ProjectStatusChangeRequest request) {
        ProjectResponse result = archiving.archive(actor, projectId, request);
        return ResponseEntity.ok(WorkResponse.archived(result));
    }
    @PostMapping("/{projectId}/reopen")
    public ResponseEntity<WorkResponse<ProjectResponse>> reopen(@AuthenticationPrincipal WorkActor actor,
            @PathVariable Long projectId, @Valid @RequestBody ProjectStatusChangeRequest request) {
        ProjectResponse result = archiving.reopen(actor, projectId, request);
        return ResponseEntity.ok(WorkResponse.reopened(result));
    }
}

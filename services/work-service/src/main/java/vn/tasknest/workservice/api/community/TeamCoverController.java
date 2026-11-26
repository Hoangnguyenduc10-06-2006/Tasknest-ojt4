package vn.tasknest.workservice.api.community;

import java.io.IOException;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import vn.tasknest.workservice.api.WorkResponse;
import vn.tasknest.workservice.application.WorkException;
import vn.tasknest.workservice.application.collaboration.FileValidation;
import vn.tasknest.workservice.application.security.ProjectPermissionService;
import vn.tasknest.workservice.application.security.WorkActor;
import vn.tasknest.workservice.application.security.WorkRequestBudget;

@RestController
@RequestMapping("/api/work/community/teams/{team}/cover")
public class TeamCoverController {
    private final JdbcTemplate db;
    private final ProjectPermissionService permissions;
    private final WorkRequestBudget budget;

    public TeamCoverController(JdbcTemplate db, ProjectPermissionService permissions, WorkRequestBudget budget) {
        this.db = db;
        this.permissions = permissions;
        this.budget = budget;
    }

    @GetMapping
    public ResponseEntity<byte[]> get(@PathVariable long team) {
        return db.query("SELECT mime_type,image_data FROM dev_team_covers WHERE team_id=?",
            (row, index) -> ResponseEntity.ok().contentType(MediaType.parseMediaType(row.getString(1)))
                .cacheControl(CacheControl.noStore()).header("X-Content-Type-Options", "nosniff").body(row.getBytes(2)),
            team).stream().findFirst().orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Transactional
    public WorkResponse<Void> save(@PathVariable long team, @AuthenticationPrincipal WorkActor actor,
                                   @RequestParam MultipartFile file) throws IOException {
        requireOwner(team, actor);
        if (file.isEmpty() || file.getSize() > 5 * 1024 * 1024)
            throw new WorkException(HttpStatus.BAD_REQUEST, "INVALID_TEAM_COVER", "Chọn ảnh PNG hoặc JPG tối đa 5 MB.");
        byte[] bytes = file.getBytes();
        String mime = FileValidation.validate(file.getOriginalFilename(), bytes, true);
        db.update("""
            INSERT INTO dev_team_covers(team_id,mime_type,image_data) VALUES (?,?,?) AS incoming
            ON DUPLICATE KEY UPDATE mime_type=incoming.mime_type,image_data=incoming.image_data
            """, team, mime, bytes);
        return WorkResponse.ok("Đã lưu ảnh bìa đội.", null);
    }

    @DeleteMapping
    @Transactional
    public WorkResponse<Void> remove(@PathVariable long team, @AuthenticationPrincipal WorkActor actor) {
        requireOwner(team, actor);
        db.update("DELETE FROM dev_team_covers WHERE team_id=?", team);
        return WorkResponse.ok("Đã gỡ ảnh bìa đội.", null);
    }

    private void requireOwner(long team, WorkActor actor) {
        permissions.requireVerified(actor);
        if (!budget.consume(actor.userId(), "TEAM_COVER", 15))
            throw new WorkException(HttpStatus.TOO_MANY_REQUESTS, "RATE_LIMITED", "Vui lòng thử lại sau.");
        var owners = db.query("SELECT owner_user_id FROM dev_teams WHERE id=? FOR UPDATE", (row, index) -> row.getString(1), team);
        if (owners.isEmpty())
            throw new WorkException(HttpStatus.NOT_FOUND, "TEAM_NOT_FOUND", "Không tìm thấy đội.");
        if (!actor.userId().equals(owners.getFirst()))
            throw new WorkException(HttpStatus.FORBIDDEN, "TEAM_FORBIDDEN", "Chỉ chủ đội được thay ảnh bìa.");
    }
}

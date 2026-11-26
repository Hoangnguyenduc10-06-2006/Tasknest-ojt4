package vn.tasknest.workservice.api.collaboration;
import java.io.IOException;
import java.util.*;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import vn.tasknest.workservice.application.WorkException;
import vn.tasknest.workservice.application.collaboration.FileValidation;
import vn.tasknest.workservice.application.security.*;
import vn.tasknest.workservice.api.WorkResponse;
@RestController @RequestMapping("/api/work/projects/{projectId}/avatar")
public class ProjectAvatarController {
    private final JdbcTemplate db;private final ProjectPermissionService permissions;
    public ProjectAvatarController(JdbcTemplate db,ProjectPermissionService permissions){this.db=db;this.permissions=permissions;}
    @PostMapping(consumes=MediaType.MULTIPART_FORM_DATA_VALUE) @Transactional public WorkResponse<Void> save(@AuthenticationPrincipal WorkActor actor,@PathVariable long projectId,@RequestParam long version,@RequestParam MultipartFile file) throws IOException {
        var access=permissions.requireManager(projectId,actor);if(access.project().getVersion()!=version)throw new WorkException(HttpStatus.CONFLICT,"PROJECT_CONFLICT","Dự án đã thay đổi. Vui lòng tải lại.");byte[] image=file.getBytes();String mime=FileValidation.validate(file.getOriginalFilename(),image,true);
        db.update("INSERT INTO project_avatars(project_id,image_data,mime_type) VALUES(?,?,?) ON DUPLICATE KEY UPDATE image_data=VALUES(image_data),mime_type=VALUES(mime_type)",projectId,image,mime);
        db.update("UPDATE projects SET avatar_storage_key=?,avatar_mime_type=?,avatar_size_bytes=?,version=version+1,updated_at=UTC_TIMESTAMP(6) WHERE id=?",UUID.randomUUID().toString(),mime,image.length,projectId);
        db.update("INSERT INTO activity_logs(project_id,actor_user_id,action,entity_type,entity_id) VALUES(?,?,'PROJECT_AVATAR_CHANGED','PROJECT',?)",projectId,actor.userId(),String.valueOf(projectId));return WorkResponse.ok("Đã lưu ảnh dự án.",null);
    }
    @GetMapping public ResponseEntity<byte[]> get(@AuthenticationPrincipal WorkActor actor,@PathVariable long projectId){permissions.requireMember(projectId,actor);var rows=db.queryForList("SELECT image_data,mime_type FROM project_avatars WHERE project_id=?",projectId);if(rows.isEmpty())return ResponseEntity.notFound().build();return ResponseEntity.ok().contentType(MediaType.parseMediaType((String)rows.getFirst().get("mime_type"))).header("Cache-Control","private, no-store").header("X-Content-Type-Options","nosniff").body((byte[])rows.getFirst().get("image_data"));}
}

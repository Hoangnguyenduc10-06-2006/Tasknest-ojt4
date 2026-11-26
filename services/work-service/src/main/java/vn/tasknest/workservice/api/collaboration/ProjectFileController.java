package vn.tasknest.workservice.api.collaboration;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import vn.tasknest.workservice.application.security.WorkActor;
import vn.tasknest.workservice.application.collaboration.ProjectFileService;
import vn.tasknest.workservice.api.WorkResponse;
@RestController @RequestMapping("/api/work/projects/{projectId}/files")
public class ProjectFileController {
    private final vn.tasknest.workservice.application.security.WorkRequestBudget budget;
    private final ProjectFileService files;
    public ProjectFileController(ProjectFileService files,vn.tasknest.workservice.application.security.WorkRequestBudget budget){this.budget=budget;this.files=files;}
    @GetMapping("/usage") public WorkResponse<java.util.Map<String,Object>> usage(@AuthenticationPrincipal WorkActor actor,@PathVariable long projectId){return WorkResponse.read(files.usage(actor,projectId));}
    @PostMapping(consumes=MediaType.MULTIPART_FORM_DATA_VALUE) @ResponseStatus(HttpStatus.CREATED) public WorkResponse<ProjectFileService.StoredFile> upload(@AuthenticationPrincipal WorkActor actor,@PathVariable long projectId,@RequestParam String kind,@RequestParam String requestId,@RequestParam MultipartFile file) throws IOException {if(!budget.consume(actor.userId(),"UPLOAD",10))throw new vn.tasknest.workservice.application.WorkException(org.springframework.http.HttpStatus.TOO_MANY_REQUESTS,"RATE_LIMIT","Quá nhiều thao tác. Vui lòng thử lại sau.");if(file.getSize()>20*1024*1024)throw new vn.tasknest.workservice.application.WorkException(HttpStatus.PAYLOAD_TOO_LARGE,"FILE_TOO_LARGE","Tệp tối đa 20 MiB.");return WorkResponse.created("Đã tải tệp. Chọn Lưu để công bố.",files.upload(actor,projectId,kind,requestId,file.getOriginalFilename(),file.getBytes()));}
    @PutMapping("/{id}/discard") public WorkResponse<Void> discard(@AuthenticationPrincipal WorkActor actor,@PathVariable long projectId,@PathVariable long id){files.discard(actor,projectId,id);return WorkResponse.ok("Đã bỏ tệp.",null);}
    @GetMapping("/{id}") public ResponseEntity<byte[]> get(@AuthenticationPrincipal WorkActor actor,@PathVariable long projectId,@PathVariable long id){var file=files.download(actor,projectId,id);return ResponseEntity.ok().contentType(MediaType.parseMediaType(file.mime())).header("X-Content-Type-Options","nosniff").header("Cache-Control","private, no-store").header(HttpHeaders.CONTENT_DISPOSITION,(file.image()?ContentDisposition.inline():ContentDisposition.attachment()).filename(file.name(),StandardCharsets.UTF_8).build().toString()).body(file.bytes());}
}

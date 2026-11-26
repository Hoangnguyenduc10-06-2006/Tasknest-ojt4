package vn.tasknest.workservice.api.collaboration;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.tasknest.workservice.api.WorkResponse;
import vn.tasknest.workservice.application.security.WorkActor;
import vn.tasknest.workservice.application.collaboration.ProjectResourceService;
@RestController @RequestMapping("/api/work/projects/{projectId}/resources")
public class ProjectResourceController {
    private final vn.tasknest.workservice.application.security.WorkRequestBudget budget;
    private final ProjectResourceService resources;public ProjectResourceController(ProjectResourceService resources,vn.tasknest.workservice.application.security.WorkRequestBudget budget){this.budget=budget;this.resources=resources;}
    public record Input(@NotBlank String requestId,@PositiveOrZero Long version,@NotBlank @Size(max=150) String title,@Size(max=500) String description,@Positive Long fileId,@Size(max=2048) String url){ProjectResourceService.Input input(){return new ProjectResourceService.Input(requestId,version,title,description,fileId,url);}}
    public record Version(@NotNull @PositiveOrZero Long version){}
    @GetMapping public WorkResponse<Map<String,Object>> list(@AuthenticationPrincipal WorkActor actor,@PathVariable long projectId,@RequestParam(defaultValue="") String search,@RequestParam(defaultValue="ALL") String type,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return WorkResponse.read(resources.list(actor,projectId,search,type,page,size));}
    @PostMapping @ResponseStatus(org.springframework.http.HttpStatus.CREATED) public WorkResponse<Long> create(@AuthenticationPrincipal WorkActor actor,@PathVariable long projectId,@Valid @RequestBody Input input){if(!budget.consume(actor.userId(),"RESOURCE",20))throw new vn.tasknest.workservice.application.WorkException(org.springframework.http.HttpStatus.TOO_MANY_REQUESTS,"RATE_LIMIT","Quá nhiều thao tác. Vui lòng thử lại sau.");return WorkResponse.created("Đã thêm tài liệu/liên kết.",resources.save(actor,projectId,null,input.input()));}
    @PutMapping("/{id}") public WorkResponse<Long> edit(@AuthenticationPrincipal WorkActor actor,@PathVariable long projectId,@PathVariable long id,@Valid @RequestBody Input input){if(!budget.consume(actor.userId(),"RESOURCE_EDIT",20))throw new vn.tasknest.workservice.application.WorkException(org.springframework.http.HttpStatus.TOO_MANY_REQUESTS,"RATE_LIMIT","Quá nhiều thao tác. Vui lòng thử lại sau.");return WorkResponse.ok("Đã lưu thay đổi.",resources.save(actor,projectId,id,input.input()));}
    @PutMapping("/{id}/delete") public WorkResponse<Void> delete(@AuthenticationPrincipal WorkActor actor,@PathVariable long projectId,@PathVariable long id,@Valid @RequestBody Version input){resources.delete(actor,projectId,id,input.version());return WorkResponse.ok("Đã xóa tài liệu/liên kết.",null);}
}

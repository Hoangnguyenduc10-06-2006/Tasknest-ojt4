package vn.tasknest.workservice.api.collaboration;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.tasknest.workservice.api.WorkResponse;
import vn.tasknest.workservice.application.security.WorkActor;
import vn.tasknest.workservice.application.collaboration.TaskCommentService;
@RestController @RequestMapping("/api/work/projects/{projectId}/tasks/{taskId}/comments")
public class TaskCommentController {
    private final vn.tasknest.workservice.application.security.WorkRequestBudget budget;
    private final TaskCommentService comments;public TaskCommentController(TaskCommentService comments,vn.tasknest.workservice.application.security.WorkRequestBudget budget){this.budget=budget;this.comments=comments;}
    public record Input(@NotBlank String requestId,@PositiveOrZero Long version,@Positive Long parentId,@Size(max=2000) String body,@NotNull @Size(max=5) List<@NotNull @Positive Long> imageIds,@NotNull @Size(max=10) List<@NotBlank String> mentions){TaskCommentService.Input input(){return new TaskCommentService.Input(requestId,version,parentId,body,imageIds,mentions);}}
    public record Version(@NotNull @PositiveOrZero Long version){}
    @GetMapping public WorkResponse<Map<String,Object>> list(@AuthenticationPrincipal WorkActor actor,@PathVariable long projectId,@PathVariable long taskId,@RequestParam(required=false) Long parentId,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return WorkResponse.read(comments.list(actor,projectId,taskId,parentId,page,size));}
    @PostMapping @ResponseStatus(org.springframework.http.HttpStatus.CREATED) public WorkResponse<Long> create(@AuthenticationPrincipal WorkActor actor,@PathVariable long projectId,@PathVariable long taskId,@Valid @RequestBody Input input){if(!budget.consume(actor.userId(),"COMMENT",30))throw new vn.tasknest.workservice.application.WorkException(org.springframework.http.HttpStatus.TOO_MANY_REQUESTS,"RATE_LIMIT","Quá nhiều thao tác. Vui lòng thử lại sau.");return WorkResponse.created("Đã gửi bình luận.",comments.save(actor,projectId,taskId,null,input.input()));}
    @PutMapping("/{id}") public WorkResponse<Long> edit(@AuthenticationPrincipal WorkActor actor,@PathVariable long projectId,@PathVariable long taskId,@PathVariable long id,@Valid @RequestBody Input input){if(!budget.consume(actor.userId(),"COMMENT_EDIT",30))throw new vn.tasknest.workservice.application.WorkException(org.springframework.http.HttpStatus.TOO_MANY_REQUESTS,"RATE_LIMIT","Quá nhiều thao tác. Vui lòng thử lại sau.");return WorkResponse.ok("Đã cập nhật bình luận.",comments.save(actor,projectId,taskId,id,input.input()));}
    @PutMapping("/{id}/delete") public WorkResponse<Void> delete(@AuthenticationPrincipal WorkActor actor,@PathVariable long projectId,@PathVariable long taskId,@PathVariable long id,@Valid @RequestBody Version input){comments.delete(actor,projectId,taskId,id,input.version());return WorkResponse.ok("Đã xóa bình luận.",null);}
}

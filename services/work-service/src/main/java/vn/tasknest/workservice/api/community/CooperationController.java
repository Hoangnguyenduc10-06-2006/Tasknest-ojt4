package vn.tasknest.workservice.api.community;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.util.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.tasknest.workservice.api.WorkResponse;
import vn.tasknest.workservice.application.security.WorkActor;
import vn.tasknest.workservice.application.security.WorkRequestBudget;
import vn.tasknest.workservice.application.WorkException;
import org.springframework.http.HttpStatus;
import vn.tasknest.workservice.application.community.CooperationService;
@RestController
@RequestMapping("/api/work")
public class CooperationController {
    private final CooperationService service;
    private final WorkRequestBudget budget;
    public CooperationController(CooperationService service,WorkRequestBudget budget){this.service=service;this.budget=budget;}
    private void write(WorkActor actor){if(actor==null)throw new WorkException(HttpStatus.UNAUTHORIZED,"UNAUTHENTICATED","Vui lòng đăng nhập.");if(!budget.consume(actor.userId(),"COOPERATION",30))throw new WorkException(HttpStatus.TOO_MANY_REQUESTS,"RATE_LIMIT","Quá nhiều thao tác. Vui lòng thử lại sau.");}
    public record Kickoff(@NotNull @PositiveOrZero Long version,@NotNull @Size(max=100) Set<@Pattern(regexp="[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}") String> userIds){}
    public record Milestone(@NotNull LocalDate dueOn,@NotBlank @Pattern(regexp="[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}") String requestId){}
    @GetMapping("/community/cooperations") public WorkResponse<Map<String,Object>> list(@AuthenticationPrincipal WorkActor actor,@RequestParam(defaultValue="projects") String view,@RequestParam(defaultValue="ALL") String status,@RequestParam(defaultValue="0") int page){return WorkResponse.read(service.list(actor,view,status,page));}
    @GetMapping("/projects/{project}/agreement") public WorkResponse<Map<String,Object>> agreement(@AuthenticationPrincipal WorkActor actor,@PathVariable long project){return WorkResponse.read(service.agreement(actor,project));}
    @PutMapping("/projects/{project}/agreement/kickoff") public WorkResponse<Void> kickoff(@AuthenticationPrincipal WorkActor actor,@PathVariable long project,@Valid @RequestBody Kickoff input){write(actor);service.kickoff(actor,project,input.version(),input.userIds());return WorkResponse.ok("Đã xác nhận nhân sự và khởi động dự án.",null);}
    @PostMapping("/projects/{project}/agreement/milestone") public WorkResponse<Long> milestone(@AuthenticationPrincipal WorkActor actor,@PathVariable long project,@Valid @RequestBody Milestone input){write(actor);return WorkResponse.ok("Đã tạo bản nháp mốc bàn giao. Hai bên cần kiểm tra và xác nhận kế hoạch.",service.draftMilestone(actor,project,input.dueOn(),input.requestId()));}
    @GetMapping("/community/requests/{request}/history") public WorkResponse<List<Map<String,Object>>> history(@AuthenticationPrincipal WorkActor actor,@PathVariable long request,@RequestParam(required=false) Long proposal){return WorkResponse.read(service.history(actor,request,proposal));}
}

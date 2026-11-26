package vn.tasknest.workservice.api.community;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.tasknest.workservice.api.WorkResponse;
import vn.tasknest.workservice.application.WorkException;
import vn.tasknest.workservice.application.community.MilestoneService;
import vn.tasknest.workservice.application.security.*;

@RestController
@RequestMapping("/api/work/projects/{project}/milestones")
public class MilestoneController {
    private final MilestoneService milestones;
    private final WorkRequestBudget budget;
    public MilestoneController(MilestoneService milestones,WorkRequestBudget budget){this.milestones=milestones;this.budget=budget;}
    public record Plan(@NotBlank @Size(max=150) String title,@NotNull @Size(min=1,max=20) List<@NotBlank @Size(max=300) String> criteria,
            @NotNull LocalDate dueOn,@NotNull @Size(max=100) Set<@NotNull @Positive Long> taskIds,
            @NotBlank @Pattern(regexp="[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}") String requestId,@PositiveOrZero Long version) {
        MilestoneService.Plan value(){return new MilestoneService.Plan(title,criteria,dueOn,taskIds,requestId,version);}
    }
    public record Version(@NotNull @PositiveOrZero Long version){}
    public record Delivery(@NotBlank @Size(max=4000) String note,@NotBlank @Size(max=2048) String resultUrl,
            @NotBlank @Pattern(regexp="[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}") String requestId,@NotNull @PositiveOrZero Long version) {
        MilestoneService.Delivery value(){return new MilestoneService.Delivery(note,resultUrl,requestId,version);}
    }
    public record Review(@NotNull Boolean accepted,@Size(max=2000) String feedback,
            @NotNull @Size(max=20) Set<@NotNull @PositiveOrZero Integer> checkedCriteria,@NotNull @PositiveOrZero Long version) {
        MilestoneService.Review value(){return new MilestoneService.Review(accepted,feedback,checkedCriteria,version);}
    }
    public record Cancellation(@NotNull @PositiveOrZero Long version,@NotBlank @Size(max=2000) String reason){}
    @GetMapping public WorkResponse<Map<String,Object>> list(@AuthenticationPrincipal WorkActor actor,@PathVariable long project,@RequestParam(defaultValue="0") int page){
        return WorkResponse.read(milestones.list(actor,project,page));
    }
    @GetMapping("/{id}") public WorkResponse<Map<String,Object>> detail(@AuthenticationPrincipal WorkActor actor,@PathVariable long project,@PathVariable long id,@RequestParam(defaultValue="0") int page){
        return WorkResponse.read(milestones.detail(actor,project,id,page));
    }
    @PostMapping @ResponseStatus(HttpStatus.CREATED) public WorkResponse<Long> create(@AuthenticationPrincipal WorkActor actor,@PathVariable long project,@Valid @RequestBody Plan input){
        write(actor);return WorkResponse.created("Đã tạo mốc chờ khách hàng xác nhận.",milestones.save(actor,project,null,input.value()));
    }
    @PutMapping("/{id}") public WorkResponse<Long> edit(@AuthenticationPrincipal WorkActor actor,@PathVariable long project,@PathVariable long id,@Valid @RequestBody Plan input){
        write(actor);return WorkResponse.ok("Đã lưu kế hoạch mốc bàn giao.",milestones.save(actor,project,id,input.value()));
    }
    @PutMapping("/{id}/approve-plan") public WorkResponse<Void> approve(@AuthenticationPrincipal WorkActor actor,@PathVariable long project,@PathVariable long id,@Valid @RequestBody Version input){
        write(actor);milestones.approvePlan(actor,project,id,input.version());return WorkResponse.ok("Đã xác nhận kế hoạch mốc bàn giao.",null);
    }
    @PostMapping("/{id}/submissions") @ResponseStatus(HttpStatus.CREATED) public WorkResponse<Long> submit(@AuthenticationPrincipal WorkActor actor,@PathVariable long project,@PathVariable long id,@Valid @RequestBody Delivery input){
        write(actor);return WorkResponse.created("Đã gửi kết quả cho khách hàng nghiệm thu.",milestones.submit(actor,project,id,input.value()));
    }
    @PutMapping("/{id}/submissions/{submission}/review") public WorkResponse<Void> review(@AuthenticationPrincipal WorkActor actor,@PathVariable long project,@PathVariable long id,@PathVariable long submission,@Valid @RequestBody Review input){
        write(actor);milestones.review(actor,project,id,submission,input.value());return WorkResponse.ok(input.accepted()?"Đã chấp nhận mốc bàn giao.":"Đã gửi yêu cầu chỉnh sửa.",null);
    }
    @PutMapping("/{id}/cancel") public WorkResponse<Void> cancel(@AuthenticationPrincipal WorkActor actor,@PathVariable long project,@PathVariable long id,@Valid @RequestBody Cancellation input){
        write(actor);milestones.cancel(actor,project,id,input.version(),input.reason());return WorkResponse.ok("Đã hủy mốc bàn giao.",null);
    }
    private void write(WorkActor actor){
        if(actor==null)throw new WorkException(HttpStatus.UNAUTHORIZED,"UNAUTHENTICATED","Vui lòng đăng nhập.");
        if(!budget.consume(actor.userId(),"MILESTONE",30))throw new WorkException(HttpStatus.TOO_MANY_REQUESTS,"RATE_LIMIT","Quá nhiều thao tác. Vui lòng thử lại sau.");
    }
}

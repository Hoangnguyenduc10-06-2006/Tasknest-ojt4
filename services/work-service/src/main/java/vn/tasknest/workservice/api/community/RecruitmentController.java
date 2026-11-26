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
import vn.tasknest.workservice.application.community.RecruitmentService;
import vn.tasknest.workservice.application.security.*;

@RestController
@RequestMapping("/api/work/community")
public class RecruitmentController {
    private final RecruitmentService recruitment;
    private final WorkRequestBudget budget;
    public RecruitmentController(RecruitmentService recruitment,WorkRequestBudget budget){this.recruitment=recruitment;this.budget=budget;}
    public record Opening(@NotBlank @Size(min=3,max=100) String title,@NotBlank @Size(min=20,max=3000) String description,
        @NotBlank @Size(max=300) String skills,@NotBlank String workMode,@Min(1) @Max(80) int weeklyHours,
        @Min(1) @Max(20) int slots,@NotNull LocalDate closesOn,
        @NotBlank @Pattern(regexp="[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}") String requestId, @Size(max=2048) String referenceUrl, @Size(max=4) java.util.List<@NotBlank @Size(max=1398104) String> images) {
        RecruitmentService.Opening value(){return new RecruitmentService.Opening(title,description,skills,workMode,weeklyHours,slots,closesOn,requestId,referenceUrl,images);}
    }
    public record Application(@NotBlank @Size(min=20,max=2000) String introduction,@NotBlank @Size(max=300) String skills,
        @Min(1) @Max(80) int weeklyHours,@AssertTrue boolean consent) {
        RecruitmentService.Application value(){return new RecruitmentService.Application(introduction,skills,weeklyHours);}
    }
    public record EditOpening(@NotNull @Valid Opening opening, @NotNull @PositiveOrZero Long version) {}
    public record Status(@NotBlank String status,@NotNull @PositiveOrZero Long version) {}
    public record Version(@NotNull @PositiveOrZero Long version) {}
    public record Review(@NotNull Boolean accepted,@Size(max=1000) String feedback,@NotNull @PositiveOrZero Long version) {}
    @GetMapping("/openings") public WorkResponse<Map<String,Object>> board(@AuthenticationPrincipal WorkActor actor,
        @RequestParam(defaultValue="") @Size(max=100) String search,@RequestParam(defaultValue="0") int page,
        @RequestParam(defaultValue="") String skills,@RequestParam(defaultValue="") String roles,@RequestParam(defaultValue="0") int hours,@RequestParam(defaultValue="NEWEST") String sort,
        @RequestParam(defaultValue="ALL") String mode,@RequestParam(defaultValue="0") int maxHours,@RequestParam(defaultValue="0") int minScore){
        if(search.length()>100)throw new WorkException(HttpStatus.BAD_REQUEST,"INVALID_SEARCH","Nội dung tìm kiếm quá dài.");
        return WorkResponse.read(recruitment.board(actor,null,search.strip(),page,null,new RecruitmentService.MatchCriteria(skills,roles,hours,sort,mode,maxHours,minScore)));
    }
    @GetMapping("/teams/{team}/openings") public WorkResponse<Map<String,Object>> team(@AuthenticationPrincipal WorkActor actor,@PathVariable long team,@RequestParam(defaultValue="0") int page,@RequestParam(required=false) @Positive Long openingId){
        return WorkResponse.read(openingId==null?recruitment.board(actor,team,"",page):recruitment.board(actor,team,"",page,openingId));
    }
    @PostMapping("/teams/{team}/openings") @ResponseStatus(HttpStatus.CREATED) public WorkResponse<Long> create(@AuthenticationPrincipal WorkActor actor,@PathVariable long team,@Valid @RequestBody Opening input){
        write(actor);return WorkResponse.created("Đã đăng tin tuyển thành viên.",recruitment.create(actor,team,input.value()));
    }
    @PutMapping("/teams/{team}/openings/{opening}")
    public WorkResponse<Void> update(@AuthenticationPrincipal WorkActor actor, @PathVariable long team,
        @PathVariable long opening, @Valid @RequestBody EditOpening input) {
        write(actor);
        recruitment.update(actor, team, opening, input.opening().value(), input.version());
        return WorkResponse.ok("Đã lưu thay đổi tin tuyển dụng.", null);
    }
    @PutMapping("/teams/{team}/openings/{opening}/status") public WorkResponse<Void> status(@AuthenticationPrincipal WorkActor actor,@PathVariable long team,@PathVariable long opening,@Valid @RequestBody Status input){
        write(actor);recruitment.status(actor,team,opening,input.status(),input.version());return WorkResponse.ok("Đã cập nhật trạng thái tin tuyển dụng.",null);
    }
    @PostMapping("/teams/{team}/openings/{opening}/applications") @ResponseStatus(HttpStatus.CREATED) public WorkResponse<Long> apply(@AuthenticationPrincipal WorkActor actor,@PathVariable long team,@PathVariable long opening,@Valid @RequestBody Application input){
        write(actor);return WorkResponse.created("Đã gửi đơn ứng tuyển.",recruitment.apply(actor,team,opening,input.value()));
    }
    @GetMapping("/teams/{team}/openings/{opening}/applications") public WorkResponse<Map<String,Object>> applications(@AuthenticationPrincipal WorkActor actor,@PathVariable long team,@PathVariable long opening,@RequestParam(defaultValue="0") int page,@RequestParam(required=false) @Positive Long applicationId){
        return WorkResponse.read(applicationId==null?recruitment.applications(actor,team,opening,page):recruitment.applications(actor,team,opening,page,applicationId));
    }
    @GetMapping("/applications/mine") public WorkResponse<Map<String,Object>> mine(@AuthenticationPrincipal WorkActor actor,@RequestParam(defaultValue="0") int page,@RequestParam(required=false) @Positive Long applicationId){return WorkResponse.read(applicationId==null?recruitment.mine(actor,page):recruitment.mine(actor,page,applicationId));}
    @PutMapping("/teams/{team}/openings/{opening}/applications/{application}/withdraw") public WorkResponse<Void> withdraw(@AuthenticationPrincipal WorkActor actor,@PathVariable long team,@PathVariable long opening,@PathVariable long application,@Valid @RequestBody Version input){
        write(actor);recruitment.withdraw(actor,team,opening,application,input.version());return WorkResponse.ok("Đã rút đơn ứng tuyển.",null);
    }
    @PutMapping("/teams/{team}/openings/{opening}/applications/{application}/review") public WorkResponse<Void> review(@AuthenticationPrincipal WorkActor actor,@PathVariable long team,@PathVariable long opening,@PathVariable long application,@Valid @RequestBody Review input){
        write(actor);recruitment.review(actor,team,opening,application,input.accepted(),input.feedback(),input.version());return WorkResponse.ok(input.accepted()?"Đã nhận ứng viên vào đội.":"Đã gửi phản hồi cho ứng viên.",null);
    }
    private void write(WorkActor actor){
        if(actor==null)throw new WorkException(HttpStatus.UNAUTHORIZED,"UNAUTHENTICATED","Vui lòng đăng nhập.");
        if(!budget.consume(actor.userId(),"RECRUITMENT",30))throw new WorkException(HttpStatus.TOO_MANY_REQUESTS,"RATE_LIMIT","Quá nhiều thao tác. Vui lòng thử lại sau.");
    }
}

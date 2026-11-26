package vn.tasknest.workservice.api.community;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.tasknest.workservice.api.WorkResponse;
import vn.tasknest.workservice.application.WorkException;
import vn.tasknest.workservice.application.community.MarketplaceService;
import vn.tasknest.workservice.application.security.*;

@RestController
@RequestMapping("/api/work/community")
public class MarketplaceController {
    private final MarketplaceService marketplace;
    private final WorkRequestBudget budget;
    public MarketplaceController(MarketplaceService marketplace,WorkRequestBudget budget) {
        this.marketplace=marketplace; this.budget=budget;
    }
    public record RequestInput(@NotBlank @Size(min=3,max=100) String title,
            @NotBlank @Size(min=30,max=5000) String description,@NotNull @Size(max=300) String skills,
            @PositiveOrZero @Digits(integer=12,fraction=0) BigDecimal budgetMin,
            @PositiveOrZero @Digits(integer=12,fraction=0) BigDecimal budgetMax,
            @NotNull LocalDate desiredDelivery,@Size(max=2048) String referenceUrl,@NotNull Boolean publish,
            @NotBlank @Pattern(regexp="[0-9a-f-]{36}") String requestId,@PositiveOrZero Long version,
            @Size(max=4) java.util.List<@NotBlank @Size(max=1398104) String> images,
            @Size(max=4) java.util.List<@NotNull @Min(1) @Max(4) Integer> keepImages) {
        MarketplaceService.RequestInput value() {
            return new MarketplaceService.RequestInput(title,description,skills,budgetMin,budgetMax,desiredDelivery,referenceUrl,publish,requestId,version,images,keepImages);
        }
    }
    public record ProposalInput(@Positive long teamId,@NotNull @PositiveOrZero Long requestVersion,
            @NotBlank @Size(min=20,max=4000) String plan,@NotNull @DecimalMin(value="0",inclusive=false) @Digits(integer=12,fraction=0) BigDecimal amount,
            @NotNull LocalDate startsOn,@NotNull LocalDate endsOn,@PositiveOrZero Long version) {
        MarketplaceService.ProposalInput value() {
            return new MarketplaceService.ProposalInput(teamId,requestVersion,plan,amount,startsOn,endsOn,version);
        }
    }
    public record Version(@NotNull @PositiveOrZero Long version) {}
    public record State(@NotBlank @Pattern(regexp="OPEN|PAUSED|CLOSED") String status,@NotNull @PositiveOrZero Long version) {}
    @GetMapping("/requests")
    public WorkResponse<Map<String,Object>> list(@AuthenticationPrincipal WorkActor actor,
            @RequestParam(defaultValue="") @Size(max=100) String search,@RequestParam(defaultValue="0") int page) {
        return WorkResponse.read(marketplace.list(actor,false,search,page));
    }
    @GetMapping("/my-requests")
    public WorkResponse<Map<String,Object>> mine(@AuthenticationPrincipal WorkActor actor,
            @RequestParam(defaultValue="") @Size(max=100) String search,@RequestParam(defaultValue="0") int page) {
        return WorkResponse.read(marketplace.list(actor,true,search,page));
    }
    @GetMapping("/requests/{id}")
    public WorkResponse<Map<String,Object>> detail(@AuthenticationPrincipal WorkActor actor,@PathVariable long id) {
        return WorkResponse.read(marketplace.detail(actor,id));
    }
    @PostMapping("/requests")
    @ResponseStatus(HttpStatus.CREATED)
    public WorkResponse<Long> create(@AuthenticationPrincipal WorkActor actor,@Valid @RequestBody RequestInput input) {
        write(actor);
        return WorkResponse.created("Đã tạo yêu cầu dự án.",marketplace.create(actor,input.value()));
    }
    @PutMapping("/requests/{id}")
    public WorkResponse<Void> edit(@AuthenticationPrincipal WorkActor actor,@PathVariable long id,@Valid @RequestBody RequestInput input) {
        write(actor); marketplace.edit(actor,id,input.value());
        return WorkResponse.ok("Đã cập nhật yêu cầu. Các đội cần gửi lại đề xuất theo nội dung mới.",null);
    }
    @PutMapping("/requests/{id}/status")
    public WorkResponse<Void> state(@AuthenticationPrincipal WorkActor actor,@PathVariable long id,@Valid @RequestBody State input) {
        write(actor); marketplace.changeStatus(actor,id,input.status(),input.version());
        return WorkResponse.ok("Đã cập nhật trạng thái yêu cầu.",null);
    }
    @GetMapping("/requests/{id}/proposals")
    public WorkResponse<Map<String,Object>> proposals(@AuthenticationPrincipal WorkActor actor,@PathVariable long id,
            @RequestParam(defaultValue="0") int page,@RequestParam(required=false) Long teamId,@RequestParam(required=false) @Positive Long proposalId) {
        return WorkResponse.read(proposalId==null?marketplace.proposals(actor,id,page,teamId):marketplace.proposals(actor,id,page,teamId,proposalId));
    }
    @PutMapping("/requests/{id}/proposals")
    public WorkResponse<Void> propose(@AuthenticationPrincipal WorkActor actor,@PathVariable long id,@Valid @RequestBody ProposalInput input) {
        write(actor); marketplace.propose(actor,id,input.value());
        return WorkResponse.ok("Đã gửi đề xuất thực hiện.",null);
    }
    @PutMapping("/requests/{id}/proposals/{proposal}/withdraw")
    public WorkResponse<Void> withdraw(@AuthenticationPrincipal WorkActor actor,@PathVariable long id,@PathVariable long proposal,@Valid @RequestBody Version input) {
        write(actor); marketplace.withdraw(actor,id,proposal,input.version());
        return WorkResponse.ok("Đã rút đề xuất.",null);
    }
    @PutMapping("/requests/{id}/proposals/{proposal}/accept")
    public WorkResponse<Long> award(@AuthenticationPrincipal WorkActor actor,@PathVariable long id,@PathVariable long proposal,@Valid @RequestBody Version input) {
        write(actor);
        return WorkResponse.ok("Đã chọn đội và tạo dự án hợp tác.",marketplace.award(actor,id,proposal,input.version()));
    }
    private void write(WorkActor actor) {
        if(actor==null) throw new WorkException(HttpStatus.UNAUTHORIZED,"UNAUTHENTICATED","Vui lòng đăng nhập.");
        if(!budget.consume(actor.userId(),"MARKETPLACE",30)) throw new WorkException(HttpStatus.TOO_MANY_REQUESTS,"RATE_LIMIT","Quá nhiều thao tác. Vui lòng thử lại sau.");
    }
}

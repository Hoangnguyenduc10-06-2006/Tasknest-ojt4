package vn.tasknest.workservice.api.community;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.tasknest.workservice.api.WorkResponse;
import vn.tasknest.workservice.application.WorkException;
import vn.tasknest.workservice.application.community.ProposalDiscussionService;
import vn.tasknest.workservice.application.security.*;

@RestController
@RequestMapping("/api/work/community/requests/{request}/proposals/{proposal}/messages")
public class ProposalDiscussionController {
    private final ProposalDiscussionService discussions;
    private final WorkRequestBudget budget;
    public ProposalDiscussionController(ProposalDiscussionService discussions,WorkRequestBudget budget){this.discussions=discussions;this.budget=budget;}
    public record Message(@NotBlank @Size(max=2000) String body,
        @NotBlank @Pattern(regexp="[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}") String clientId) {}
    public record Read(@Positive long messageId) {}
    @GetMapping public WorkResponse<Map<String,Object>> messages(@AuthenticationPrincipal WorkActor actor,@PathVariable long request,@PathVariable long proposal,@RequestParam(required=false) Long before){return WorkResponse.read(discussions.messages(actor,request,proposal,before));}
    @PostMapping @ResponseStatus(HttpStatus.CREATED) public WorkResponse<Long> send(@AuthenticationPrincipal WorkActor actor,@PathVariable long request,@PathVariable long proposal,@Valid @RequestBody Message input){
        if(actor==null)throw new WorkException(HttpStatus.UNAUTHORIZED,"UNAUTHENTICATED","Vui lòng đăng nhập.");
        if(!budget.consume(actor.userId(),"DISCUSSION",40))throw new WorkException(HttpStatus.TOO_MANY_REQUESTS,"RATE_LIMIT","Bạn gửi tin quá nhanh. Vui lòng thử lại sau.");
        return WorkResponse.created("Đã gửi tin nhắn.",discussions.send(actor,request,proposal,input.body(),input.clientId()));
    }
    @PutMapping("/read") public WorkResponse<Void> read(@AuthenticationPrincipal WorkActor actor,@PathVariable long request,@PathVariable long proposal,@Valid @RequestBody Read input){discussions.read(actor,request,proposal,input.messageId());return WorkResponse.ok("Đã đánh dấu tin đã đọc.",null);}
}

package vn.tasknest.workservice.api.community;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.tasknest.workservice.api.WorkResponse;
import vn.tasknest.workservice.application.WorkException;
import vn.tasknest.workservice.application.community.CommunityService;
import vn.tasknest.workservice.application.security.*;

@RestController
@RequestMapping("/api/work")
public class CommunityController {
    private final CommunityService community;
    private final WorkRequestBudget budget;
    public CommunityController(CommunityService community, WorkRequestBudget budget) {
        this.community = community;
        this.budget = budget;
    }

    public record TeamInput(@NotBlank @Size(min=3,max=100) String name,
            @NotBlank @Size(min=10,max=1500) String description, @NotNull @Size(max=300) String skills,
            boolean acceptingWork, @PositiveOrZero Long version) {
        CommunityService.TeamInput value() { return new CommunityService.TeamInput(name, description, skills, acceptingWork, version); }
    }
    public record Invitation(@NotBlank @Email @Size(max=254) String email) {}
    public record Choice(@NotNull Boolean value) {}
    public record Engagement(@Positive long teamId, @NotBlank @Pattern(regexp="[0-9a-f-]{36}") String customerId) {}
    public record Completion(boolean publishProject) {}
    public record Reopen(@NotBlank @Pattern(regexp="REQUEST|APPROVE|DECLINE|CANCEL") String action,
        @Pattern(regexp="[0-9a-f-]{36}") String requestId) {}
    public record Review(@Min(1) @Max(5) int quality, @Min(1) @Max(5) int schedule,
            @Min(1) @Max(5) int communication, @Min(1) @Max(5) int support,
            @NotBlank @Size(max=2000) String comment, boolean wouldRehire, @PositiveOrZero Long version) {
        CommunityService.ReviewInput value() { return new CommunityService.ReviewInput(quality,schedule,communication,support,comment,wouldRehire,version); }
    }
    public record Reply(@NotBlank @Size(max=2000) String comment, @NotNull @PositiveOrZero Long version) {}
    public record Recognition(@NotBlank @Pattern(regexp="[0-9a-f-]{36}") String userId,
            @NotBlank @Size(max=1000) String comment,
            @NotNull @Size(min=1,max=5) Set<@NotBlank String> strengths) {}

    @GetMapping("/community/teams")
    public WorkResponse<Map<String,Object>> teams(@RequestParam(defaultValue="") @Size(max=100) String search,
            @RequestParam(defaultValue="0") int page, @RequestParam(defaultValue="") String skill) {
        return WorkResponse.read(community.teams(search.strip(), page, skill));
    }
    @GetMapping("/community/teams/{team}")
    public WorkResponse<Map<String,Object>> team(@PathVariable long team, @AuthenticationPrincipal WorkActor actor,
            @RequestParam(defaultValue="0") int page) {
        return WorkResponse.read(community.team(team, actor, page));
    }
    @GetMapping("/community/members/{user}")
    public WorkResponse<Map<String,Object>> member(@PathVariable String user, @AuthenticationPrincipal WorkActor actor,
            @RequestParam(defaultValue="0") int page) {
        return WorkResponse.read(community.member(user, actor, page));
    }
    @GetMapping("/community/me")
    public WorkResponse<Map<String,Object>> mine(@AuthenticationPrincipal WorkActor actor) {
        return WorkResponse.read(community.mine(actor));
    }
    @PostMapping("/community/teams")
    @ResponseStatus(HttpStatus.CREATED)
    public WorkResponse<Long> create(@AuthenticationPrincipal WorkActor actor, @Valid @RequestBody TeamInput input) {
        write(actor);
        return WorkResponse.created("Đã tạo hồ sơ đội.",community.createTeam(actor,input.value()));
    }
    @PutMapping("/community/teams/{team}")
    public WorkResponse<Void> edit(@PathVariable long team,@AuthenticationPrincipal WorkActor actor,@Valid @RequestBody TeamInput input) {
        write(actor); community.editTeam(actor,team,input.value());
        return WorkResponse.ok("Đã cập nhật hồ sơ đội.",null);
    }
    @PostMapping("/community/teams/{team}/invitations")
    public WorkResponse<Void> invite(@PathVariable long team,@AuthenticationPrincipal WorkActor actor,@Valid @RequestBody Invitation input) {
        write(actor); community.invite(actor,team,input.email());
        return WorkResponse.ok("Đã gửi lời mời. Thành viên xem trong mục Đội của tôi.",null);
    }
    @PutMapping("/community/teams/{team}/invitation")
    public WorkResponse<Void> invitation(@PathVariable long team,@AuthenticationPrincipal WorkActor actor,@Valid @RequestBody Choice input) {
        write(actor); community.invitation(actor,team,input.value());
        return WorkResponse.ok("Đã xử lý lời mời.",null);
    }
    @PutMapping("/community/likes/{type}/{target}")
    public WorkResponse<Void> like(@PathVariable String type,@PathVariable String target,@AuthenticationPrincipal WorkActor actor,@Valid @RequestBody Choice input) {
        write(actor); community.like(actor,type,target,input.value());
        return WorkResponse.ok("Đã cập nhật lượt thích.",null);
    }
    @GetMapping("/projects/{project}/reputation")
    public WorkResponse<Map<String,Object>> engagement(@PathVariable long project,@AuthenticationPrincipal WorkActor actor) {
        return WorkResponse.read(community.engagement(actor,project));
    }
    @PutMapping("/projects/{project}/reputation")
    public WorkResponse<Void> connect(@PathVariable long project,@AuthenticationPrincipal WorkActor actor,@Valid @RequestBody Engagement input) {
        write(actor); community.connectProject(actor,project,input.teamId(),input.customerId());
        return WorkResponse.ok("Đã gửi thông tin hợp tác cho khách hàng xác nhận.",null);
    }
    @PutMapping("/projects/{project}/reputation/accept")
    public WorkResponse<Void> accept(@PathVariable long project,@AuthenticationPrincipal WorkActor actor) {
        write(actor); community.acceptEngagement(actor,project);
        return WorkResponse.ok("Đã xác nhận hợp tác.",null);
    }
    @PutMapping("/projects/{project}/reputation/complete")
    public WorkResponse<Void> complete(@PathVariable long project,@AuthenticationPrincipal WorkActor actor,@Valid @RequestBody Completion input) {
        write(actor); community.complete(actor,project,input.publishProject());
        return WorkResponse.ok("Đã xác nhận nghiệm thu dự án.",null);
    }
    @PutMapping("/projects/{project}/reputation/reopen")
    public WorkResponse<Void> reopen(@PathVariable long project, @AuthenticationPrincipal WorkActor actor,
        @Valid @RequestBody Reopen input) {
        write(actor);
        community.reopen(actor, project, input.action(), input.requestId());
        return WorkResponse.ok("Đã xử lý yêu cầu mở lại dự án.", null);
    }
    @PutMapping("/projects/{project}/reputation/decline")
    public WorkResponse<Void> decline(@PathVariable long project,@AuthenticationPrincipal WorkActor actor) {
        write(actor); community.declineEngagement(actor,project);
        return WorkResponse.ok("Đã từ chối thông tin hợp tác.",null);
    }
    @PutMapping("/projects/{project}/reputation/review")
    public WorkResponse<Void> review(@PathVariable long project,@AuthenticationPrincipal WorkActor actor,@Valid @RequestBody Review input) {
        write(actor); community.review(actor,project,input.value());
        return WorkResponse.ok("Đã lưu đánh giá của khách hàng.",null);
    }
    @PutMapping("/projects/{project}/reputation/reply")
    public WorkResponse<Void> reply(@PathVariable long project,@AuthenticationPrincipal WorkActor actor,@Valid @RequestBody Reply input) {
        write(actor); community.reply(actor,project,input.comment(),input.version());
        return WorkResponse.ok("Đã lưu phản hồi của đội.",null);
    }
    @PutMapping("/projects/{project}/reputation/recognitions")
    public WorkResponse<Void> recognize(@PathVariable long project,@AuthenticationPrincipal WorkActor actor,@Valid @RequestBody Recognition input) {
        write(actor); community.recognize(actor,project,input.userId(),input.comment(),input.strengths());
        return WorkResponse.ok("Đã ghi nhận đóng góp của thành viên.",null);
    }
    @GetMapping("/projects/{project}/reputation/history")
    public WorkResponse<List<Map<String,Object>>> history(@PathVariable long project,@AuthenticationPrincipal WorkActor actor) {
        return WorkResponse.read(community.history(actor,project));
    }
    private void write(WorkActor actor) {
        if (actor == null) throw new WorkException(HttpStatus.UNAUTHORIZED,"UNAUTHENTICATED","Vui lòng đăng nhập.");
        if (!budget.consume(actor.userId(),"COMMUNITY",30)) {
            throw new WorkException(HttpStatus.TOO_MANY_REQUESTS,"RATE_LIMIT","Quá nhiều thao tác. Vui lòng thử lại sau.");
        }
    }
}

package vn.tasknest.workservice.api.community;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.tasknest.workservice.api.WorkResponse;
import vn.tasknest.workservice.application.WorkException;
import vn.tasknest.workservice.application.community.TeamWorkspaceService;
import vn.tasknest.workservice.application.security.*;

@RestController
@RequestMapping("/api/work/community/teams/{team}")
public class TeamWorkspaceController {
    private final TeamWorkspaceService teams;
    private final WorkRequestBudget budget;
    public TeamWorkspaceController(TeamWorkspaceService teams,WorkRequestBudget budget){this.teams=teams;this.budget=budget;}
    public record Invite(@NotBlank @Pattern(regexp="[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}") String userId){}
    public record Assignment(@NotNull @Size(min=1,max=100) Set<@NotBlank @Pattern(regexp="[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}") String> userIds){}
    @GetMapping("/people")
    public WorkResponse<List<Map<String,Object>>> people(@PathVariable long team,@AuthenticationPrincipal WorkActor actor,@RequestParam @Size(min=2,max=100) String search){check(actor);return WorkResponse.read(teams.candidates(actor,team,search));}
    @GetMapping("/recommendations")
    public WorkResponse<List<TeamWorkspaceService.Recommendation>> recommendations(
        @PathVariable long team, @AuthenticationPrincipal WorkActor actor
    ) {
        return WorkResponse.read(teams.recommendations(actor, team));
    }
    @GetMapping("/invitations")
    public WorkResponse<List<Map<String,Object>>> invitations(@PathVariable long team,@AuthenticationPrincipal WorkActor actor){return WorkResponse.read(teams.invitations(actor,team));}
    @PostMapping("/invitations/by-user")
    public WorkResponse<Void> invite(@PathVariable long team,@AuthenticationPrincipal WorkActor actor,@Valid @RequestBody Invite input){check(actor);teams.invite(actor,team,input.userId());return WorkResponse.ok("Đã gửi lời mời tham gia đội.",null);}
    @GetMapping("/projects")
    public WorkResponse<List<Map<String,Object>>> projects(@PathVariable long team,@AuthenticationPrincipal WorkActor actor){return WorkResponse.read(teams.projects(actor,team));}
    @PostMapping("/projects/{project}/members")
    public WorkResponse<Void> assign(@PathVariable long team,@PathVariable long project,@AuthenticationPrincipal WorkActor actor,@Valid @RequestBody Assignment input){check(actor);teams.assign(actor,team,project,input.userIds());return WorkResponse.ok("Đã bố trí thành viên vào dự án.",null);}
    @DeleteMapping("/invitations/{user}")
    public WorkResponse<Void> cancel(@PathVariable long team,@PathVariable UUID user,@AuthenticationPrincipal WorkActor actor) {
        check(actor);teams.cancelInvitation(actor,team,user.toString());return WorkResponse.ok("Đã hủy lời mời.",null);
    }
    @DeleteMapping("/members/{user}")
    public WorkResponse<Void> remove(@PathVariable long team,@PathVariable UUID user,@AuthenticationPrincipal WorkActor actor) {
        check(actor);teams.removeMember(actor,team,user.toString());return WorkResponse.ok("Đã gỡ thành viên.",null);
    }
    @DeleteMapping("/membership")
    public WorkResponse<Void> leave(@PathVariable long team,@AuthenticationPrincipal WorkActor actor) {
        check(actor);teams.leave(actor,team);return WorkResponse.ok("Đã rời đội.",null);
    }
    private void check(WorkActor actor){if(actor==null)throw new WorkException(HttpStatus.UNAUTHORIZED,"UNAUTHENTICATED","Vui lòng đăng nhập.");if(!actor.emailVerified())throw new WorkException(HttpStatus.FORBIDDEN,"EMAIL_NOT_VERIFIED","Vui lòng xác nhận email.");if(!budget.consume(actor.userId(),"TEAM_MEMBERS",30))throw new WorkException(HttpStatus.TOO_MANY_REQUESTS,"RATE_LIMITED","Bạn thao tác quá nhanh. Vui lòng thử lại sau.");}
}

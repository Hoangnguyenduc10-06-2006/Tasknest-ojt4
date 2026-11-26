package vn.tasknest.workservice.api.collaboration;

import java.util.UUID;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.tasknest.workservice.application.WorkException;
import vn.tasknest.workservice.application.community.MessagingService;
import vn.tasknest.workservice.application.security.*;
import vn.tasknest.workservice.infrastructure.identity.IdentityDirectoryClient;

@RestController
public class MemberAvatarController {
    private final ProjectPermissionService permissions;
    private final JdbcTemplate db;
    private final IdentityDirectoryClient directory;
    private final MessagingService chat;
    public MemberAvatarController(ProjectPermissionService permissions, JdbcTemplate db, IdentityDirectoryClient directory, MessagingService chat) {
        this.permissions=permissions;this.db=db;this.directory=directory;this.chat=chat;
    }
    @GetMapping("/api/work/projects/{projectId}/members/{userId}/avatar")
    public ResponseEntity<byte[]> get(@AuthenticationPrincipal WorkActor actor,@PathVariable long projectId,@PathVariable UUID userId) {
        permissions.requireInternalMember(projectId,actor);
        if(db.queryForObject("SELECT COUNT(*) FROM project_memberships WHERE project_id=? AND user_id=? AND status='ACTIVE'",Long.class,projectId,userId.toString())!=1)
            throw new WorkException(HttpStatus.NOT_FOUND,"MEMBER_NOT_FOUND","Không tìm thấy thành viên.");
        return avatarResponse(directory.avatar(userId.toString()));
    }

    @GetMapping("/api/work/community/teams/{teamId}/members/{userId}/avatar")
    public ResponseEntity<byte[]> teamAvatar(@AuthenticationPrincipal WorkActor actor, @PathVariable long teamId,
                                             @PathVariable UUID userId) {
        permissions.requireVerified(actor);
        Long matches = db.queryForObject("""
            SELECT COUNT(*) FROM dev_team_members viewer
            JOIN dev_team_members target ON target.team_id=viewer.team_id
            WHERE viewer.team_id=? AND viewer.user_id=? AND target.user_id=?
            """, Long.class, teamId, actor.userId(), userId.toString());
        if (matches == null || matches != 1)
            throw new WorkException(HttpStatus.NOT_FOUND, "MEMBER_NOT_FOUND", "Không tìm thấy thành viên.");
        return avatarResponse(directory.avatar(userId.toString()));
    }

    @GetMapping("/api/work/community/chat/{conversationId}/participants/{userId}/avatar")
    public ResponseEntity<byte[]> chatAvatar(@AuthenticationPrincipal WorkActor actor, @PathVariable long conversationId,
                                             @PathVariable UUID userId) {
        return avatarResponse(chat.participantAvatar(actor, conversationId, userId.toString()));
    }

    @GetMapping("/api/work/community/members/{userId}/avatar")
    public ResponseEntity<byte[]> connectedAvatar(@AuthenticationPrincipal WorkActor actor, @PathVariable UUID userId) {
        return avatarResponse(chat.connectedAvatar(actor, userId.toString()));
    }

    private ResponseEntity<byte[]> avatarResponse(byte[] image) {
        return ResponseEntity.ok().contentType(MediaType.IMAGE_PNG).cacheControl(CacheControl.noStore().cachePrivate())
            .header("X-Content-Type-Options", "nosniff").body(image);
    }
}

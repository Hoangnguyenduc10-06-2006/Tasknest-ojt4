package vn.tasknest.workservice.application.members;

import java.sql.Timestamp;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.tasknest.workservice.application.WorkException;
import vn.tasknest.workservice.application.security.*;
import vn.tasknest.workservice.domain.project.ProjectRole;
import vn.tasknest.workservice.infrastructure.identity.IdentityDirectoryClient;

@Service
public class ProjectMembersService {
    private final JdbcTemplate db;
    private final ProjectPermissionService permissions;
    private final IdentityDirectoryClient directory;
    private final Clock clock;
    public ProjectMembersService(JdbcTemplate db, ProjectPermissionService permissions, IdentityDirectoryClient directory, Clock clock) {
        this.db=db; this.permissions=permissions; this.directory=directory; this.clock=clock;
    }
    public record Item(String id,String userId,String name,String role,String status,String actorId,String actorName,Instant createdAt,Instant expiresAt,String reason) {}
    public record Snapshot(List<Item> items,long total,int page,int size,String role,boolean archived) {}
    public record Link(String code,String createdBy,String creatorName,Instant createdAt) {}
    private Timestamp now() { return Timestamp.from(clock.instant().truncatedTo(ChronoUnit.MICROS)); }
    private WorkException conflict(String text) { return new WorkException(HttpStatus.CONFLICT,"MEMBER_CONFLICT",text); }
    private WorkException forbidden() { return new WorkException(HttpStatus.FORBIDDEN,"PROJECT_FORBIDDEN","Bạn không có quyền thực hiện thao tác này."); }
    private WorkException missing() { return new WorkException(HttpStatus.NOT_FOUND,"MEMBER_NOT_FOUND","Không tìm thấy dữ liệu trong dự án."); }
    private void manager(ProjectAccess access) { if(!access.role().canManage()) throw forbidden(); }
    private void audit(Long project,String actor,String action,String id) {
        db.update("INSERT INTO activity_logs(project_id,actor_user_id,action,entity_type,entity_id,created_at) VALUES(?,?,?,'PROJECT_MEMBER',?,?)",project,actor,action,id,now());
    }
    public Snapshot list(WorkActor actor,Long projectId,String tab,int page,int size) {
        var access=permissions.requireInternalMember(projectId,actor);
        if(!List.of("members","invitations","requests").contains(tab) || page<0 || page>100000 || !List.of(10,20,50).contains(size))
            throw new WorkException(HttpStatus.BAD_REQUEST,"INVALID_REQUEST","Điều kiện phân trang không hợp lệ.");
        if(!tab.equals("members")) manager(access);
        String table=tab.equals("members")?"project_memberships":tab.equals("invitations")?"project_invitations":"project_join_requests";
        String condition=tab.equals("members")?" AND status='ACTIVE'":"";
        long total=db.queryForObject("SELECT COUNT(*) FROM "+table+" WHERE project_id=?"+condition,Long.class,projectId);
        List<Item> items=db.query("SELECT * FROM "+table+" WHERE project_id=?"+condition+" ORDER BY "+(tab.equals("members")?"joined_at DESC,user_id":"created_at DESC,id DESC")+" LIMIT ? OFFSET ?",(rs,n)->{
            String uid=rs.getString(tab.equals("invitations")?"invitee_user_id":"user_id");
            String id=tab.equals("members")?uid:String.valueOf(rs.getLong("id"));
            String role=uid.equals(access.project().getOwnerUserId())?"Owner":uid.equals(access.project().getManagerUserId())?"Manager":"Member";
            String status=rs.getString("status");
            Instant expiry=tab.equals("invitations")?rs.getTimestamp("expires_at").toInstant():null;
            if(status.equals("PENDING") && expiry!=null && !expiry.isAfter(clock.instant())) status="EXPIRED";
            return new Item(id,uid,null,role,status,tab.equals("invitations")?rs.getString("invited_by"):null,null,
                rs.getTimestamp(tab.equals("members")?"joined_at":"created_at").toInstant(),expiry,tab.equals("requests")?rs.getString("reason"):null);
        },projectId,size,page*size);
        Set<String> ids=new HashSet<>(); items.forEach(i->{ids.add(i.userId());if(i.actorId()!=null)ids.add(i.actorId());});
        var names=directory.names(ids);
        return new Snapshot(items.stream().map(i->new Item(i.id(),i.userId(),names.getOrDefault(i.userId(),i.userId()),(permissions.isCustomer(projectId,i.userId())?"Customer":i.role()),i.status(),i.actorId(),names.get(i.actorId()),i.createdAt(),i.expiresAt(),i.reason())).toList(),total,page,size,access.role().name(),access.project().getStatus().name().equals("ARCHIVED") || "COMPLETED".equals(permissions.developmentState(projectId)));
    }
    @Transactional
    public Long invite(WorkActor actor,Long project,String email) {
        // Authorize before consulting Identity; no cross-database joins.
        var access=permissions.requireManager(project,actor);
        var recipient=directory.recipient(email.strip().toLowerCase(Locale.ROOT));
        if(Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM project_memberships WHERE project_id=? AND user_id=? AND status='ACTIVE')",Boolean.class,project,recipient.id()))) throw conflict("Tài khoản này đã là thành viên dự án.");
        Timestamp at=now();
        db.update("UPDATE project_invitations SET status='EXPIRED',resolved_at=? WHERE project_id=? AND invitee_user_id=? AND status='PENDING' AND expires_at<=?",at,project,recipient.id(),at);
        if(!db.queryForList("SELECT id FROM project_invitations WHERE project_id=? AND invitee_user_id=? AND status='PENDING'",project,recipient.id()).isEmpty()) throw conflict("Tài khoản này đã có lời mời đang chờ phản hồi.");
        db.update("INSERT INTO project_invitations(project_id,invitee_user_id,invited_by,created_at,expires_at) VALUES(?,?,?,?,DATE_ADD(?,INTERVAL 7 DAY))",project,recipient.id(),actor.userId(),at,at);
        Long id=db.queryForObject("SELECT id FROM project_invitations WHERE project_id=? AND invitee_user_id=? AND status='PENDING'",Long.class,project,recipient.id());
        db.update("""
            INSERT INTO outbox_events(event_id,aggregate_type,aggregate_id,aggregate_version,event_type,schema_version,occurred_at,payload)
            VALUES(?,'ProjectInvitation',?,0,'work.project-invitation.created',1,?,JSON_OBJECT('userId',?,'email',?,'projectId',?,'invitationId',?,'actorId',?,'projectName',?,'expiresAt',?))
            """,UUID.randomUUID().toString(),String.valueOf(id),at,recipient.id(),recipient.email(),project,id,actor.userId(),access.project().getName(),at.toInstant().plus(7,ChronoUnit.DAYS).toString());
        audit(project,actor.userId(),"MEMBER_INVITED",String.valueOf(id));
        return id;
    }
    @Transactional
    public void cancel(WorkActor actor,Long project,Long id) {
        permissions.requireManager(project,actor);
        int changed=db.update("UPDATE project_invitations SET status='CANCELLED',resolved_at=?,resolved_by=? WHERE project_id=? AND id=? AND invited_by=? AND status='PENDING' AND expires_at>?",now(),actor.userId(),project,id,actor.userId(),now());
        if(changed!=1) throw conflict("Chỉ người gửi được hủy lời mời đang chờ và còn hiệu lực.");
        audit(project,actor.userId(),"INVITATION_CANCELLED",String.valueOf(id));
    }
    @Transactional
    public void decide(WorkActor actor,Long project,Long id,boolean accept) {
        permissions.requireManager(project,actor);
        var rows=db.queryForList("SELECT user_id FROM project_join_requests WHERE project_id=? AND id=? AND status='PENDING' FOR UPDATE",project,id);
        if(rows.isEmpty()) throw conflict("Yêu cầu không còn chờ duyệt.");
        String user=(String)rows.getFirst().get("user_id");
        if(accept) {
            db.update("INSERT INTO project_memberships(project_id,user_id,status,joined_at,added_by) VALUES(?,?,'ACTIVE',?,?) ON DUPLICATE KEY UPDATE status='ACTIVE',joined_at=VALUES(joined_at),added_by=VALUES(added_by),removed_at=NULL,removed_by=NULL",project,user,now(),actor.userId());
            db.update("UPDATE project_invitations SET status='CANCELLED',resolved_at=?,resolved_by=? WHERE project_id=? AND invitee_user_id=? AND status='PENDING'",now(),actor.userId(),project,user);
        }
        db.update("UPDATE project_join_requests SET status=?,resolved_at=?,resolved_by=? WHERE id=?",accept?"ACCEPTED":"REJECTED",now(),actor.userId(),id);
        audit(project,actor.userId(),accept?"JOIN_REQUEST_ACCEPTED":"JOIN_REQUEST_REJECTED",String.valueOf(id));
    }
    @Transactional
    public void role(WorkActor actor,Long project,String user,String role) {
        var access=permissions.requireOwner(project,actor);
        // requireOwner permits archived reads; writes must additionally require ACTIVE.
        permissions.requireWritable(project,actor);
        if(user.equals(access.project().getOwnerUserId())) throw conflict("Không thể thay đổi vai trò Owner.");
        if(permissions.isCustomer(project,user)) throw conflict("Khách hàng của dự án được quản lý qua quan hệ hợp tác, không thể xoá hoặc đổi vai trò như thành viên dev.");
        activeMember(project,user);
        String previous=access.project().getManagerUserId();
        if(role.equals("Manager")&&user.equals(previous)||role.equals("Member")&&!user.equals(previous))return;
        if(role.equals("Manager")&&previous!=null&&!previous.equals(user))audit(project,actor.userId(),"MEMBER_ROLE_CHANGED",previous);
        if(role.equals("Manager")) db.update("UPDATE projects SET manager_user_id=?,version=version+1,updated_at=? WHERE id=?",user,now(),project);
        else db.update("UPDATE projects SET manager_user_id=NULL,version=version+1,updated_at=? WHERE id=? AND manager_user_id=?",now(),project,user);
        audit(project,actor.userId(),"MEMBER_ROLE_CHANGED",user);
    }
    private void activeMember(Long project,String user) {
        if(!Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM project_memberships WHERE project_id=? AND user_id=? AND status='ACTIVE')",Boolean.class,project,user))) throw missing();
    }
    @Transactional
    public void remove(WorkActor actor,Long project,String user) {
        var access=permissions.requireOwner(project,actor); permissions.requireWritable(project,actor);
        if(user.equals(access.project().getOwnerUserId())) throw conflict("Không thể xóa Owner.");
        if(permissions.isCustomer(project,user)) throw conflict("Khách hàng của dự án được quản lý qua quan hệ hợp tác, không thể xoá hoặc đổi vai trò như thành viên dev.");
        activeMember(project,user);
        if(Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM tasks WHERE project_id=? AND assignee_user_id=? AND status NOT IN ('DONE','CANCELLED'))",Boolean.class,project,user))) throw conflict("Không thể xóa thành viên vì còn "+db.queryForObject("SELECT COUNT(*) FROM tasks WHERE project_id=? AND assignee_user_id=? AND status NOT IN ('DONE','CANCELLED')",Long.class,project,user)+" nhiệm vụ đang phụ trách. Cần phân công lại hoặc xử lý xong.");
        db.update("UPDATE projects SET manager_user_id=NULL,version=version+1,updated_at=? WHERE id=? AND manager_user_id=?",now(),project,user);
        db.update("UPDATE project_memberships SET status='REMOVED',removed_at=?,removed_by=? WHERE project_id=? AND user_id=?",now(),actor.userId(),project,user);
        audit(project,actor.userId(),"MEMBER_REMOVED",user);
    }
    public Link link(WorkActor actor,Long project) {
        manager(permissions.requireInternalMember(project,actor));
        var links=db.query("SELECT public_code,created_by,created_at FROM project_invitation_links WHERE project_id=? AND status='ACTIVE'",(rs,n)->new Link(rs.getString("public_code"),rs.getString("created_by"),null,rs.getTimestamp("created_at").toInstant()),project);
        if(links.isEmpty()) return null;
        Link link=links.getFirst();
        return new Link(link.code(),link.createdBy(),directory.names(Set.of(link.createdBy())).get(link.createdBy()),link.createdAt());
    }
    @Transactional
    public Link changeLink(WorkActor actor,Long project,String action) {
        permissions.requireManager(project,actor);
        if(!action.equals("CREATE")) db.update("UPDATE project_invitation_links SET status='REVOKED',revoked_at=?,revocation_reason=? WHERE project_id=? AND status='ACTIVE'",now(),action,project);
        if(!action.equals("DISABLE") && db.queryForObject("SELECT COUNT(*) FROM project_invitation_links WHERE project_id=? AND status='ACTIVE'",Long.class,project)==0) {
            byte[] random=new byte[32];new java.security.SecureRandom().nextBytes(random);
            db.update("INSERT INTO project_invitation_links(project_id,public_code,created_by,created_at) VALUES(?,?,?,?)",project,HexFormat.of().formatHex(random),actor.userId(),now());
        }
        audit(project,actor.userId(),"INVITATION_LINK_"+action,String.valueOf(project));
        return link(actor,project);
    }
}

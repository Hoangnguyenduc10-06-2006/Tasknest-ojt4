package vn.tasknest.workservice.application.community;

import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.tasknest.workservice.api.ApiValues;
import vn.tasknest.workservice.application.WorkException;
import vn.tasknest.workservice.application.security.*;
import vn.tasknest.workservice.application.workspace.WorkNotificationService;
import vn.tasknest.workservice.infrastructure.identity.IdentityDirectoryClient;

@Service
public class TeamWorkspaceService {
    private final JdbcTemplate db;
    private final ProjectPermissionService permissions;
    private final IdentityDirectoryClient directory;
    private final WorkNotificationService notifications;
    private final Clock clock;
    public TeamWorkspaceService(JdbcTemplate db, ProjectPermissionService permissions, IdentityDirectoryClient directory, WorkNotificationService notifications, Clock clock) {
        this.db=db; this.permissions=permissions; this.directory=directory; this.notifications=notifications; this.clock=clock;
    }
    public List<Map<String,Object>> candidates(WorkActor actor,long team,String search) {
        owner(actor,team,false);
        String query=search.strip();
        if(query.length()<2||query.length()>100)throw conflict("Nhập ít nhất 2 ký tự tên hoặc email đầy đủ để tìm tài khoản.");
        return directory.invitationUsers(query).stream().map(user -> {
            String status=member(team,user.id())?"MEMBER":customer(team,user.id())?"CUSTOMER":pending(team,user.id())?"INVITED":"AVAILABLE";
            return Map.<String,Object>of("userId",user.id(),"fullName",user.fullName(),"status",status);
        }).toList();
    }
    public record Recommendation(String userId, String fullName, String headline, String openingTitle,
                                 String matchedSkills, int matchedCount, int requiredCount) {}

    public List<Recommendation> recommendations(WorkActor actor, long team) {
        owner(actor, team, false);
        String required = RecruitmentService.canonicalSkill("required.skill");
        String offered = RecruitmentService.canonicalSkill("offered.skill");
        var matches = db.query("""
            WITH open_positions AS (
                SELECT o.id,o.title,o.skills FROM team_openings o
                WHERE o.team_id=? AND o.status='OPEN' AND o.closes_on>=UTC_DATE()
                  AND (SELECT COUNT(*) FROM team_applications a WHERE a.opening_id=o.id AND a.status='ACCEPTED')<o.slots
            ), criteria AS (
                SELECT id,title,skills FROM open_positions
                UNION ALL SELECT 0,NULL,skills FROM dev_teams WHERE id=? AND NOT EXISTS (SELECT 1 FROM open_positions)
            ), skill_tokens AS (
                SELECT c.id,c.title,%s skill FROM criteria c
                JOIN JSON_TABLE(CAST(CONCAT('[',REPLACE(JSON_QUOTE(REGEXP_REPLACE(c.skills,'[,，;/|]+',',')),',','","'),']') AS JSON),
                  '$[*]' COLUMNS(skill VARCHAR(300) PATH '$')) required
            ), requirements AS (
                SELECT DISTINCT id,title,skill FROM skill_tokens WHERE skill<>''
            ), totals AS (
                SELECT id,COUNT(*) required_count FROM requirements GROUP BY id
            ), eligible AS (
                SELECT p.user_id,p.headline,p.skills FROM professional_member_profiles p
                WHERE p.is_public=TRUE AND p.availability='LOOKING_FOR_TEAM' AND p.user_id<>?
                  AND NOT EXISTS (SELECT 1 FROM dev_team_members m WHERE m.team_id=? AND m.user_id=p.user_id)
                  AND NOT EXISTS (SELECT 1 FROM dev_team_invitations i WHERE i.team_id=? AND i.user_id=p.user_id
                                  AND i.status='PENDING' AND i.created_at>?)
                  AND NOT EXISTS (SELECT 1 FROM team_engagements e WHERE e.team_id=? AND e.customer_user_id=p.user_id
                                  AND e.status IN ('PROPOSED','ACTIVE'))
            ), matched AS (
                SELECT p.user_id,p.headline,r.id,r.title,
                       GROUP_CONCAT(DISTINCT r.skill ORDER BY r.skill SEPARATOR ', ') matched_skills,
                       COUNT(DISTINCT r.skill) matched_count,t.required_count
                FROM eligible p JOIN JSON_TABLE(CAST(p.skills AS JSON), '$[*]' COLUMNS(skill VARCHAR(40) PATH '$')) offered
                JOIN requirements r ON r.skill=%s JOIN totals t ON t.id=r.id
                GROUP BY p.user_id,p.headline,r.id,r.title,t.required_count
            ), ranked AS (
                SELECT *,ROW_NUMBER() OVER (PARTITION BY user_id
                    ORDER BY matched_count/required_count DESC,matched_count DESC,id DESC) best
                FROM matched
            )
            SELECT * FROM ranked WHERE best=1
            ORDER BY matched_count/required_count DESC,matched_count DESC,user_id LIMIT 24
            """.formatted(required, offered),
            (row, index) -> new Recommendation(row.getString("user_id"), "", row.getString("headline"),
                row.getString("title"), row.getString("matched_skills"), row.getInt("matched_count"), row.getInt("required_count")),
            team, team, actor.userId(), team, team, expiryCutoff(), team);
        var ids = new HashSet<String>();
        matches.forEach(match -> ids.add(match.userId()));
        var names = directory.names(ids);
        return matches.stream().filter(match -> names.containsKey(match.userId())).limit(6)
            .map(match -> new Recommendation(match.userId(), names.get(match.userId()), match.headline(),
                match.openingTitle(), match.matchedSkills(), match.matchedCount(), match.requiredCount())).toList();
    }

    public List<Map<String,Object>> invitations(WorkActor actor,long team) {
        owner(actor,team,false);
        var rows=ApiValues.utc(db.queryForList("SELECT user_id,created_at,DATE_ADD(created_at,INTERVAL 7 DAY) AS expires_at FROM dev_team_invitations WHERE team_id=? AND status='PENDING' AND created_at>? ORDER BY created_at DESC LIMIT 100",team,expiryCutoff()));
        var ids=new HashSet<String>();rows.forEach(row -> ids.add(row.get("user_id").toString()));
        var names=directory.names(ids);rows.forEach(row -> row.put("display_name",names.getOrDefault(row.get("user_id"),"Thành viên TaskNest")));
        return rows;
    }
    @Transactional
    public void invite(WorkActor actor,long team,String user) {
        var roster=owner(actor,team,true);
        var recipient=directory.invitationUser(user);
        if(!user.equals(recipient.id()))throw conflict("Tài khoản nhận lời mời không hợp lệ.");
        if(member(team,user))throw conflict("Tài khoản này đã ở trong đội.");
        if(customer(team,user))throw conflict("Khách hàng của đội không thể đồng thời là thành viên đội thực hiện.");
        if(pending(team,user))return;
        db.update("INSERT INTO dev_team_invitations(team_id,user_id,created_at) VALUES(?,?,?) ON DUPLICATE KEY UPDATE status='PENDING',created_at=VALUES(created_at)",team,user,Timestamp.from(clock.instant()));
        notifications.team(team,actor.userId(),user,"team.invitation.created","Lời mời tham gia đội",roster.get("name")+" mời bạn tham gia. Mở Đội của tôi để chấp nhận hoặc từ chối trong 7 ngày.");
    }
    @Transactional
    public void respond(WorkActor actor,long team,boolean accept) {
        permissions.requireVerified(actor);
        var roster=one("SELECT * FROM dev_teams WHERE id=? FOR UPDATE",team);
        var invitation=one("SELECT status,created_at FROM dev_team_invitations WHERE team_id=? AND user_id=? FOR UPDATE",team,actor.userId());
        String desired=accept?"ACCEPTED":"REJECTED";
        if(desired.equals(invitation.get("status")))return;
        if(!"PENDING".equals(invitation.get("status")) || !instant(invitation.get("created_at")).isAfter(clock.instant().minus(Duration.ofDays(7))))throw conflict("Lời mời đã được xử lý hoặc hết hạn.");
        if(accept) {
            if(customer(team,actor.userId()))throw conflict("Bạn đang là khách hàng của đội này, không thể tham gia đội thực hiện.");
            String name=directory.invitationUser(actor.userId()).fullName();
            if(!member(team,actor.userId()))db.update("INSERT INTO dev_team_members(team_id,user_id,display_name) VALUES(?,?,?)",team,actor.userId(),name);
        }
        db.update("UPDATE dev_team_invitations SET status=? WHERE team_id=? AND user_id=?",desired,team,actor.userId());
        notifications.team(team,actor.userId(),roster.get("owner_user_id").toString(),accept?"team.invitation.accepted":"team.invitation.rejected",accept?"Thành viên đã tham gia đội":"Lời mời đội đã bị từ chối","Lời mời vào "+roster.get("name")+" đã được phản hồi. Mở Đội của tôi để xem danh sách thành viên.");
    }
    @Transactional
    public void cancelInvitation(WorkActor actor, long team, String user) {
        owner(actor,team,true);
        db.update("DELETE FROM dev_team_invitations WHERE team_id=? AND user_id=? AND status='PENDING'",team,user);
    }

    @Transactional
    public void removeMember(WorkActor actor, long team, String user) {
        owner(actor,team,true);
        remove(team,user);
    }

    @Transactional
    public void leave(WorkActor actor, long team) {
        permissions.requireVerified(actor);
        one("SELECT id FROM dev_teams WHERE id=? FOR UPDATE",team);
        remove(team,actor.userId());
    }

    private void remove(long team,String user) {
        if(user.equals(one("SELECT owner_user_id FROM dev_teams WHERE id=?",team).get("owner_user_id")))
            throw conflict("Không thể gỡ hoặc rời đội khi bạn là chủ đội.");
        db.update("DELETE FROM dev_team_members WHERE team_id=? AND user_id=?",team,user);
        // Project membership and contribution history have their own lifecycle.
    }

    public List<Map<String,Object>> projects(WorkActor actor,long team) {
        owner(actor,team,false);
        var projects=db.queryForList("SELECT p.id,p.name FROM projects p JOIN team_engagements e ON e.project_id=p.id WHERE e.team_id=? AND e.status='ACTIVE' AND p.status='ACTIVE' AND (p.owner_user_id=? OR p.manager_user_id=?) ORDER BY p.updated_at DESC LIMIT 100",team,actor.userId(),actor.userId());
        projects.forEach(project -> project.put("memberIds",db.queryForList("SELECT user_id FROM project_memberships WHERE project_id=? AND status='ACTIVE'",String.class,project.get("id"))));
        return projects;
    }
    @Transactional
    public void assign(WorkActor actor,long team,long project,Set<String> users) {
        // Match the project-first lock order used by workspace member writes.
        permissions.requireManager(project,actor);
        owner(actor,team,true);
        one("SELECT project_id FROM team_engagements WHERE project_id=? AND team_id=? AND status='ACTIVE'",project,team);
        if(users.isEmpty()||users.size()>100)throw conflict("Chọn từ 1 đến 100 thành viên.");
        for(String user:users)if(!member(team,user))throw conflict("Chỉ bố trí thành viên đã chấp nhận tham gia đội vào dự án.");
        for(String user:users) {
            if(count("SELECT COUNT(*) FROM project_memberships WHERE project_id=? AND user_id=? AND status='ACTIVE'",project,user)>0)continue;
            db.update("INSERT INTO project_memberships(project_id,user_id,status,joined_at,added_by) VALUES(?,?,'ACTIVE',?,?) ON DUPLICATE KEY UPDATE status='ACTIVE',joined_at=VALUES(joined_at),added_by=VALUES(added_by),removed_at=NULL,removed_by=NULL",project,user,Timestamp.from(clock.instant()),actor.userId());
            db.update("UPDATE project_invitations SET status='CANCELLED',resolved_at=?,resolved_by=? WHERE project_id=? AND invitee_user_id=? AND status='PENDING'",Timestamp.from(clock.instant()),actor.userId(),project,user);
            db.update("INSERT INTO activity_logs(project_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES(?,?,'TEAM_MEMBER_ASSIGNED','MEMBER',?,JSON_OBJECT('teamId',?))",project,actor.userId(),user,team);
            notifications.send(project,null,actor.userId(),user,"work.member_added","Bạn được bố trí vào dự án","Mở dự án trong Làm việc để xem nhiệm vụ và phối hợp với đội.",false,List.of(),false);
        }
    }
    private Map<String,Object> owner(WorkActor actor,long team,boolean lock) {
        permissions.requireVerified(actor);
        var row=one("SELECT * FROM dev_teams WHERE id=?"+(lock?" FOR UPDATE":""),team);
        if(!actor.userId().equals(row.get("owner_user_id")))throw new WorkException(HttpStatus.FORBIDDEN,"TEAM_FORBIDDEN","Chỉ chủ đội được quản lý thành viên và bố trí nhân sự.");
        return row;
    }
    private boolean member(long team,String user){return count("SELECT COUNT(*) FROM dev_team_members WHERE team_id=? AND user_id=?",team,user)>0;}
    private boolean customer(long team,String user){return count("SELECT COUNT(*) FROM team_engagements WHERE team_id=? AND customer_user_id=? AND status IN ('PROPOSED','ACTIVE')",team,user)>0;}
    private boolean pending(long team,String user){return count("SELECT COUNT(*) FROM dev_team_invitations WHERE team_id=? AND user_id=? AND status='PENDING' AND created_at>?",team,user,expiryCutoff())>0;}
    private Instant instant(Object value){return value instanceof Timestamp timestamp?timestamp.toInstant():((LocalDateTime)value).toInstant(ZoneOffset.UTC);}
    private Timestamp expiryCutoff(){return Timestamp.from(clock.instant().minus(Duration.ofDays(7)));}
    private long count(String sql,Object... args){return Objects.requireNonNull(db.queryForObject(sql,Long.class,args));}
    private Map<String,Object> one(String sql,Object... args){var rows=db.queryForList(sql,args);if(rows.isEmpty())throw new WorkException(HttpStatus.NOT_FOUND,"TEAM_NOT_FOUND","Không tìm thấy đội, lời mời hoặc dự án phù hợp.");return rows.getFirst();}
    private WorkException conflict(String message){return new WorkException(HttpStatus.CONFLICT,"TEAM_CONFLICT",message);}
}

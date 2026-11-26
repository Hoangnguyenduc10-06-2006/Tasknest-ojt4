package vn.tasknest.workservice.application.community;

import java.sql.Statement;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;
import vn.tasknest.workservice.api.ApiValues;
import vn.tasknest.workservice.application.WorkException;
import vn.tasknest.workservice.application.security.*;
import vn.tasknest.workservice.infrastructure.identity.IdentityDirectoryClient;

@Service
public class CommunityService {
    private final DiscoveryNotifications discovery;
    private final JdbcTemplate db;
    private final ProjectPermissionService permissions;
    private final IdentityDirectoryClient directory;
    private final ProfessionalProfileService profiles;
    private final TeamWorkspaceService teamWorkspace;
    private final JsonMapper json = new JsonMapper();
    private static final Set<String> STRENGTHS = Set.of("COMMUNICATION", "PROBLEM_SOLVING", "DESIGN", "SUPPORT", "RELIABILITY");
    private static final String TEAM_SUMMARY = """
        SELECT t.*,
          (SELECT COUNT(*) FROM dev_team_members m WHERE m.team_id=t.id) AS member_count,
          (SELECT COUNT(*) FROM profile_likes l WHERE l.target_type='TEAM' AND l.target_id=CAST(t.id AS CHAR)) AS likes,
          (SELECT COUNT(*) FROM team_reviews r JOIN team_engagements e ON e.project_id=r.project_id WHERE e.team_id=t.id) AS review_count,
          (SELECT ROUND(AVG((r.quality+r.schedule+r.communication+r.support)/4.0),2)
             FROM team_reviews r JOIN team_engagements e ON e.project_id=r.project_id WHERE e.team_id=t.id) AS rating,
          (SELECT COUNT(*) FROM team_engagements e WHERE e.team_id=t.id AND e.status='COMPLETED') AS completed_projects
        FROM dev_teams t
        """;

    public CommunityService(JdbcTemplate db, ProjectPermissionService permissions, IdentityDirectoryClient directory, ProfessionalProfileService profiles, TeamWorkspaceService teamWorkspace,DiscoveryNotifications discovery) {
        this.discovery=discovery; this.db = db;
        this.permissions = permissions;
        this.directory = directory;
        this.profiles = profiles;
        this.teamWorkspace = teamWorkspace;
    }
    public record TeamInput(String name, String description, String skills, boolean acceptingWork, Long version) {}
    public record ReviewInput(int quality, int schedule, int communication, int support, String comment,
            boolean wouldRehire, Long version) {}

    public Map<String, Object> teams(String search, int page) {
        return teams(search, page, "");
    }

    public Map<String, Object> teams(String search, int page, String skill) {
        checkPage(page);
        if (skill.length() > 300) throw new WorkException(HttpStatus.BAD_REQUEST, "INVALID_SKILL", "Kỹ năng quá dài.");
        String condition = " WHERE LOCATE(LOWER(?),LOWER(CONCAT(t.name,' ',t.skills)))>0";
        var arguments = new ArrayList<Object>();
        arguments.add(search);
        if (!skill.isBlank()) {
            condition += " AND LOCATE(CONCAT(',', LOWER(?), ','), CONCAT(',', REGEXP_REPLACE(LOWER(TRIM(t.skills)), '[[:space:]]*[,，;/|]+[[:space:]]*', ','), ',')) > 0";
            arguments.add(skill.strip());
        }
        Long total = db.queryForObject("SELECT COUNT(*) FROM dev_teams t" + condition, Long.class, arguments.toArray());
        arguments.add(page * 12);
        return Map.of("items", rows(TEAM_SUMMARY + condition + " ORDER BY t.created_at DESC,t.id DESC LIMIT 12 OFFSET ?", arguments.toArray()),
            "total", total, "page", page);
    }

    public Map<String, Object> team(long team, WorkActor actor, int page) {
        checkPage(page);
        var profile = one(TEAM_SUMMARY + " WHERE t.id=?", team);
        profile.put("liked", actor != null && liked("TEAM", String.valueOf(team), actor.userId()));
        profile.put("isOwner", actor != null && actor.userId().equals(profile.get("owner_user_id")));
        String viewer = actor == null ? null : actor.userId();
        profile.put("members", rows("""
            SELECT m.user_id,m.display_name,m.specialty,
              EXISTS (SELECT 1 FROM account_connections c WHERE c.user_low=LEAST(m.user_id,?)
                  AND c.user_high=GREATEST(m.user_id,?) AND c.status='ACCEPTED')
                AND NOT EXISTS (SELECT 1 FROM chat_blocks b WHERE
                  (b.blocker_user_id=m.user_id AND b.blocked_user_id=?)
                  OR (b.blocked_user_id=m.user_id AND b.blocker_user_id=?)) AS can_message,
              (SELECT COUNT(*) FROM profile_likes l WHERE l.target_type='MEMBER' AND l.target_id=m.user_id) AS likes,
              (SELECT COUNT(*) FROM member_recognitions r WHERE r.user_id=m.user_id) AS recognitions
            FROM dev_team_members m WHERE m.team_id=? ORDER BY m.joined_at,m.user_id
            """, viewer,viewer,viewer,viewer,team));
        if(actor!=null) {
            @SuppressWarnings("unchecked") var members=(List<Map<String,Object>>)profile.get("members");
            var ids=new HashSet<String>(); members.forEach(member -> ids.add(member.get("user_id").toString()));
            var names=directory.names(ids); members.forEach(member -> member.put("display_name",names.getOrDefault(member.get("user_id"),member.get("display_name").toString())));
        }
        profile.put("reviews", rows("""
            SELECT r.*, e.customer_name,e.project_public_name,
              (r.quality+r.schedule+r.communication+r.support)/4.0 AS rating
            FROM team_reviews r JOIN team_engagements e ON e.project_id=r.project_id
            WHERE e.team_id=? ORDER BY r.created_at DESC,r.project_id DESC LIMIT 10 OFFSET ?
            """, team, page*10));
        // Customer IDs, private project names and invitation recipients never enter this response.
        return profile;
    }

    public Map<String, Object> member(String user, WorkActor actor, int page) {
        UUID.fromString(user);
        checkPage(page);
        var professional = profiles.publicProfile(user);
        var profile = new LinkedHashMap<String,Object>();
        if (professional != null) {
            profile.put("user_id",user);
            profile.put("display_name",professional.get("display_name"));
        } else {
            var people=rows("SELECT user_id,display_name FROM (SELECT user_id,display_name FROM dev_team_members WHERE user_id=? UNION ALL SELECT user_id,display_name FROM team_engagement_contributors WHERE user_id=?) people LIMIT 1",user,user);
            if (!people.isEmpty()) {
                profile.putAll(people.getFirst());
            } else {
                if(actor==null) throw new WorkException(HttpStatus.NOT_FOUND,"PROFILE_NOT_FOUND","Không tìm thấy hồ sơ.");
                permissions.requireVerified(actor);
                var account=directory.invitationUser(user);
                profile.put("user_id",user);
                profile.put("display_name",account.fullName());
                profile.put("connectionOnly",true);
            }
        }
        profile.put("professional", professional);
        profile.put("completedProjects", count("SELECT COUNT(*) FROM team_engagement_contributors WHERE user_id=?", user));
        profile.put("likes", db.queryForObject("SELECT COUNT(*) FROM profile_likes WHERE target_type='MEMBER' AND target_id=?", Long.class, user));
        profile.put("liked", actor != null && liked("MEMBER", user, actor.userId()));
        profile.put("teams", rows("SELECT t.id,t.name FROM dev_teams t JOIN dev_team_members m ON m.team_id=t.id WHERE m.user_id=? ORDER BY t.name", user));
        profile.put("recognitionCount", db.queryForObject("SELECT COUNT(*) FROM member_recognitions WHERE user_id=?", Long.class, user));
        profile.put("recognitions", rows("""
            SELECT r.strengths,r.comment,r.updated_at,e.customer_name,e.project_public_name,t.id AS team_id,t.name AS team_name
            FROM member_recognitions r JOIN team_engagements e ON e.project_id=r.project_id
            JOIN dev_teams t ON t.id=e.team_id WHERE r.user_id=?
            ORDER BY r.updated_at DESC,r.project_id DESC LIMIT 10 OFFSET ?
            """, user, page*10));
        return profile;
    }

    public Map<String, Object> mine(WorkActor actor) {
        permissions.requireVerified(actor);
        return Map.of("teams", rows("SELECT t.* FROM dev_teams t JOIN dev_team_members m ON m.team_id=t.id WHERE m.user_id=? ORDER BY t.id", actor.userId()),
            "invitations", rows("SELECT i.team_id,t.name FROM dev_team_invitations i JOIN dev_teams t ON t.id=i.team_id WHERE i.user_id=? AND i.status='PENDING' AND i.created_at>DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 7 DAY) ORDER BY i.created_at DESC", actor.userId()),
            "activity",Map.of("isDeveloper",count("SELECT COUNT(*) FROM dev_team_members WHERE user_id=?",actor.userId())>0,
                "isCustomer",count("SELECT COUNT(*) FROM customer_project_requests WHERE customer_user_id=?",actor.userId())>0 || count("SELECT COUNT(*) FROM team_engagements WHERE customer_user_id=?",actor.userId())>0));
    }

    @Transactional
    public long createTeam(WorkActor actor, TeamInput input) {
        permissions.requireVerified(actor);
        validateTeam(input);
        var key = new GeneratedKeyHolder();
        db.update(connection -> {
            var statement = connection.prepareStatement(
                "INSERT INTO dev_teams(owner_user_id,name,description,skills,accepting_work) VALUES(?,?,?,?,?)", Statement.RETURN_GENERATED_KEYS);
            statement.setString(1, actor.userId());
            statement.setString(2, input.name().strip());
            statement.setString(3, input.description().strip());
            statement.setString(4, input.skills().strip());
            statement.setBoolean(5, input.acceptingWork());
            return statement;
        }, key);
        long id = Objects.requireNonNull(key.getKey()).longValue();
        db.update("INSERT INTO dev_team_members(team_id,user_id,display_name) VALUES(?,?,?)", id, actor.userId(), name(actor.userId()));
        return id;
    }

    @Transactional
    public void editTeam(WorkActor actor, long team, TeamInput input) {
        owner(team, actor);
        validateTeam(input);
        if (input.version() == null || db.update("""
            UPDATE dev_teams SET name=?,description=?,skills=?,accepting_work=?,version=version+1,updated_at=UTC_TIMESTAMP(6)
            WHERE id=? AND version=?
            """, input.name().strip(), input.description().strip(), input.skills().strip(), input.acceptingWork(), team, input.version()) != 1) {
            throw conflict("Hồ sơ đã thay đổi. Vui lòng tải lại.");
        }
    }

    @Transactional
    public void invite(WorkActor actor, long team, String email) {
        owner(team, actor);
        var recipient = directory.recipient(email.strip().toLowerCase(Locale.ROOT));
        teamWorkspace.invite(actor,team,recipient.id());
    }

    @Transactional
    public void invitation(WorkActor actor, long team, boolean accept) {
        teamWorkspace.respond(actor,team,accept);
    }

    @Transactional
    public void like(WorkActor actor, String type, String target, boolean value) {
        permissions.requireVerified(actor);
        if ("TEAM".equals(type)) {
            long team = Long.parseLong(target);
            if (team < 1 || !String.valueOf(team).equals(target)) throw conflict("Mã đội không hợp lệ.");
            lockTeam(team);
        }
        else if ("MEMBER".equals(type)) {
            if (!UUID.fromString(target).toString().equals(target)) throw conflict("Mã thành viên không hợp lệ.");
            if (!profiles.lockVisibleProfile(target)) {
                if(rows("SELECT user_id FROM dev_team_members WHERE user_id=? ORDER BY team_id LIMIT 1 FOR UPDATE",target).isEmpty())one("SELECT user_id FROM team_engagement_contributors WHERE user_id=? ORDER BY project_id LIMIT 1 FOR UPDATE",target);
            }
        } else throw conflict("Hồ sơ không hợp lệ.");
        boolean alreadyLiked=liked(type,target,actor.userId());
        if (value) {
            db.update("INSERT INTO profile_likes(target_type,target_id,user_id) VALUES(?,?,?) ON DUPLICATE KEY UPDATE user_id=user_id", type, target, actor.userId());
        } else db.update("DELETE FROM profile_likes WHERE target_type=? AND target_id=? AND user_id=?", type, target, actor.userId());
        if(value&&!alreadyLiked) {
            String recipient="MEMBER".equals(type)?target:one("SELECT owner_user_id FROM dev_teams WHERE id=?",Long.parseLong(target)).get("owner_user_id").toString();
            discovery.send(actor.userId(),recipient,"discovery.profile.liked",type,target,actor.userId()+":"+java.time.LocalDate.now(java.time.ZoneOffset.UTC),"Hồ sơ nhận được lượt thích","Một thành viên đã thích hồ sơ của bạn hoặc đội của bạn.",("TEAM".equals(type)?"/teams/":"/members/")+target);
        }
    }

    public Map<String, Object> engagement(WorkActor actor, long project) {
        permissions.requireMember(project, actor);
        var entries = rows("SELECT e.*,t.name AS team_name,t.owner_user_id AS team_owner FROM team_engagements e JOIN dev_teams t ON t.id=e.team_id WHERE project_id=?", project);
        if (entries.isEmpty()) return Map.of("configured", false);
        var result = entries.getFirst();
        result.put("configured", true);
        result.put("isCustomer", actor.userId().equals(result.get("customer_user_id")));
        result.put("isTeamOwner", actor.userId().equals(result.get("team_owner")));
        Object reopenId = result.remove("reopen_request_id");
        Object requester = result.remove("reopen_requested_by");
        if (reopenId != null && requester != null &&
                (requester.equals(result.get("customer_user_id")) || requester.equals(result.get("team_owner")))) {
            result.put("reopenRequest", Map.of("id", reopenId, "requestedByMe", actor.userId().equals(requester),
                "fromCustomer", requester.equals(result.get("customer_user_id"))));
        }
        result.put("contributors", Boolean.TRUE.equals(result.get("isCustomer")) ? List.of() : rows("SELECT c.user_id,c.display_name,c.completed_tasks,c.tracked_seconds,r.strengths,r.comment FROM team_engagement_contributors c LEFT JOIN member_recognitions r ON r.project_id=c.project_id AND r.user_id=c.user_id WHERE c.project_id=? ORDER BY c.display_name", project));
        var reviews = rows("SELECT * FROM team_reviews WHERE project_id=?", project);
        result.put("review", reviews.isEmpty() ? null : reviews.getFirst());
        return result;
    }

    @Transactional
    public void connectProject(WorkActor actor, long project, long team, String customer) {
        permissions.requireOwner(project, actor);
        owner(team, actor);
        UUID.fromString(customer);
        if (memberOf(team, customer)) throw conflict("Khách hàng phải là tài khoản ngoài đội thực hiện.");
        if (count("SELECT COUNT(*) FROM project_memberships WHERE project_id=? AND user_id=? AND status='ACTIVE'", project, customer) == 0) {
            throw conflict("Mời khách hàng vào dự án trước khi thiết lập nghiệm thu.");
        }
        var existing = rows("SELECT * FROM team_engagements WHERE project_id=? FOR UPDATE", project);
        if (!existing.isEmpty()) {
            var row = existing.getFirst();
            if (((Number) row.get("team_id")).longValue() == team && customer.equals(row.get("customer_user_id"))) return;
            throw conflict("Dự án đã liên kết với đội và khách hàng.");
        }
        db.update("INSERT INTO team_engagements(project_id,team_id,customer_user_id,customer_name) VALUES(?,?,?,?)", project, team, customer, name(customer));
        audit(project, actor, "TEAM_ENGAGEMENT_PROPOSED");
        discovery.team(actor.userId(),team,customer,"discovery.engagement.proposed",project+":engagement:"+UUID.randomUUID(),"Có đề nghị hợp tác cần xác nhận","Đội đã gửi thông tin hợp tác trong dự án. Mở Nghiệm thu & đánh giá để phản hồi.","/projects/"+project+"?tab=reputation");
    }

    @Transactional
    public void acceptEngagement(WorkActor actor, long project) {
        permissions.requireWritable(project, actor);
        var engagement = customer(project, actor);
        if (!"PROPOSED".equals(engagement.get("status"))) return;
        db.update("UPDATE team_engagements SET status='ACTIVE',accepted_at=UTC_TIMESTAMP(6) WHERE project_id=?", project);
        audit(project, actor, "TEAM_ENGAGEMENT_ACCEPTED");
        engagementNotice(actor,project,engagement,"discovery.engagement.accepted","Hợp tác đã được xác nhận","Khách hàng đã xác nhận thông tin hợp tác. Bạn có thể tiếp tục triển khai và bàn giao.","accepted");
    }

    @Transactional
    public void declineEngagement(WorkActor actor, long project) {
        permissions.requireWritable(project, actor);
        var engagement = customer(project, actor);
        if (!"PROPOSED".equals(engagement.get("status"))) throw conflict("Hợp tác đã được xác nhận.");
        db.update("DELETE FROM team_engagements WHERE project_id=?", project);
        audit(project, actor, "TEAM_ENGAGEMENT_DECLINED");
        engagementNotice(actor,project,engagement,"discovery.engagement.declined","Khách hàng chưa xác nhận hợp tác","Khách hàng đã từ chối đề nghị hợp tác. Mở dự án để xem và thống nhất lại thông tin.","declined:"+UUID.randomUUID());
    }

    @Transactional
    public void complete(WorkActor actor, long project, boolean publishProject) {
        permissions.requireVerified(actor);
        one("SELECT id FROM projects WHERE id=? FOR UPDATE", project);
        var engagement = customer(project, actor);
        if ("COMPLETED".equals(engagement.get("status"))) {
            permissions.requireMember(project, actor);
            return;
        }
        var access = permissions.requireWritable(project, actor);
        if (!"ACTIVE".equals(engagement.get("status"))) throw conflict("Khách hàng cần xác nhận hợp tác trước.");
        if (count("SELECT COUNT(*) FROM time_entries WHERE project_id=? AND ended_at IS NULL", project) > 0)
            throw conflict("Đội cần kết thúc các phiên ghi giờ đang chạy trước khi nghiệm thu.");
        if (count("SELECT COUNT(*) FROM project_milestones WHERE project_id=? AND status NOT IN ('ACCEPTED','CANCELLED')", project) > 0) {
            throw conflict("Các mốc bàn giao cần được khách hàng chấp nhận hoặc thống nhất hủy trước khi nghiệm thu toàn dự án.");
        }
        long team = ((Number) engagement.get("team_id")).longValue();
        lockTeam(team);
        if (count("SELECT COUNT(*) FROM tasks WHERE project_id=?", project) == 0
                || count("SELECT COUNT(*) FROM tasks WHERE project_id=? AND status NOT IN ('DONE','CANCELLED')", project) > 0) {
            throw conflict("Chỉ nghiệm thu khi dự án có nhiệm vụ và tất cả đã hoàn thành hoặc hủy.");
        }
        if (count("SELECT COUNT(*) FROM tasks WHERE project_id=? AND status='DONE'", project) == 0) {
            throw conflict("Dự án cần ít nhất một nhiệm vụ đã hoàn thành để nghiệm thu.");
        }
        // Keep evidence for former project members and earlier assignees, not just today's team roster.
        var contributors=rows("""
            SELECT evidence.user_id,COUNT(DISTINCT CASE WHEN evidence.kind='TASK' THEN evidence.task_id END) completed_tasks,
              SUM(evidence.seconds) tracked_seconds
            FROM (
              SELECT t.assignee_user_id user_id,t.id task_id,'TASK' kind,0 seconds FROM tasks t WHERE t.project_id=? AND t.status='DONE'
              UNION
              SELECT s.assignee_user_id,s.task_id,'TASK',0 FROM task_submissions s JOIN tasks t ON t.id=s.task_id
                WHERE s.project_id=? AND s.decision='ACCEPTED' AND t.status='DONE'
              UNION ALL
              SELECT e.user_id,e.task_id,'TIME',TIMESTAMPDIFF(SECOND,e.started_at,e.ended_at) FROM time_entries e JOIN tasks t ON t.id=e.task_id
                WHERE e.project_id=? AND t.status='DONE' AND e.ended_at>e.started_at
            ) evidence WHERE evidence.user_id<>? GROUP BY evidence.user_id
            """,project,project,project,actor.userId());
        var contributorIds=new HashSet<String>();contributors.forEach(row->contributorIds.add(row.get("user_id").toString()));
        var contributorNames=directory.names(contributorIds);
        for(var contributor:contributors){String user=contributor.get("user_id").toString();db.update("INSERT INTO team_engagement_contributors(project_id,user_id,display_name,completed_tasks,tracked_seconds) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE display_name=VALUES(display_name),completed_tasks=VALUES(completed_tasks),tracked_seconds=VALUES(tracked_seconds)",project,user,contributorNames.getOrDefault(user,"Thành viên TaskNest"),contributor.get("completed_tasks"),contributor.get("tracked_seconds"));}
        db.update("UPDATE team_engagements SET status='COMPLETED',completed_at=UTC_TIMESTAMP(6),project_public_name=? WHERE project_id=?",
            publishProject ? access.project().getName() : null, project);
        audit(project, actor, "CUSTOMER_PROJECT_ACCEPTED");
        String completion = project + ":completed:" + UUID.randomUUID();
        for(String recipient:db.queryForList("SELECT user_id FROM project_memberships WHERE project_id=? AND status='ACTIVE'",String.class,project))
            discovery.team(actor.userId(),team,recipient,"discovery.engagement.completed",completion,"Dự án đã được khách hàng nghiệm thu","Khách hàng đã xác nhận nghiệm thu toàn dự án. Mở dự án để xem kết quả hợp tác.","/projects/"+project+"?tab=reputation");
    }

    @Transactional
    public void reopen(WorkActor actor, long project, String action, String requestId) {
        permissions.requireVerified(actor);
        var projectRow = one("SELECT status FROM projects WHERE id=? FOR UPDATE", project);
        permissions.requireMember(project, actor);
        var engagement = one("SELECT * FROM team_engagements WHERE project_id=? FOR UPDATE", project);
        long team = ((Number) engagement.get("team_id")).longValue();
        String customer = engagement.get("customer_user_id").toString();
        String teamOwner = lockTeam(team).get("owner_user_id").toString();
        String user = actor.userId();
        if (!user.equals(customer) && !user.equals(teamOwner)) throw forbidden();
        if (customer.equals(teamOwner)) throw conflict("Cần hai tài khoản đại diện khác nhau để đồng ý mở lại.");
        if (!"ACTIVE".equals(projectRow.get("status")) || !"COMPLETED".equals(engagement.get("status")))
            throw conflict("Chỉ có thể yêu cầu mở lại dự án đã hoàn thành đang ở ngoài kho lưu trữ.");

        String other = user.equals(customer) ? teamOwner : customer;
        String pending = (String) engagement.get("reopen_request_id");
        String requestedBy = (String) engagement.get("reopen_requested_by");
        String transition;
        String title;
        String message;
        if ("REQUEST".equals(action)) {
            if (pending != null && (customer.equals(requestedBy) || teamOwner.equals(requestedBy)))
                throw conflict("Dự án đang có yêu cầu mở lại chờ phản hồi.");
            transition = UUID.randomUUID().toString();
            db.update("UPDATE team_engagements SET reopen_request_id=?,reopen_requested_by=? WHERE project_id=?",
                transition, user, project);
            title = "Yêu cầu mở lại dự án";
            message = "Bên còn lại đã đề nghị tiếp tục dự án. Mở Nghiệm thu & đánh giá để phản hồi.";
        } else {
            if (pending == null || !pending.equals(requestId))
                throw conflict("Yêu cầu đã thay đổi. Vui lòng tải lại dự án.");
            boolean ownRequest = user.equals(requestedBy);
            if ("CANCEL".equals(action) ? !ownRequest : !other.equals(requestedBy)) throw forbidden();

            transition = pending + ":" + action;
            if ("APPROVE".equals(action)) {
                db.update("UPDATE team_engagements SET status='ACTIVE',reopen_request_id=NULL,reopen_requested_by=NULL WHERE project_id=?", project);
                title = "Dự án đã mở lại";
                message = "Hai bên đã đồng ý. Đội có thể tiếp tục triển khai dự án.";
            } else {
                db.update("UPDATE team_engagements SET reopen_request_id=NULL,reopen_requested_by=NULL WHERE project_id=?", project);
                title = "DECLINE".equals(action) ? "Yêu cầu mở lại bị từ chối" : "Yêu cầu mở lại đã được rút";
                message = "Dự án vẫn ở trạng thái đã hoàn thành.";
            }
        }
        audit(project, actor, "PROJECT_REOPEN_" + action);
        discovery.team(user, team, other, "discovery.engagement.reopen", project + ":" + transition,
            title, message, "/projects/" + project + "?tab=reputation");
    }

    @Transactional
    public void review(WorkActor actor, long project, ReviewInput input) {
        permissions.requireMember(project, actor);
        one("SELECT id FROM projects WHERE id=? FOR UPDATE", project);
        var engagement = customer(project, actor);
        boolean completed = "COMPLETED".equals(engagement.get("status"));
        var existing = rows("SELECT * FROM team_reviews WHERE project_id=? FOR UPDATE", project);
        if (existing.isEmpty()) {
            if (!completed) throw conflict("Khách hàng chỉ đánh giá sau nghiệm thu.");
            if (input.version() != null) throw conflict("Đánh giá chưa tồn tại. Vui lòng tải lại.");
            db.update("INSERT INTO team_reviews(project_id,quality,schedule,communication,support,comment,would_rehire) VALUES(?,?,?,?,?,?,?)",
                project, input.quality(), input.schedule(), input.communication(), input.support(), input.comment().strip(), input.wouldRehire());
        } else {
            permissions.requireWritable(project, actor);
            if (input.version() == null || ((Number) existing.getFirst().get("version")).longValue() != input.version()) throw conflict("Đánh giá đã thay đổi. Vui lòng tải lại.");
            db.update("UPDATE team_reviews SET quality=?,schedule=?,communication=?,support=?,comment=?,would_rehire=?,version=version+1,updated_at=UTC_TIMESTAMP(6) WHERE project_id=?",
                input.quality(), input.schedule(), input.communication(), input.support(), input.comment().strip(), input.wouldRehire(), project);
        }
        revision(project, actor);
        audit(project, actor, "CUSTOMER_REVIEW_SAVED");
        engagementNotice(actor,project,engagement,"discovery.review.created","Khách hàng đã đăng đánh giá","Dự án của đội có đánh giá mới hoặc vừa được cập nhật. Mở dự án để xem.","review:"+one("SELECT version FROM team_reviews WHERE project_id=?",project).get("version"));
    }

    @Transactional
    public void reply(WorkActor actor, long project, String comment, long version) {
        permissions.requireMember(project, actor);
        permissions.requireWritable(project, actor);
        var engagement = one("SELECT team_id FROM team_engagements WHERE project_id=?", project);
        owner(((Number) engagement.get("team_id")).longValue(), actor);
        if (db.update("UPDATE team_reviews SET reply=?,reply_updated_at=UTC_TIMESTAMP(6),version=version+1 WHERE project_id=? AND version=?", comment.strip(), project, version) != 1) {
            throw conflict("Đánh giá đã thay đổi. Vui lòng tải lại.");
        }
        revision(project, actor);
        discovery.team(actor.userId(),((Number)engagement.get("team_id")).longValue(),one("SELECT customer_user_id FROM team_engagements WHERE project_id=?",project).get("customer_user_id").toString(),"discovery.review.replied",project+":"+(version+1),"Đội đã phản hồi đánh giá","Đội thực hiện đã trả lời đánh giá của bạn. Mở dự án để xem phản hồi.","/projects/"+project+"?tab=reputation");
    }

    @Transactional
    public void recognize(WorkActor actor, long project, String user, String comment, Set<String> strengths) {
        permissions.requireMember(project, actor);
        permissions.requireWritable(project, actor);
        var engagement = customer(project, actor);
        if (engagement.get("completed_at") == null) throw conflict("Chỉ ghi nhận thành viên sau khi dự án đã từng được nghiệm thu.");
        if (user.equals(actor.userId()) || strengths == null || !STRENGTHS.containsAll(strengths)) throw conflict("Điểm mạnh không hợp lệ.");
        one("SELECT user_id FROM team_engagement_contributors WHERE project_id=? AND user_id=?", project, user);
        db.update("""
            INSERT INTO member_recognitions(project_id,user_id,strengths,comment) VALUES(?,?,?,?)
            ON DUPLICATE KEY UPDATE strengths=VALUES(strengths),comment=VALUES(comment),updated_at=UTC_TIMESTAMP(6)
            """, project, user, String.join(",", new TreeSet<>(strengths)), comment.strip());
        audit(project, actor, "MEMBER_RECOGNIZED");
        discovery.send(actor.userId(),user,"discovery.member.recognized","MEMBER",user,project+":"+UUID.nameUUIDFromBytes((comment.strip()+new TreeSet<>(strengths)).getBytes(java.nio.charset.StandardCharsets.UTF_8)),"Bạn nhận được lời ghi nhận từ khách hàng","Khách hàng đã ghi nhận đóng góp của bạn sau nghiệm thu. Mở hồ sơ để xem.","/members/"+user);
    }

    public List<Map<String, Object>> history(WorkActor actor, long project) {
        permissions.requireMember(project, actor);
        return rows("SELECT id,actor_user_id,content,created_at FROM team_review_history WHERE project_id=? ORDER BY id DESC LIMIT 100", project);
    }

    private void engagementNotice(WorkActor actor,long project,Map<String,Object> engagement,String type,String title,String body,String transition) {
        long team=((Number)engagement.get("team_id")).longValue();
        String recipient=one("SELECT owner_user_id FROM dev_teams WHERE id=?",team).get("owner_user_id").toString();
        discovery.team(actor.userId(),team,recipient,type,project+":"+transition,title,body,"/projects/"+project+"?tab=reputation");
    }
    private void revision(long project, WorkActor actor) {
        var review = one("SELECT quality,schedule,communication,support,comment,would_rehire,reply,version FROM team_reviews WHERE project_id=?", project);
        db.update("INSERT INTO team_review_history(project_id,actor_user_id,content) VALUES(?,?,?)", project, actor.userId(), json.writeValueAsString(review));
    }
    private Map<String, Object> customer(long project, WorkActor actor) {
        var engagement = one("SELECT * FROM team_engagements WHERE project_id=? FOR UPDATE", project);
        if (!actor.userId().equals(engagement.get("customer_user_id"))) throw forbidden();
        return engagement;
    }
    private void owner(long team, WorkActor actor) {
        permissions.requireVerified(actor);
        if (!actor.userId().equals(lockTeam(team).get("owner_user_id"))) throw forbidden();
    }
    private Map<String, Object> lockTeam(long team) {
        return one("SELECT * FROM dev_teams WHERE id=? FOR UPDATE", team);
    }
    private boolean memberOf(long team, String user) {
        return count("SELECT COUNT(*) FROM dev_team_members WHERE team_id=? AND user_id=?", team, user) > 0;
    }
    private boolean liked(String type, String target, String user) {
        return count("SELECT COUNT(*) FROM profile_likes WHERE target_type=? AND target_id=? AND user_id=?", type, target, user) > 0;
    }
    private String name(String user) {
        return directory.names(Set.of(user)).getOrDefault(user, "Thành viên TaskNest");
    }
    private long count(String sql, Object... parameters) {
        return Objects.requireNonNull(db.queryForObject(sql, Long.class, parameters));
    }
    private List<Map<String, Object>> rows(String sql, Object... parameters) {
        return ApiValues.utc(db.queryForList(sql, parameters));
    }
    private Map<String, Object> one(String sql, Object... parameters) {
        var rows = rows(sql, parameters);
        if (rows.isEmpty()) throw new WorkException(HttpStatus.NOT_FOUND, "COMMUNITY_NOT_FOUND", "Không tìm thấy nội dung.");
        return rows.getFirst();
    }
    private void audit(long project, WorkActor actor, String action) {
        db.update("INSERT INTO activity_logs(project_id,actor_user_id,action,entity_type,entity_id) VALUES(?,?,?,'TEAM_ENGAGEMENT',?)", project, actor.userId(), action, String.valueOf(project));
    }
    private void checkPage(int page) {
        if (page < 0 || page > 10000) throw conflict("Trang không hợp lệ.");
    }
    private void validateTeam(TeamInput input) {
        if (input.name().strip().length() < 3 || input.description().strip().length() < 10) {
            throw conflict("Tên đội cần ít nhất 3 ký tự và giới thiệu cần ít nhất 10 ký tự sau khi bỏ khoảng trắng.");
        }
    }
    private WorkException conflict(String message) {
        return new WorkException(HttpStatus.CONFLICT, "COMMUNITY_CONFLICT", message);
    }
    private WorkException forbidden() {
        return new WorkException(HttpStatus.FORBIDDEN, "COMMUNITY_FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.");
    }
}

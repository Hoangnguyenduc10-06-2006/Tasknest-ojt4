package vn.tasknest.workservice.application.community;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.Statement;
import java.time.*;
import java.time.temporal.ChronoUnit;
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
import vn.tasknest.workservice.application.workspace.WorkNotificationService;
import vn.tasknest.workservice.domain.project.*;
import vn.tasknest.workservice.infrastructure.identity.IdentityDirectoryClient;
import vn.tasknest.workservice.infrastructure.persistence.*;

@Service
public class MarketplaceService {
    private final DiscoveryNotifications discovery;
    private final JdbcTemplate db;
    private final ProjectPermissionService permissions;
    private final IdentityDirectoryClient directory;
    private final ProjectRepository projects;
    private final ProjectMembershipRepository memberships;
    private final ProjectStorageRepository storage;
    private final ProjectActivityRepository activity;
    private final WorkNotificationService notifications;
    private final Clock clock;
    private final JsonMapper json = new JsonMapper();
    public record RequestInput(String title, String description, String skills, BigDecimal budgetMin,
            BigDecimal budgetMax, LocalDate desiredDelivery, String referenceUrl, boolean publish,
            String requestId, Long version,
            @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL) List<String> images,
            @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL) List<Integer> keepImages) {}
    public record ProposalInput(long teamId, long requestVersion, String plan, BigDecimal amount,
            LocalDate startsOn, LocalDate endsOn, Long version) {}
    private static final String REQUEST_SELECT = """
        SELECT r.*, (SELECT COUNT(*) FROM request_post_images i WHERE i.post_id=r.id) image_count,
          (SELECT COUNT(*) FROM team_project_proposals p WHERE p.request_id=r.id AND p.status IN ('SUBMITTED','ACCEPTED')) AS proposal_count,
          (SELECT t.name FROM team_project_proposals p JOIN dev_teams t ON t.id=p.team_id WHERE p.request_id=r.id AND p.status='ACCEPTED') AS selected_team_name
        FROM customer_project_requests r
        """;
    public MarketplaceService(JdbcTemplate db, ProjectPermissionService permissions, IdentityDirectoryClient directory,
            ProjectRepository projects, ProjectMembershipRepository memberships, ProjectStorageRepository storage,
            ProjectActivityRepository activity, WorkNotificationService notifications, Clock clock,DiscoveryNotifications discovery) {
        this.discovery=discovery; this.db=db; this.permissions=permissions; this.directory=directory; this.projects=projects;
        this.memberships=memberships; this.storage=storage; this.activity=activity; this.notifications=notifications; this.clock=clock;
    }
    public Map<String,Object> list(WorkActor actor, boolean mine, String search, int page) {
        if (page<0 || page>10000) throw invalid("Trang không hợp lệ.");
        if (mine) permissions.requireVerified(actor);
        String condition = mine ? "r.customer_user_id=?" : "r.status='OPEN'";
        List<Object> args = new ArrayList<>();
        if (mine) args.add(actor.userId());
        condition += " AND LOCATE(LOWER(?),LOWER(CONCAT(r.title,' ',r.skills)))>0";
        args.add(search.strip());
        long total = db.queryForObject("SELECT COUNT(*) FROM customer_project_requests r WHERE "+condition,Long.class,args.toArray());
        args.add(page*12);
        var items=rows(REQUEST_SELECT+" WHERE "+condition+" ORDER BY r.updated_at DESC,r.id DESC LIMIT 12 OFFSET ?",args.toArray());
        items.forEach(this::removeCreationFields);
        return Map.of("items",items,"total",total,"page",page);
    }
    public Map<String,Object> detail(WorkActor actor, long id) {
        var request=one(REQUEST_SELECT+" WHERE r.id=?",id);
        boolean owner=actor!=null && actor.userId().equals(request.get("customer_user_id"));
        if ("DRAFT".equals(request.get("status")) && !owner) throw missing();
        request.put("isOwner",owner);
        request.put("canAccessProject",actor!=null && request.get("project_id")!=null
            && count("SELECT COUNT(*) FROM project_memberships WHERE project_id=? AND user_id=? AND status='ACTIVE'",request.get("project_id"),actor.userId())>0);
        removeCreationFields(request);
        return request;
    }
    @Transactional
    public long create(WorkActor actor, RequestInput input) {
        permissions.requireVerified(actor);
        validate(input);
        String requestId=UUID.fromString(input.requestId()).toString();
        byte[] hash=hash(json.writeValueAsString(input));
        var prior=rows("SELECT id,creation_hash FROM customer_project_requests WHERE customer_user_id=? AND creation_request_id=?",actor.userId(),requestId);
        if (!prior.isEmpty()) {
            if (!MessageDigest.isEqual(hash,(byte[])prior.getFirst().get("creation_hash"))) throw conflict("Mã tạo yêu cầu đã được dùng cho nội dung khác.");
            return ((Number)prior.getFirst().get("id")).longValue();
        }
        String reference=ProfessionalProfileService.safeUrl(input.referenceUrl());
        String customer=directory.names(Set.of(actor.userId())).get(actor.userId());
        if (customer==null) throw conflict("Không thể đọc tên tài khoản. Vui lòng thử lại.");
        var key=new GeneratedKeyHolder();
        db.update(connection -> {
            var statement=connection.prepareStatement("""
                INSERT INTO customer_project_requests(customer_user_id,customer_name,title,description,skills,budget_min,budget_max,
                  desired_delivery,reference_url,status,creation_request_id,creation_hash)
                VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
                """,Statement.RETURN_GENERATED_KEYS);
            Object[] values={actor.userId(),customer,input.title().strip(),input.description().strip(),input.skills().strip(),
                input.budgetMin(),input.budgetMax(),input.desiredDelivery(),reference,input.publish()?"OPEN":"DRAFT",requestId,hash};
            for(int index=0;index<values.length;index++) statement.setObject(index+1,values[index]);
            return statement;
        },key);
        long created=Objects.requireNonNull(key.getKey()).longValue();
        DiscoveryPostImage.write(db,DiscoveryPostImage.Kind.REQUEST,created,input.images(),null);
        revision("REQUEST",created,actor);
        return created;
    }
    @Transactional
    public void edit(WorkActor actor,long id,RequestInput input) {
        var request=owned(actor,id);
        writable(request);
        requireVersion(request,input.version());
        validate(input);
        revision("REQUEST",id,actor);
        String status="DRAFT".equals(request.get("status")) && input.publish() ? "OPEN" : (String)request.get("status");
        if ("OPEN".equals(status)) requireFutureDelivery(input.desiredDelivery());
        db.update("""
            UPDATE customer_project_requests SET title=?,description=?,skills=?,budget_min=?,budget_max=?,desired_delivery=?,
              reference_url=?,status=?,version=version+1,updated_at=UTC_TIMESTAMP(6) WHERE id=?
            """,input.title().strip(),input.description().strip(),input.skills().strip(),input.budgetMin(),input.budgetMax(),
            input.desiredDelivery(),ProfessionalProfileService.safeUrl(input.referenceUrl()),status,id);
        DiscoveryPostImage.write(db,DiscoveryPostImage.Kind.REQUEST,id,input.images(),input.keepImages());
        revision("REQUEST",id,actor);
        notifyProposers(actor,id,"discovery.request.updated",String.valueOf(((Number)request.get("version")).longValue()+1),"Yêu cầu dự án đã được cập nhật","Khách hàng đã thay đổi yêu cầu. Hãy kiểm tra phạm vi và gửi lại đề xuất nếu cần.");
    }
    @Transactional
    public void changeStatus(WorkActor actor,long id,String status,long version) {
        var request=owned(actor,id);
        writable(request);
        requireVersion(request,version);
        if (!Set.of("OPEN","PAUSED","CLOSED").contains(status)) throw invalid("Trạng thái không hợp lệ.");
        if ("DRAFT".equals(request.get("status")) && !"OPEN".equals(status)) throw invalid("Bản nháp chỉ được chuyển sang đăng công khai sau khi bạn xác nhận.");
        if (status.equals(request.get("status"))) return;
        if ("OPEN".equals(status)) requireFutureDelivery((LocalDate)request.get("desired_delivery"));
        revision("REQUEST",id,actor);
        db.update("UPDATE customer_project_requests SET status=?,version=version+1,updated_at=UTC_TIMESTAMP(6) WHERE id=?",status,id);
        revision("REQUEST",id,actor);
        notifyProposers(actor,id,"discovery.request.status",String.valueOf(version+1),"Yêu cầu dự án đổi trạng thái","Khách hàng đã cập nhật trạng thái nhận đề xuất. Mở yêu cầu để xem trạng thái hiện tại.");
    }
    public Map<String,Object> proposals(WorkActor actor,long requestId,int page,Long teamId) {return proposals(actor,requestId,page,teamId,null);}
    public Map<String,Object> proposals(WorkActor actor,long requestId,int page,Long teamId,Long proposalId) {
        permissions.requireVerified(actor);
        if(page<0 || page>10000) throw invalid("Trang không hợp lệ.");
        var request=detail(actor,requestId);
        String condition=Boolean.TRUE.equals(request.get("isOwner")) ? "" : " AND t.owner_user_id=?";
        var parameters=new ArrayList<Object>();
        parameters.add(requestId);
        if (!condition.isEmpty()) parameters.add(actor.userId());
        if (teamId!=null) {
            if (teamId<1) throw invalid("Đội không hợp lệ.");
            condition+=" AND p.team_id=?";
            parameters.add(teamId);
        }
        if(proposalId!=null){if(proposalId<1)throw invalid("Đề xuất không hợp lệ.");condition+=" AND p.id=?";parameters.add(proposalId);}
        long total=db.queryForObject("SELECT COUNT(*) FROM team_project_proposals p JOIN dev_teams t ON t.id=p.team_id WHERE p.request_id=?"+condition,Long.class,parameters.toArray());
        parameters.add(page*20);
        parameters.add(0,actor.userId());
        parameters.add(0,actor.userId());
        var items=rows("""
            SELECT p.*,t.name AS team_name,t.owner_user_id AS team_owner,
              (SELECT COUNT(*) FROM proposal_messages m WHERE m.proposal_id=p.id) AS message_count,
              (SELECT COUNT(*) FROM proposal_messages m WHERE m.proposal_id=p.id AND m.sender_user_id<>?
                AND m.id>COALESCE((SELECT r.last_message_id FROM proposal_message_reads r WHERE r.proposal_id=p.id AND r.user_id=?),0)) AS unread_messages,
              (SELECT COUNT(*) FROM dev_team_members m WHERE m.team_id=t.id) AS member_count
            FROM team_project_proposals p JOIN dev_teams t ON t.id=p.team_id
            WHERE p.request_id=?
            """+condition+" ORDER BY p.updated_at DESC,p.id DESC LIMIT 20 OFFSET ?",parameters.toArray());
        return Map.of("items",items,"total",total,"page",page);
    }
    @Transactional
    public void propose(WorkActor actor,long requestId,ProposalInput input) {
        permissions.requireVerified(actor);
        var request=one("SELECT * FROM customer_project_requests WHERE id=? FOR UPDATE",requestId);
        if (!"OPEN".equals(request.get("status"))) throw conflict("Yêu cầu đang dừng nhận đề xuất.");
        requireVersion(request,input.requestVersion());
        var team=one("SELECT * FROM dev_teams WHERE id=? FOR UPDATE",input.teamId());
        if (!actor.userId().equals(team.get("owner_user_id"))) throw forbidden();
        if (!Boolean.TRUE.equals(team.get("accepting_work"))) throw conflict("Bật trạng thái nhận dự án trong hồ sơ đội trước khi gửi đề xuất.");
        if (count("SELECT COUNT(*) FROM dev_team_members WHERE team_id=? AND user_id=?",input.teamId(),request.get("customer_user_id"))>0) {
            throw conflict("Đội thực hiện phải độc lập với khách hàng đăng yêu cầu.");
        }
        if (input.plan().strip().length()<20 || input.endsOn().isBefore(input.startsOn())) throw invalid("Điền kế hoạch ít nhất 20 ký tự và ngày bàn giao không trước ngày bắt đầu.");
        requireFutureDelivery(input.endsOn());
        var prior=rows("SELECT id,version FROM team_project_proposals WHERE request_id=? AND team_id=? FOR UPDATE",requestId,input.teamId());
        if (prior.isEmpty()) {
            if (input.version()!=null) throw conflict("Đề xuất chưa tồn tại. Vui lòng tải lại.");
            db.update("""
                INSERT INTO team_project_proposals(request_id,team_id,submitted_by,request_version,plan,amount,starts_on,ends_on)
                VALUES(?,?,?,?,?,?,?,?)
                """,requestId,input.teamId(),actor.userId(),input.requestVersion(),input.plan().strip(),input.amount(),input.startsOn(),input.endsOn());
        } else {
            requireVersion(prior.getFirst(),input.version());
            revision("PROPOSAL",((Number)prior.getFirst().get("id")).longValue(),actor);
            db.update("""
                UPDATE team_project_proposals SET request_version=?,plan=?,amount=?,starts_on=?,ends_on=?,status='SUBMITTED',
                  version=version+1,updated_at=UTC_TIMESTAMP(6) WHERE id=?
                """,input.requestVersion(),input.plan().strip(),input.amount(),input.startsOn(),input.endsOn(),prior.getFirst().get("id"));
        }
        var saved=one("SELECT id,version FROM team_project_proposals WHERE request_id=? AND team_id=?",requestId,input.teamId());
        revision("PROPOSAL",((Number)saved.get("id")).longValue(),actor);
        discovery.request(actor.userId(),requestId,request.get("customer_user_id").toString(),prior.isEmpty()?"discovery.proposal.created":"discovery.proposal.updated",saved.get("id")+":"+saved.get("version"),prior.isEmpty()?"Có đội gửi đề xuất thực hiện":"Đội đã cập nhật đề xuất","Mở yêu cầu dự án để xem kế hoạch, chi phí và trao đổi với đội.","/requests/"+requestId+"?proposal="+saved.get("id"));

    }
    @Transactional
    public void withdraw(WorkActor actor,long requestId,long proposalId,long version) {
        permissions.requireVerified(actor);
        writable(one("SELECT * FROM customer_project_requests WHERE id=? FOR UPDATE",requestId));
        var proposal=one("SELECT p.*,t.owner_user_id FROM team_project_proposals p JOIN dev_teams t ON t.id=p.team_id WHERE p.id=? AND p.request_id=? FOR UPDATE",proposalId,requestId);
        if (!actor.userId().equals(proposal.get("owner_user_id"))) throw forbidden();
        requireVersion(proposal,version);
        if (!"SUBMITTED".equals(proposal.get("status"))) throw conflict("Đề xuất không còn chờ xét.");
        revision("PROPOSAL",proposalId,actor);
        db.update("UPDATE team_project_proposals SET status='WITHDRAWN',version=version+1,updated_at=UTC_TIMESTAMP(6) WHERE id=?",proposalId);
        revision("PROPOSAL",proposalId,actor);
        discovery.request(actor.userId(),requestId,one("SELECT customer_user_id FROM customer_project_requests WHERE id=?",requestId).get("customer_user_id").toString(),"discovery.proposal.withdrawn",proposalId+":"+(version+1),"Đội đã rút đề xuất","Một đội đã rút đề xuất thực hiện. Mở yêu cầu dự án để xem danh sách cập nhật.","/requests/"+requestId+"?proposal="+proposalId);
    }
    @Transactional
    public long award(WorkActor actor,long requestId,long proposalId,long version) {
        var request=owned(actor,requestId);
        var proposal=one("SELECT * FROM team_project_proposals WHERE id=? AND request_id=? FOR UPDATE",proposalId,requestId);
        if ("AWARDED".equals(request.get("status"))) {
            if ("ACCEPTED".equals(proposal.get("status"))) return ((Number)request.get("project_id")).longValue();
            throw conflict("Khách hàng đã chọn một đội khác.");
        }
        if (!"OPEN".equals(request.get("status")) || !"SUBMITTED".equals(proposal.get("status"))) throw conflict("Yêu cầu hoặc đề xuất không còn mở.");
        requireVersion(proposal,version);
        if (((Number)proposal.get("request_version")).longValue()!=((Number)request.get("version")).longValue()) {
            throw conflict("Yêu cầu đã được cập nhật. Đội cần gửi lại đề xuất theo nội dung mới.");
        }
        LocalDate starts=(LocalDate)proposal.get("starts_on"), ends=(LocalDate)proposal.get("ends_on");
        requireFutureDelivery(ends);
        long teamId=((Number)proposal.get("team_id")).longValue();
        var team=one("SELECT * FROM dev_teams WHERE id=? FOR UPDATE",teamId);
        if (count("SELECT COUNT(*) FROM dev_team_members WHERE team_id=? AND user_id=?",teamId,actor.userId())>0) throw conflict("Khách hàng hiện là thành viên của đội này.");
        var now=clock.instant().truncatedTo(ChronoUnit.MICROS);
        String title=limit(request.get("title").toString(),75)+" · YC-"+requestId;
        Project project=projects.saveAndFlush(Project.create(team.get("owner_user_id").toString(),title,
            limit(request.get("description").toString(),500),starts,ends,now));
        var users=new LinkedHashSet<String>();
        users.add(team.get("owner_user_id").toString());
        users.add(actor.userId());
        for(String user:users) memberships.save(ProjectMembership.join(project.getId(),user,actor.userId(),now));
        memberships.flush();
        storage.initialize(project.getId());
        activity.recordCreated(project,actor.userId());
        db.update("INSERT INTO team_engagements(project_id,team_id,customer_user_id,customer_name,status,accepted_at) VALUES(?,?,?,?,'ACTIVE',?)",
            project.getId(),teamId,actor.userId(),request.get("customer_name"),java.sql.Timestamp.from(now));
        var agreement=new LinkedHashMap<String,Object>();
        agreement.put("title",request.get("title"));agreement.put("description",request.get("description"));agreement.put("skills",request.get("skills"));agreement.put("plan",proposal.get("plan"));agreement.put("amount",proposal.get("amount"));agreement.put("startsOn",starts.toString());agreement.put("endsOn",ends.toString());agreement.put("teamId",teamId);agreement.put("teamName",team.get("name"));agreement.put("customerId",actor.userId());agreement.put("customerName",request.get("customer_name"));agreement.put("requestVersion",proposal.get("request_version"));agreement.put("proposalVersion",version);
        db.update("INSERT INTO project_agreements(project_id,request_id,proposal_id,snapshot) VALUES(?,?,?,?)",project.getId(),requestId,proposalId,json.writeValueAsString(agreement));
        for(var other:rows("SELECT p.id,t.owner_user_id FROM team_project_proposals p JOIN dev_teams t ON t.id=p.team_id WHERE p.request_id=? AND p.id<>? AND p.status='SUBMITTED'",requestId,proposalId))
            discovery.request(actor.userId(),requestId,other.get("owner_user_id").toString(),"discovery.proposal.declined",other.get("id")+":"+project.getId(),"Yêu cầu đã chọn đội thực hiện","Khách hàng đã chọn một đội khác. Mở đề xuất của bạn để xem kết quả.","/requests/"+requestId+"?proposal="+other.get("id"));
        var changedProposals=db.queryForList("SELECT id FROM team_project_proposals WHERE request_id=? AND status='SUBMITTED'",Long.class,requestId);
        revision("REQUEST",requestId,actor);
        changedProposals.forEach(id->revision("PROPOSAL",id,actor));
        db.update("UPDATE team_project_proposals SET status=CASE WHEN id=? THEN 'ACCEPTED' ELSE 'DECLINED' END,version=version+1,updated_at=UTC_TIMESTAMP(6) WHERE request_id=? AND status='SUBMITTED'",proposalId,requestId);
        db.update("UPDATE customer_project_requests SET status='AWARDED',project_id=?,version=version+1,updated_at=UTC_TIMESTAMP(6) WHERE id=?",project.getId(),requestId);
        revision("REQUEST",requestId,actor);
        changedProposals.forEach(id->revision("PROPOSAL",id,actor));
        for(String user:users) notifications.send(project.getId(),null,actor.userId(),user,"work.project-awarded",
            "Dự án hợp tác đã được tạo","Khách hàng đã chọn đội thực hiện. Mở dự án để xem và bắt đầu công việc.",false,List.of(),false);
        return project.getId();
    }
    private void revision(String type,long id,WorkActor actor) {
        var value=one("SELECT * FROM "+("REQUEST".equals(type)?"customer_project_requests":"team_project_proposals")+" WHERE id=?",id);
        removeCreationFields(value);
        db.update("INSERT IGNORE INTO marketplace_revisions(resource_type,resource_id,version,actor_user_id,snapshot) VALUES(?,?,?,?,?)",type,id,value.get("version"),actor.userId(),json.writeValueAsString(value));
    }
    private void notifyProposers(WorkActor actor,long request,String type,String version,String title,String body) {
        for(var row:rows("SELECT p.id,t.owner_user_id FROM team_project_proposals p JOIN dev_teams t ON t.id=p.team_id WHERE p.request_id=? AND p.status='SUBMITTED'",request))
            discovery.request(actor.userId(),request,row.get("owner_user_id").toString(),type,version+":"+row.get("id"),title,body,"/requests/"+request+"?proposal="+row.get("id"));
    }
    private Map<String,Object> owned(WorkActor actor,long id) {
        permissions.requireVerified(actor);
        var request=one("SELECT * FROM customer_project_requests WHERE id=? FOR UPDATE",id);
        if (!actor.userId().equals(request.get("customer_user_id"))) throw forbidden();
        return request;
    }
    private void validate(RequestInput input) {
        if (input.title().strip().length()<3 || input.description().strip().length()<30) throw invalid("Tên yêu cầu cần ít nhất 3 ký tự, mô tả cần ít nhất 30 ký tự.");
        if (input.budgetMin()!=null && input.budgetMax()!=null && input.budgetMax().compareTo(input.budgetMin())<0) throw invalid("Ngân sách tối đa không được nhỏ hơn tối thiểu.");
        if (input.publish()) requireFutureDelivery(input.desiredDelivery());
    }
    private void writable(Map<String,Object> request) {
        if ("AWARDED".equals(request.get("status"))) throw conflict("Yêu cầu đã chọn đội. Các thay đổi được trao đổi trong dự án.");
    }
    private void requireVersion(Map<String,Object> value,Long version) {
        if (version==null || ((Number)value.get("version")).longValue()!=version) throw conflict("Nội dung đã thay đổi. Vui lòng tải lại trước khi lưu.");
    }
    private void requireFutureDelivery(LocalDate date) {
        if (date.isBefore(LocalDate.now(clock.withZone(ZoneId.of("Asia/Ho_Chi_Minh"))))) throw invalid("Ngày bàn giao không được ở trong quá khứ.");
    }
    private String limit(String value,int maximum) {
        return value.substring(0,value.offsetByCodePoints(0,Math.min(maximum,value.codePointCount(0,value.length()))));
    }
    private void removeCreationFields(Map<String,Object> request) {
        request.remove("creation_hash"); request.remove("creation_request_id");
    }
    private byte[] hash(String value) {
        try { return MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)); }
        catch(NoSuchAlgorithmException exception) { throw new IllegalStateException(exception); }
    }
    private long count(String sql,Object... args) { return db.queryForObject(sql,Long.class,args); }
    private List<Map<String,Object>> rows(String sql,Object... args) { return ApiValues.utc(db.queryForList(sql,args)); }
    private Map<String,Object> one(String sql,Object... args) {
        var rows=rows(sql,args);
        if (rows.isEmpty()) throw missing();
        return rows.getFirst();
    }
    private WorkException missing() { return new WorkException(HttpStatus.NOT_FOUND,"REQUEST_NOT_FOUND","Không tìm thấy yêu cầu hoặc đề xuất."); }
    private WorkException forbidden() { return new WorkException(HttpStatus.FORBIDDEN,"REQUEST_FORBIDDEN","Bạn không có quyền thực hiện thao tác này."); }
    private WorkException invalid(String message) { return new WorkException(HttpStatus.BAD_REQUEST,"INVALID_REQUEST",message); }
    private WorkException conflict(String message) { return new WorkException(HttpStatus.CONFLICT,"REQUEST_CHANGED",message); }
}

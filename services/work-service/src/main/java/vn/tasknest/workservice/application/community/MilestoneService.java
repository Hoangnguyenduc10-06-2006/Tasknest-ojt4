package vn.tasknest.workservice.application.community;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.Statement;
import java.time.LocalDate;
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
import vn.tasknest.workservice.domain.project.ProjectRole;
import vn.tasknest.workservice.infrastructure.identity.IdentityDirectoryClient;

@Service
public class MilestoneService {
    private final JdbcTemplate db;
    private final ProjectPermissionService permissions;
    private final IdentityDirectoryClient directory;
    private final WorkNotificationService notifications;
    private final JsonMapper json=new JsonMapper();
    public record Plan(String title,List<String> criteria,LocalDate dueOn,Set<Long> taskIds,String requestId,Long version) {}
    public record Delivery(String note,String resultUrl,String requestId,long version) {}
    public record Review(boolean accepted,String feedback,Set<Integer> checkedCriteria,long version) {}

    public MilestoneService(JdbcTemplate db,ProjectPermissionService permissions,IdentityDirectoryClient directory,WorkNotificationService notifications) {
        this.db=db;this.permissions=permissions;this.directory=directory;this.notifications=notifications;
    }
    public Map<String,Object> list(WorkActor actor,long project,int page) {
        var access=permissions.requireMember(project,actor);
        page(page);
        var engagements=rows("SELECT customer_user_id,status FROM team_engagements WHERE project_id=?",project);
        boolean customer=!engagements.isEmpty()&&actor.userId().equals(engagements.getFirst().get("customer_user_id"));
        boolean writable=access.project().getStatus().name().equals("ACTIVE")&&!engagements.isEmpty()&&"ACTIVE".equals(engagements.getFirst().get("status"));
        var totals=one("""
            SELECT COUNT(*) AS total,
              COALESCE(SUM(status='ACCEPTED'),0) AS accepted,
              COALESCE(SUM(status='IN_REVIEW'),0) AS awaiting_review,
              COALESCE(SUM(status='CHANGES_REQUESTED'),0) AS changes_requested
            FROM project_milestones WHERE project_id=?
            """,project);
        var items=rows("""
            SELECT m.*,
              (SELECT COUNT(*) FROM milestone_tasks l WHERE l.milestone_id=m.id) AS task_count,
              (SELECT COUNT(*) FROM milestone_tasks l JOIN tasks t ON t.id=l.task_id AND t.project_id=l.project_id
                WHERE l.milestone_id=m.id AND t.status IN ('DONE','CANCELLED')) AS closed_tasks,
              (SELECT COUNT(*) FROM milestone_submissions s WHERE s.milestone_id=m.id) AS submission_count
            FROM project_milestones m WHERE m.project_id=? ORDER BY m.due_on,m.id LIMIT 20 OFFSET ?
            """,project,page*20);
        items.forEach(this::decodeMilestone);
        var result=new LinkedHashMap<String,Object>();
        result.put("items",items);result.put("counts",totals);result.put("page",page);
        result.put("configured",!engagements.isEmpty());
        result.put("canManage",writable&&!customer&&access.role().canManage());
        result.put("canReview",writable&&customer);
        result.put("readOnly",!writable);
        return result;
    }
    public Map<String,Object> detail(WorkActor actor,long project,long milestone,int page) {
        var access = permissions.requireMember(project,actor);page(page);
        var result=one("SELECT * FROM project_milestones WHERE project_id=? AND id=?",project,milestone);
        decodeMilestone(result);
        result.put("tasks",access.role()==vn.tasknest.workservice.domain.project.ProjectRole.CUSTOMER ? List.of() : rows("SELECT t.id,t.name,t.status FROM milestone_tasks l JOIN tasks t ON t.project_id=l.project_id AND t.id=l.task_id WHERE l.project_id=? AND l.milestone_id=? ORDER BY t.id",project,milestone));
        var submissions=rows("SELECT * FROM milestone_submissions WHERE milestone_id=? ORDER BY submission_no DESC LIMIT 10 OFFSET ?",milestone,page*10);
        for(var submission:submissions) {
            submission.remove("request_hash");submission.remove("request_id");
            submission.put("criteria",json.readValue(submission.get("criteria").toString(),List.class));
            if(submission.get("checked_criteria")!=null) submission.put("checked_criteria",json.readValue(submission.get("checked_criteria").toString(),List.class));
        }
        result.put("submissions",submissions);
        result.put("submissionCount",count("SELECT COUNT(*) FROM milestone_submissions WHERE milestone_id=?",milestone));
        return result;
    }
    @Transactional
    public long save(WorkActor actor,long project,Long id,Plan input) {
        var engagement=active(actor,project);
        manager(actor,project,engagement);
        String requestId=UUID.fromString(input.requestId()).toString();
        byte[] hash=hash(input);
        if(id==null) {
            var previous=rows("SELECT id,creation_hash FROM project_milestones WHERE project_id=? AND created_by=? AND creation_request_id=?",project,actor.userId(),requestId);
            if(!previous.isEmpty()) {
                if(!MessageDigest.isEqual(hash,(byte[])previous.getFirst().get("creation_hash"))) throw conflict("Mã tạo mốc đã được dùng cho nội dung khác.");
                return ((Number)previous.getFirst().get("id")).longValue();
            }
        } else {
            var current=milestone(project,id);
            version(current,input.version());
            if(!"DRAFT".equals(current.get("status"))) throw conflict("Kế hoạch đã được khách hàng xác nhận. Tiêu chí và nhiệm vụ liên kết được giữ theo thỏa thuận.");
        }
        String title=input.title().strip();
        if(title.isEmpty()||input.criteria().stream().anyMatch(String::isBlank)) throw invalid("Điền tên mốc và các tiêu chí nghiệm thu.");
        for(long task:input.taskIds()) {
            if(count("SELECT COUNT(*) FROM tasks WHERE project_id=? AND id=?",project,task)!=1) throw invalid("Chỉ liên kết nhiệm vụ thuộc dự án này.");
        }
        String criteria=json.writeValueAsString(input.criteria().stream().map(String::strip).toList());
        if(id==null) {
            var key=new GeneratedKeyHolder();
            db.update(connection->{
                var statement=connection.prepareStatement("INSERT INTO project_milestones(project_id,title,criteria,due_on,created_by,creation_request_id,creation_hash) VALUES(?,?,?,?,?,?,?)",Statement.RETURN_GENERATED_KEYS);
                Object[] values={project,title,criteria,input.dueOn(),actor.userId(),requestId,hash};
                for(int index=0;index<values.length;index++)statement.setObject(index+1,values[index]);
                return statement;
            },key);
            id=Objects.requireNonNull(key.getKey()).longValue();
        } else {
            db.update("UPDATE project_milestones SET title=?,criteria=?,due_on=?,version=version+1,updated_at=UTC_TIMESTAMP(6) WHERE id=?",title,criteria,input.dueOn(),id);
            db.update("DELETE FROM milestone_tasks WHERE milestone_id=?",id);
        }
        for(long task:input.taskIds())db.update("INSERT INTO milestone_tasks(project_id,milestone_id,task_id) VALUES(?,?,?)",project,id,task);
        audit(project,actor,id,"MILESTONE_PLAN_SAVED");
        notifications.sendTo(project,null,actor.userId(),engagement.get("customer_user_id").toString(),"work.milestone-plan","Có kế hoạch mốc bàn giao cần xác nhận",title,false,List.of(),false,"/projects/"+project+"?tab=milestones&milestone="+id);
        return id;
    }
    @Transactional
    public void approvePlan(WorkActor actor,long project,long id,long expectedVersion) {
        var engagement=active(actor,project);customer(actor,engagement);
        var milestone=milestone(project,id);
        if(!"DRAFT".equals(milestone.get("status")))throw conflict("Mốc không còn chờ xác nhận kế hoạch.");
        version(milestone,expectedVersion);
        db.update("UPDATE project_milestones SET status='ACTIVE',plan_approved_by=?,plan_approved_at=UTC_TIMESTAMP(6),version=version+1,updated_at=UTC_TIMESTAMP(6) WHERE id=?",actor.userId(),id);
        audit(project,actor,id,"MILESTONE_PLAN_APPROVED");
        notifyManagers(project,id,actor,"Khách hàng đã xác nhận mốc bàn giao",milestone.get("title").toString());
    }
    @Transactional
    public long submit(WorkActor actor,long project,long id,Delivery input) {
        var engagement=active(actor,project);manager(actor,project,engagement);
        var milestone=milestone(project,id);
        String requestId=UUID.fromString(input.requestId()).toString();
        byte[] hash=hash(input);
        var prior=rows("SELECT id,submitted_by,request_hash FROM milestone_submissions WHERE milestone_id=? AND request_id=?",id,requestId);
        if(!prior.isEmpty()) {
            if(!actor.userId().equals(prior.getFirst().get("submitted_by"))||!MessageDigest.isEqual(hash,(byte[])prior.getFirst().get("request_hash"))) throw conflict("Mã gửi kết quả đã được dùng cho nội dung khác.");
            return ((Number)prior.getFirst().get("id")).longValue();
        }
        version(milestone,input.version());
        if(!Set.of("ACTIVE","CHANGES_REQUESTED").contains(milestone.get("status")))throw conflict("Mốc cần được xác nhận kế hoạch hoặc yêu cầu chỉnh sửa trước khi gửi kết quả.");
        if(count("SELECT COUNT(*) FROM milestone_tasks l JOIN tasks t ON t.project_id=l.project_id AND t.id=l.task_id WHERE l.milestone_id=? AND t.status NOT IN ('DONE','CANCELLED')",id)>0)throw conflict("Các nhiệm vụ liên kết cần hoàn thành hoặc được hủy trước khi gửi mốc.");
        String resultUrl=ProfessionalProfileService.safeUrl(input.resultUrl());
        if(resultUrl==null||input.note().isBlank())throw invalid("Nhập mô tả kết quả và liên kết bàn giao.");
        String name=name(actor);
        long number=count("SELECT COUNT(*) FROM milestone_submissions WHERE milestone_id=?",id)+1;
        var key=new GeneratedKeyHolder();
        db.update(connection->{
            var statement=connection.prepareStatement("INSERT INTO milestone_submissions(milestone_id,submission_no,submitted_by,submitted_name,note,result_url,criteria,request_id,request_hash) VALUES(?,?,?,?,?,?,?,?,?)",Statement.RETURN_GENERATED_KEYS);
            Object[] values={id,number,actor.userId(),name,input.note().strip(),resultUrl,milestone.get("criteria"),requestId,hash};
            for(int index=0;index<values.length;index++)statement.setObject(index+1,values[index]);
            return statement;
        },key);
        long submission=Objects.requireNonNull(key.getKey()).longValue();
        db.update("UPDATE project_milestones SET status='IN_REVIEW',latest_submission_id=?,version=version+1,updated_at=UTC_TIMESTAMP(6) WHERE id=?",submission,id);
        audit(project,actor,id,"MILESTONE_SUBMITTED");
        notifications.sendTo(project,null,actor.userId(),engagement.get("customer_user_id").toString(),"work.milestone-submitted","Có mốc bàn giao cần nghiệm thu",milestone.get("title").toString(),false,List.of(),false,"/projects/"+project+"?tab=milestones&milestone="+id);
        return submission;
    }
    @Transactional
    public void review(WorkActor actor,long project,long id,long submissionId,Review input) {
        var engagement=active(actor,project);customer(actor,engagement);
        var milestone=milestone(project,id);
        var submission=one("SELECT * FROM milestone_submissions WHERE id=? AND milestone_id=? FOR UPDATE",submissionId,id);
        String decision=input.accepted()?"ACCEPTED":"CHANGES_REQUESTED";
        String feedback=Objects.toString(input.feedback(),"").strip();
        var criteria=json.readValue(submission.get("criteria").toString(),List.class);
        if(input.checkedCriteria().stream().anyMatch(index->index<0||index>=criteria.size()))throw invalid("Tiêu chí được đánh dấu không hợp lệ.");
        if(input.accepted()&&input.checkedCriteria().size()!=criteria.size())throw invalid("Xác nhận đầy đủ các tiêu chí trước khi chấp nhận.");
        if(!input.accepted()&&feedback.isBlank())throw invalid("Nêu rõ nội dung cần chỉnh sửa.");
        if(!"PENDING".equals(submission.get("decision"))) {
            var previousChecks=submission.get("checked_criteria")==null?Set.<Integer>of():new HashSet<>(Arrays.asList(json.readValue(submission.get("checked_criteria").toString(),Integer[].class)));
            if(decision.equals(submission.get("decision"))&&actor.userId().equals(submission.get("reviewed_by"))
                &&feedback.equals(Objects.toString(submission.get("feedback"),""))
                &&previousChecks.equals(input.checkedCriteria()))return;
            throw conflict("Lần bàn giao đã được khách hàng phản hồi.");
        }
        version(milestone,input.version());
        if(!"IN_REVIEW".equals(milestone.get("status"))||((Number)milestone.get("latest_submission_id")).longValue()!=submissionId)throw conflict("Đây không phải lần bàn giao đang chờ nghiệm thu.");
        if(input.accepted()&&count("SELECT COUNT(*) FROM milestone_tasks l JOIN tasks t ON t.project_id=l.project_id AND t.id=l.task_id WHERE l.milestone_id=? AND t.status NOT IN ('DONE','CANCELLED')",id)>0)throw conflict("Nhiệm vụ liên kết đã thay đổi sau khi gửi bàn giao. Đội cần hoàn tất công việc trước khi nghiệm thu.");
        db.update("UPDATE milestone_submissions SET decision=?,feedback=?,checked_criteria=?,reviewed_by=?,reviewer_name=?,reviewed_at=UTC_TIMESTAMP(6) WHERE id=?",
            decision,feedback,json.writeValueAsString(new TreeSet<>(input.checkedCriteria())),actor.userId(),name(actor),submissionId);
        db.update("UPDATE project_milestones SET status=?,accepted_at=CASE WHEN ?='ACCEPTED' THEN UTC_TIMESTAMP(6) ELSE NULL END,version=version+1,updated_at=UTC_TIMESTAMP(6) WHERE id=?",decision,decision,id);
        audit(project,actor,id,"MILESTONE_"+decision);
        notifyManagers(project,id,actor,input.accepted()?"Khách hàng đã chấp nhận mốc bàn giao":"Khách hàng yêu cầu chỉnh sửa mốc bàn giao",milestone.get("title").toString());
    }
    @Transactional
    public void cancel(WorkActor actor,long project,long id,long expectedVersion,String reason) {
        var engagement=active(actor,project);
        var milestone=milestone(project,id);version(milestone,expectedVersion);
        if("DRAFT".equals(milestone.get("status")))manager(actor,project,engagement);
        else customer(actor,engagement);
        if(!Set.of("DRAFT","ACTIVE","CHANGES_REQUESTED").contains(milestone.get("status")))throw conflict("Chỉ hủy mốc chưa bàn giao hoặc đã có yêu cầu chỉnh sửa.");
        if(reason.isBlank())throw invalid("Nhập lý do hủy mốc.");
        db.update("UPDATE project_milestones SET status='CANCELLED',cancelled_reason=?,version=version+1,updated_at=UTC_TIMESTAMP(6) WHERE id=?",reason.strip(),id);
        audit(project,actor,id,"MILESTONE_CANCELLED");
        if(actor.userId().equals(engagement.get("customer_user_id")))notifyManagers(project,id,actor,"Khách hàng đã hủy mốc bàn giao",milestone.get("title").toString());
        else notifications.sendTo(project,null,actor.userId(),engagement.get("customer_user_id").toString(),"work.milestone-cancelled","Đội đã hủy kế hoạch mốc bàn giao",milestone.get("title").toString(),false,List.of(),false,"/projects/"+project+"?tab=milestones&milestone="+id);
    }
    private Map<String,Object> active(WorkActor actor,long project) {
        permissions.requireWritable(project,actor);
        var engagement=one("SELECT * FROM team_engagements WHERE project_id=? FOR UPDATE",project);
        if(!"ACTIVE".equals(engagement.get("status")))throw conflict("Dự án cần đang hợp tác để thay đổi mốc bàn giao.");
        return engagement;
    }
    private void manager(WorkActor actor,long project,Map<String,Object> engagement) {
        if(actor.userId().equals(engagement.get("customer_user_id")))throw forbidden();
        permissions.requireManager(project,actor);
    }
    private void customer(WorkActor actor,Map<String,Object> engagement) {
        if(!actor.userId().equals(engagement.get("customer_user_id")))throw forbidden();
    }
    private Map<String,Object> milestone(long project,long id) {
        return one("SELECT * FROM project_milestones WHERE project_id=? AND id=? FOR UPDATE",project,id);
    }
    private void decodeMilestone(Map<String,Object> milestone) {
        milestone.remove("creation_hash");milestone.remove("creation_request_id");
        milestone.put("criteria",json.readValue(milestone.get("criteria").toString(),List.class));
    }
    private void notifyManagers(long project,long id,WorkActor actor,String title,String body) {
        for(String manager:notifications.managers(project))if(!manager.equals(actor.userId()))
            notifications.sendTo(project,null,actor.userId(),manager,"work.milestone-reviewed",title,body,false,List.of(),false,"/projects/"+project+"?tab=milestones&milestone="+id);
    }
    private void audit(long project,WorkActor actor,long milestone,String action) {
        db.update("INSERT INTO activity_logs(project_id,actor_user_id,action,entity_type,entity_id) VALUES(?,?,?,'MILESTONE',?)",project,actor.userId(),action,String.valueOf(milestone));
    }
    private String name(WorkActor actor) {
        String name=directory.names(Set.of(actor.userId())).get(actor.userId());
        if(name==null)throw conflict("Không thể đọc tên tài khoản.");
        return name;
    }
    private byte[] hash(Object input) {
        try { return MessageDigest.getInstance("SHA-256").digest(json.writeValueAsString(input).getBytes(StandardCharsets.UTF_8)); }
        catch(NoSuchAlgorithmException exception){throw new IllegalStateException(exception);}
    }
    private void version(Map<String,Object> row,Long version) {
        if(version==null||((Number)row.get("version")).longValue()!=version)throw conflict("Mốc đã thay đổi. Tải lại dữ liệu trước khi thao tác.");
    }
    private void page(int page){if(page<0||page>10000)throw invalid("Trang không hợp lệ.");}
    private long count(String sql,Object...args){return db.queryForObject(sql,Long.class,args);}
    private List<Map<String,Object>> rows(String sql,Object...args){return ApiValues.utc(db.queryForList(sql,args));}
    private Map<String,Object> one(String sql,Object...args){var result=rows(sql,args);if(result.isEmpty())throw new WorkException(HttpStatus.NOT_FOUND,"MILESTONE_NOT_FOUND","Không tìm thấy mốc bàn giao.");return result.getFirst();}
    private WorkException invalid(String message){return new WorkException(HttpStatus.BAD_REQUEST,"INVALID_MILESTONE",message);}
    private WorkException conflict(String message){return new WorkException(HttpStatus.CONFLICT,"MILESTONE_CHANGED",message);}
    private WorkException forbidden(){return new WorkException(HttpStatus.FORBIDDEN,"MILESTONE_FORBIDDEN","Bạn không có quyền thực hiện thao tác này.");}
}

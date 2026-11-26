package vn.tasknest.workservice.application.community;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.Statement;
import java.time.LocalDate;
import java.time.ZoneOffset;
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
public class RecruitmentService {
    private final DiscoveryNotifications discovery;
    private final JdbcTemplate db;
    private final ProjectPermissionService permissions;
    private final IdentityDirectoryClient directory;
    private final JsonMapper json=new JsonMapper();
    public RecruitmentService(JdbcTemplate db,ProjectPermissionService permissions,IdentityDirectoryClient directory,DiscoveryNotifications discovery) {
        this.discovery=discovery; this.db=db;this.permissions=permissions;this.directory=directory;
    }
    public record Opening(String title,String description,String skills,String workMode,int weeklyHours,int slots,LocalDate closesOn,String requestId,
        @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL) String referenceUrl,
        @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL) List<String> images) {}
    public record Application(String introduction,String skills,int weeklyHours) {}
    private static final String SUMMARY="""
        SELECT o.id,o.team_id,o.title,o.description,o.skills,o.work_mode,o.weekly_hours,o.slots,o.closes_on,o.status,o.version,o.created_at,t.name AS team_name,o.reference_url,
          (SELECT COUNT(*) FROM opening_post_images i WHERE i.post_id=o.id) image_count,
          (SELECT COUNT(*) FROM team_applications a WHERE a.opening_id=o.id AND a.status='ACCEPTED') AS filled_slots
        FROM team_openings o JOIN dev_teams t ON t.id=o.team_id
        """;

    public Map<String,Object> board(WorkActor actor,Long team,String search,int page) {return board(actor,team,search,page,null);}
    public record MatchCriteria(String skills,String roles,int hours,String sort,String mode,int maxHours,int minScore) {
        public static MatchCriteria defaults(){return new MatchCriteria("","",0,"NEWEST","ALL",0,0);}
    }
    public Map<String,Object> board(WorkActor actor,Long team,String search,int page,Long openingId) {return board(actor,team,search,page,openingId,MatchCriteria.defaults());}
    public Map<String,Object> board(WorkActor actor,Long team,String search,int page,Long openingId,MatchCriteria criteria) {
        page(page);
        if(criteria.skills().length()>1200||criteria.roles().length()>500||criteria.hours()<0||criteria.hours()>168||criteria.maxHours()<0||criteria.maxHours()>168||criteria.minScore()<0||criteria.minScore()>100||!Set.of("NEWEST","MATCH").contains(criteria.sort())||!Set.of("ALL","REMOTE","HYBRID","ONSITE").contains(criteria.mode()))throw invalid("Tiêu chí tìm kiếm không hợp lệ.");
        boolean owner=false;
        if(team!=null) {
            var row=one("SELECT owner_user_id FROM dev_teams WHERE id=?",team);
            owner=actor!=null&&actor.userId().equals(row.get("owner_user_id"));
        }
        String condition=" WHERE (? IS NULL OR o.team_id=?) AND LOCATE(LOWER(?),LOWER(CONCAT(o.title,' ',o.skills,' ',t.name)))>0";
        // Owners see paused/expired posts on their own profile; the public board lists vacancies only.
        if(!owner) condition+=" AND o.status='OPEN' AND o.closes_on>=UTC_DATE() AND (SELECT COUNT(*) FROM team_applications a WHERE a.opening_id=o.id AND a.status='ACCEPTED')<o.slots";
        var parameters=new ArrayList<Object>(Arrays.asList(team,team,search));
        if(openingId!=null){if(openingId<1)throw invalid("Tin tuyển dụng không hợp lệ.");condition+=" AND o.id=?";parameters.add(openingId);}
        if(!criteria.mode().equals("ALL")){condition+=" AND o.work_mode=?";parameters.add(criteria.mode());}
        if(criteria.maxHours()>0){condition+=" AND o.weekly_hours<=?";parameters.add(criteria.maxHours());}
        // Score the full eligible result set in MySQL, then filter, order and paginate.
        String canonical=canonicalSkill("s.skill");
        String split="CONCAT('[',REPLACE(JSON_QUOTE(REGEXP_REPLACE(o.skills,'[,，;/|]+',',')),',','\",\"'),']')";
        String cte="WITH preferences AS (SELECT ? user_skills,? available_hours,? desired_roles), available AS ("+SUMMARY+condition+"), required_skills AS (SELECT o.id,"+canonical+" skill FROM available o JOIN JSON_TABLE("+split+", '$[*]' COLUMNS(skill VARCHAR(300) PATH '$')) s), counts AS (SELECT id,COUNT(DISTINCT skill) required_count,COUNT(DISTINCT CASE WHEN skill IN (SELECT "+canonical+" FROM preferences u JOIN JSON_TABLE(u.user_skills,'$[*]' COLUMNS(skill VARCHAR(300) PATH '$')) s) THEN skill END) matched_count FROM required_skills WHERE skill<>'' GROUP BY id), scored AS (SELECT o.*,EXISTS (SELECT 1 FROM JSON_TABLE(u.desired_roles,'$[*]' COLUMNS(role_term VARCHAR(150) PATH '$')) role_hint WHERE LOCATE(LOWER(role_hint.role_term),LOWER(o.title))>0) role_match,CASE WHEN COALESCE(c.required_count,0)=0 OR JSON_LENGTH(u.user_skills)=0 THEN NULL WHEN u.available_hours=0 THEN ROUND(100.0*c.matched_count/c.required_count) ELSE ROUND(85.0*c.matched_count/c.required_count+IF(o.weekly_hours<=u.available_hours,15,ROUND(15.0*u.available_hours/o.weekly_hours))) END match_score FROM available o LEFT JOIN counts c ON c.id=o.id CROSS JOIN preferences u) ";
        var all=new ArrayList<Object>();all.add(json.writeValueAsString(Arrays.stream(criteria.skills().split("[,，;/|]+" )).map(String::strip).filter(value->!value.isBlank()).toList()));all.add(criteria.hours());all.add(json.writeValueAsString(Arrays.stream(criteria.roles().split(",")).map(String::strip).filter(value->!value.isEmpty()).toList()));all.addAll(parameters);all.add(criteria.minScore());
        long total=count(cte+"SELECT COUNT(*) FROM scored WHERE COALESCE(match_score,0)>=?",all.toArray());
        all.add(page*12);
        var items=rows(cte+"SELECT * FROM scored WHERE COALESCE(match_score,0)>=? ORDER BY "+(criteria.sort().equals("MATCH")?"role_match DESC,match_score DESC,":"")+"id DESC LIMIT 12 OFFSET ?",all.toArray());
        for(var item:items) {
            long opening=((Number)item.get("id")).longValue();
            if(owner) item.put("canEdit", !"CLOSED".equals(item.get("status")) &&
                count("SELECT COUNT(*) FROM team_applications WHERE opening_id=?", opening)==0);
            item.put("isMember",actor!=null&&member(((Number)item.get("team_id")).longValue(),actor.userId()));
            if(actor!=null) {
                var application=rows("SELECT id,status,version FROM team_applications WHERE opening_id=? AND user_id=?",opening,actor.userId());
                item.put("myApplication",application.isEmpty()?null:application.getFirst());
            }
        }
        return Map.of("items",items,"total",total,"page",page);
    }

    static String canonicalSkill(String expression){
        return "CASE REGEXP_REPLACE(LOWER(TRIM("+expression+")),'[[:space:]]+',' ') WHEN 'reactjs' THEN 'react' WHEN 'react.js' THEN 'react' WHEN 'ts' THEN 'typescript' WHEN 'js' THEN 'javascript' WHEN 'nodejs' THEN 'node' WHEN 'node.js' THEN 'node' WHEN 'springboot' THEN 'spring boot' WHEN 'spring' THEN 'spring boot' WHEN 'postgres' THEN 'postgresql' WHEN 'mysql8' THEN 'mysql' WHEN 'tailwindcss' THEN 'tailwind' WHEN 'tailwind css' THEN 'tailwind' ELSE REGEXP_REPLACE(LOWER(TRIM("+expression+")),'[[:space:]]+',' ') END";
    }

    @Transactional
    public long create(WorkActor actor,long team,Opening input) {
        owner(actor,team);
        byte[] hash=hash(input);
        var previous=rows("SELECT id,request_hash FROM team_openings WHERE team_id=? AND request_id=?",team,input.requestId());
        if(!previous.isEmpty()) {
            if(!MessageDigest.isEqual(hash,(byte[])previous.getFirst().get("request_hash")))throw conflict("Mã đăng tin đã dùng cho nội dung khác.");
            return ((Number)previous.getFirst().get("id")).longValue();
        }
        validateOpening(input);
        var key=new GeneratedKeyHolder();
        db.update(connection->{
            var statement=connection.prepareStatement("INSERT INTO team_openings(team_id,title,description,skills,work_mode,weekly_hours,slots,closes_on,request_id,request_hash,reference_url) VALUES(?,?,?,?,?,?,?,?,?,?,?)",Statement.RETURN_GENERATED_KEYS);
            Object[] values={team,input.title().strip(),input.description().strip(),input.skills().strip(),input.workMode(),input.weeklyHours(),input.slots(),input.closesOn(),input.requestId(),hash,ProfessionalProfileService.safeUrl(input.referenceUrl())};
            for(int i=0;i<values.length;i++)statement.setObject(i+1,values[i]);
            return statement;
        },key);
        long created=Objects.requireNonNull(key.getKey()).longValue();
        DiscoveryPostImage.write(db,DiscoveryPostImage.Kind.OPENING,created,input.images(),null);
        return created;
    }

    private void validateOpening(Opening input) {
        if(!Set.of("REMOTE","HYBRID","ONSITE").contains(input.workMode()))throw invalid("Hình thức làm việc không hợp lệ.");
        if(input.closesOn().isBefore(today())||input.closesOn().isAfter(today().plusYears(1)))throw invalid("Ngày đóng tin cần nằm trong một năm tới.");
        if(input.title().strip().length()<3||input.description().strip().length()<20||input.skills().isBlank())throw invalid("Điền vị trí, mô tả công việc và kỹ năng cần tuyển.");
    }

    @Transactional
    public void update(WorkActor actor, long team, long id, Opening input, long expectedVersion) {
        owner(actor, team);
        var current = opening(team, id);
        version(current, expectedVersion);
        if ("CLOSED".equals(current.get("status"))) throw conflict("Tin tuyển dụng đã đóng.");
        if (count("SELECT COUNT(*) FROM team_applications WHERE opening_id=?", id)>0)
            throw conflict("Tin đã nhận hồ sơ. Hãy đăng tin mới nếu điều kiện tuyển dụng thay đổi.");
        validateOpening(input);
        db.update("""
            UPDATE team_openings SET title=?,description=?,skills=?,work_mode=?,weekly_hours=?,slots=?,
                closes_on=?,reference_url=?,version=version+1,updated_at=UTC_TIMESTAMP(6)
            WHERE id=?
            """, input.title().strip(), input.description().strip(), input.skills().strip(),
            input.workMode(), input.weeklyHours(), input.slots(), input.closesOn(),
            ProfessionalProfileService.safeUrl(input.referenceUrl()), id);
        DiscoveryPostImage.write(db, DiscoveryPostImage.Kind.OPENING, id, input.images(), null);
    }

    @Transactional
    public void status(WorkActor actor,long team,long id,String status,long version) {
        owner(actor,team);
        var opening=opening(team,id);
        if(!Set.of("OPEN","PAUSED","CLOSED").contains(status))throw invalid("Trạng thái tuyển dụng không hợp lệ.");
        if(status.equals(opening.get("status")))return;
        version(opening,version);
        if("CLOSED".equals(opening.get("status")))throw conflict("Tin đã đóng. Đăng tin mới khi đội cần tuyển thêm.");
        if("OPEN".equals(status)&&((LocalDate)opening.get("closes_on")).isBefore(today()))throw conflict("Tin đã hết hạn. Đăng tin mới với kế hoạch mới.");
        db.update("UPDATE team_openings SET status=?,version=version+1,updated_at=UTC_TIMESTAMP(6) WHERE id=?",status,id);
        for(var application:rows("SELECT id,user_id FROM team_applications WHERE opening_id=? AND status='PENDING'",id))
            discovery.team(actor.userId(),team,application.get("user_id").toString(),"discovery.opening.status",id+":"+(version+1),"Tin tuyển dụng đã cập nhật trạng thái","Vị trí bạn đã ứng tuyển đã thay đổi trạng thái nhận hồ sơ. Mở đơn ứng tuyển để xem.","/teams?view=applications&application="+application.get("id"));
    }

    @Transactional
    public long apply(WorkActor actor,long team,long id,Application input) {
        permissions.requireVerified(actor);
        lockTeam(team);
        var opening=opening(team,id);
        var previous=rows("SELECT * FROM team_applications WHERE opening_id=? AND user_id=?",id,actor.userId());
        if(!previous.isEmpty()) {
            var row=previous.getFirst();
            if("PENDING".equals(row.get("status"))&&input.introduction().strip().equals(row.get("introduction"))
                &&input.skills().strip().equals(row.get("skills"))&&input.weeklyHours()==((Number)row.get("weekly_hours")).intValue())return ((Number)row.get("id")).longValue();
            throw conflict("Bạn đã gửi đơn cho tin này. Theo dõi kết quả trong Đơn ứng tuyển của tôi.");
        }
        available(opening);
        if(member(team,actor.userId()))throw conflict("Bạn đã là thành viên đội này.");
        notCustomer(team,actor.userId());
        if(input.introduction().strip().length()<20||input.skills().isBlank())throw invalid("Giới thiệu kinh nghiệm và kỹ năng phù hợp với vị trí.");
        var names=directory.names(Set.of(actor.userId()));
        String name=names.get(actor.userId());
        if(name==null)throw conflict("Không thể đọc tên tài khoản. Vui lòng thử lại.");
        var key=new GeneratedKeyHolder();
        db.update(connection->{
            var statement=connection.prepareStatement("INSERT INTO team_applications(opening_id,user_id,display_name,introduction,skills,weekly_hours) VALUES(?,?,?,?,?,?)",Statement.RETURN_GENERATED_KEYS);
            Object[] values={id,actor.userId(),name,input.introduction().strip(),input.skills().strip(),input.weeklyHours()};
            for(int i=0;i<values.length;i++)statement.setObject(i+1,values[i]);
            return statement;
        },key);
        long application=Objects.requireNonNull(key.getKey()).longValue();
        String owner=one("SELECT owner_user_id FROM dev_teams WHERE id=?",team).get("owner_user_id").toString();
        discovery.team(actor.userId(),team,owner,"discovery.application.created",String.valueOf(application),"Có đơn ứng tuyển mới","Một thành viên đã gửi hồ sơ cho vị trí đang tuyển. Mở đơn để xem và phản hồi.","/team-management/"+team+"?opening="+id+"&application="+application);
        return application;
    }

    public Map<String,Object> applications(WorkActor actor,long team,long id,int page) {return applications(actor,team,id,page,null);}
    public Map<String,Object> applications(WorkActor actor,long team,long id,int page,Long applicationId) {
        permissions.requireVerified(actor);page(page);
        var owner=one("SELECT owner_user_id FROM dev_teams WHERE id=?",team);
        if(!actor.userId().equals(owner.get("owner_user_id")))throw forbidden();
        one("SELECT id FROM team_openings WHERE team_id=? AND id=?",team,id);
        return Map.of("items",rows("SELECT * FROM team_applications WHERE opening_id=? AND (? IS NULL OR id=?) ORDER BY id DESC LIMIT 12 OFFSET ?",id,applicationId,applicationId,page*12),
            "total",count("SELECT COUNT(*) FROM team_applications WHERE opening_id=? AND (? IS NULL OR id=?)",id,applicationId,applicationId));
    }

    public Map<String,Object> mine(WorkActor actor,int page) {return mine(actor,page,null);}
    public Map<String,Object> mine(WorkActor actor,int page,Long applicationId) {
        permissions.requireVerified(actor);page(page);
        return Map.of("items",rows("""
            SELECT a.*,o.team_id,o.title,o.work_mode,o.status AS opening_status,o.closes_on,t.name AS team_name
            FROM team_applications a JOIN team_openings o ON o.id=a.opening_id JOIN dev_teams t ON t.id=o.team_id
            WHERE a.user_id=? AND (? IS NULL OR a.id=?) ORDER BY a.id DESC LIMIT 12 OFFSET ?
            """,actor.userId(),applicationId,applicationId,page*12),"total",count("SELECT COUNT(*) FROM team_applications WHERE user_id=? AND (? IS NULL OR id=?)",actor.userId(),applicationId,applicationId));
    }

    @Transactional
    public void withdraw(WorkActor actor,long team,long id,long application,long version) {
        permissions.requireVerified(actor);lockTeam(team);opening(team,id);
        var row=one("SELECT * FROM team_applications WHERE opening_id=? AND id=? AND user_id=? FOR UPDATE",id,application,actor.userId());
        if("WITHDRAWN".equals(row.get("status")))return;
        version(row,version);
        if(!"PENDING".equals(row.get("status")))throw conflict("Chỉ rút đơn đang chờ duyệt.");
        db.update("UPDATE team_applications SET status='WITHDRAWN',version=version+1,reviewed_at=UTC_TIMESTAMP(6) WHERE id=?",application);
        discovery.team(actor.userId(),team,one("SELECT owner_user_id FROM dev_teams WHERE id=?",team).get("owner_user_id").toString(),"discovery.application.withdrawn",String.valueOf(application),"Ứng viên đã rút đơn","Một ứng viên đã rút hồ sơ. Mở danh sách ứng tuyển để xem trạng thái mới.","/team-management/"+team+"?opening="+id+"&application="+application);
    }

    @Transactional
    public void review(WorkActor actor,long team,long id,long application,boolean accepted,String feedback,long version) {
        owner(actor,team);
        var opening=opening(team,id);
        var row=one("SELECT * FROM team_applications WHERE opening_id=? AND id=? FOR UPDATE",id,application);
        String desired=accepted?"ACCEPTED":"REJECTED";
        String note=Objects.toString(feedback,"").strip();
        if(desired.equals(row.get("status"))&&note.equals(Objects.toString(row.get("feedback"),"")))return;
        version(row,version);
        if(!"PENDING".equals(row.get("status")))throw conflict("Đơn ứng tuyển đã được xử lý.");
        if(!accepted&&note.isBlank())throw invalid("Ghi phản hồi để ứng viên biết lý do chưa phù hợp.");
        if(accepted) {
            available(opening);
            String user=row.get("user_id").toString();
            if(member(team,user))throw conflict("Ứng viên đã tham gia đội qua lời mời hoặc vị trí khác.");
            notCustomer(team,user);
            db.update("INSERT INTO dev_team_members(team_id,user_id,display_name,specialty) VALUES(?,?,?,?)",team,user,row.get("display_name"),opening.get("title"));
            db.update("UPDATE dev_team_invitations SET status='ACCEPTED' WHERE team_id=? AND user_id=? AND status='PENDING'",team,user);
        }
        db.update("UPDATE team_applications SET status=?,feedback=?,version=version+1,reviewed_at=UTC_TIMESTAMP(6) WHERE id=?",desired,note,application);
        discovery.team(actor.userId(),team,row.get("user_id").toString(),accepted?"discovery.application.accepted":"discovery.application.rejected",application+":"+(version+1),accepted?"Bạn đã được nhận vào đội":"Đơn ứng tuyển đã có phản hồi","Chủ đội đã phản hồi hồ sơ của bạn. Mở đơn ứng tuyển để xem kết quả và nội dung phản hồi.","/teams?view=applications&application="+application);
    }

    private void available(Map<String,Object> opening) {
        if(!"OPEN".equals(opening.get("status"))||((LocalDate)opening.get("closes_on")).isBefore(today()))throw conflict("Tin đang tạm dừng, đã đóng hoặc đã hết hạn nhận hồ sơ.");
        long id=((Number)opening.get("id")).longValue();
        if(count("SELECT COUNT(*) FROM team_applications WHERE opening_id=? AND status='ACCEPTED'",id)>=((Number)opening.get("slots")).longValue())throw conflict("Vị trí này đã tuyển đủ số lượng.");
    }
    private void notCustomer(long team,String user) {
        if(count("SELECT COUNT(*) FROM team_engagements WHERE team_id=? AND customer_user_id=? AND status IN ('PROPOSED','ACTIVE')",team,user)>0)throw conflict("Bạn đang có hợp tác chưa kết thúc với tư cách khách hàng của đội. Hoàn tất hợp tác trước khi gia nhập đội thực hiện.");
    }
    private boolean member(long team,String user){return count("SELECT COUNT(*) FROM dev_team_members WHERE team_id=? AND user_id=?",team,user)>0;}
    private Map<String,Object> opening(long team,long id){return one("SELECT * FROM team_openings WHERE team_id=? AND id=? FOR UPDATE",team,id);}
    private Map<String,Object> lockTeam(long team){return one("SELECT * FROM dev_teams WHERE id=? FOR UPDATE",team);}
    private void owner(WorkActor actor,long team){permissions.requireVerified(actor);if(!actor.userId().equals(lockTeam(team).get("owner_user_id")))throw forbidden();}
    private void version(Map<String,Object> row,long version){if(((Number)row.get("version")).longValue()!=version)throw conflict("Dữ liệu đã thay đổi. Tải lại trước khi thao tác.");}
    private LocalDate today(){return LocalDate.now(ZoneOffset.UTC);}
    private void page(int page){if(page<0||page>10000)throw invalid("Trang không hợp lệ.");}
    private byte[] hash(Object input){try{return MessageDigest.getInstance("SHA-256").digest(json.writeValueAsString(input).getBytes(StandardCharsets.UTF_8));}catch(NoSuchAlgorithmException e){throw new IllegalStateException(e);}}
    private long count(String sql,Object...args){return db.queryForObject(sql,Long.class,args);}
    private List<Map<String,Object>> rows(String sql,Object...args){return ApiValues.utc(db.queryForList(sql,args));}
    private Map<String,Object> one(String sql,Object...args){var rows=rows(sql,args);if(rows.isEmpty())throw new WorkException(HttpStatus.NOT_FOUND,"RECRUITMENT_NOT_FOUND","Không tìm thấy tin tuyển dụng hoặc đơn ứng tuyển.");return rows.getFirst();}
    private WorkException invalid(String message){return new WorkException(HttpStatus.BAD_REQUEST,"INVALID_RECRUITMENT",message);}
    private WorkException conflict(String message){return new WorkException(HttpStatus.CONFLICT,"RECRUITMENT_CHANGED",message);}
    private WorkException forbidden(){return new WorkException(HttpStatus.FORBIDDEN,"RECRUITMENT_FORBIDDEN","Chỉ chủ đội được quản lý tuyển dụng và xem đơn ứng tuyển.");}
}

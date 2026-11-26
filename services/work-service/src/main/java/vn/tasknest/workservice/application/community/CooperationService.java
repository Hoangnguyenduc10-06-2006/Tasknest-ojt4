package vn.tasknest.workservice.application.community;

import java.util.*;
import java.time.LocalDate;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;
import vn.tasknest.workservice.api.ApiValues;
import vn.tasknest.workservice.application.WorkException;
import vn.tasknest.workservice.application.security.*;

@Service
public class CooperationService {
    private final JdbcTemplate db;private final ProjectPermissionService permissions;private final TeamWorkspaceService teams;private final MilestoneService milestones;private final DiscoveryNotifications notifications;
    private final JsonMapper json=new JsonMapper();
    public CooperationService(JdbcTemplate db,ProjectPermissionService permissions,TeamWorkspaceService teams,MilestoneService milestones,DiscoveryNotifications notifications){this.db=db;this.permissions=permissions;this.teams=teams;this.milestones=milestones;this.notifications=notifications;}
    @Transactional(readOnly=true)
    public Map<String,Object> list(WorkActor actor,String view,String status,int page){
        permissions.requireVerified(actor);if(page<0||page>10000||!Set.of("requests","proposals","projects").contains(view)||status.length()>20)throw invalid("Bộ lọc không hợp lệ.");
        var statuses=view.equals("requests")?Set.of("DRAFT","OPEN","PAUSED","CLOSED","AWARDED"):view.equals("proposals")?Set.of("SUBMITTED","WITHDRAWN","ACCEPTED","DECLINED"):Set.of("PROPOSED","ACTIVE","COMPLETED");
        if(!status.equals("ALL")&&!statuses.contains(status))throw invalid("Trạng thái không phù hợp với loại hợp tác.");
        String select,from,condition;var args=new ArrayList<Object>();
        if(view.equals("requests")){select="r.id,r.title,r.status,r.project_id,r.id request_id,NULL proposal_id,NULL team_name,r.updated_at";from="customer_project_requests r";condition="r.customer_user_id=?";}
        else if(view.equals("proposals")){select="p.id,r.title,p.status,CASE WHEN p.status='ACCEPTED' THEN r.project_id END project_id,r.id request_id,p.id proposal_id,t.name team_name,p.updated_at,(p.status='SUBMITTED' AND p.request_version<>r.version AND r.status='OPEN') update_required,r.status request_status";from="team_project_proposals p JOIN customer_project_requests r ON r.id=p.request_id JOIN dev_teams t ON t.id=p.team_id";condition="t.owner_user_id=?";}
        else {select="p.id,p.name title,e.status,p.id project_id,a.request_id,a.proposal_id,t.name team_name,p.updated_at,(a.kickoff_at IS NULL AND a.project_id IS NOT NULL) kickoff_pending";from="projects p JOIN team_engagements e ON e.project_id=p.id JOIN dev_teams t ON t.id=e.team_id LEFT JOIN project_agreements a ON a.project_id=p.id";condition="(e.customer_user_id=? OR EXISTS(SELECT 1 FROM project_memberships m WHERE m.project_id=p.id AND m.user_id=? AND m.status='ACTIVE'))";args.add(actor.userId());}
        args.add(actor.userId());
        if(!status.equals("ALL")){condition+=" AND "+(view.equals("requests")?"r":view.equals("proposals")?"p":"e")+".status=?";args.add(status);}
        long total=db.queryForObject("SELECT COUNT(*) FROM "+from+" WHERE "+condition,Long.class,args.toArray());args.add(page*12);
        return Map.of("items",rows("SELECT "+select+" FROM "+from+" WHERE "+condition+" ORDER BY updated_at DESC,id DESC LIMIT 12 OFFSET ?",args.toArray()),"total",total,"page",page);
    }
    @Transactional(readOnly=true)
    public Map<String,Object> agreement(WorkActor actor,long project){
        var access=permissions.requireMember(project,actor);var found=rows("SELECT * FROM project_agreements WHERE project_id=?",project);if(found.isEmpty())return Map.of("configured",false);
        var row=found.getFirst();var snap=read(row.get("snapshot"));boolean owner=access.role()==vn.tasknest.workservice.domain.project.ProjectRole.OWNER;
        boolean commercial=owner||actor.userId().equals(snap.get("customerId"));
        var safe=new LinkedHashMap<>(snap);if(!commercial)safe.remove("amount");
        var result=new LinkedHashMap<String,Object>();result.put("configured",true);result.put("requestId",row.get("request_id"));result.put("proposalId",row.get("proposal_id"));result.put("snapshot",safe);result.put("kickoffAt",row.get("kickoff_at"));result.put("version",row.get("version"));result.put("canKickoff",owner&&access.project().getStatus().name().equals("ACTIVE")&&row.get("kickoff_at")==null);result.put("canViewPrivateDiscussion",commercial);result.put("developmentState",permissions.developmentState(project));result.put("canDraftMilestone",owner && access.project().getStatus().name().equals("ACTIVE") && "ACTIVE".equals(permissions.developmentState(project)) && row.get("milestone_id")==null);result.put("milestoneId",row.get("milestone_id"));
        result.put("roster",access.role()==vn.tasknest.workservice.domain.project.ProjectRole.CUSTOMER ? List.of() : rows("SELECT m.user_id,m.display_name FROM dev_team_members m JOIN project_memberships p ON p.user_id=m.user_id AND p.project_id=? AND p.status='ACTIVE' WHERE m.team_id=?",project,snap.get("teamId")));
        result.put("candidates",owner?rows("SELECT user_id,display_name FROM dev_team_members WHERE team_id=? ORDER BY display_name",snap.get("teamId")):List.of());return result;
    }
    @Transactional
    public void kickoff(WorkActor actor,long project,long version,Set<String> users){
        var access=permissions.requireOwner(project,actor);permissions.requireWritable(project,actor);var row=one("SELECT * FROM project_agreements WHERE project_id=? FOR UPDATE",project);
        var snapshot=read(row.get("snapshot"));long team=((Number)snapshot.get("teamId")).longValue();var roster=new LinkedHashSet<>(users);roster.add(access.project().getOwnerUserId());
        // Include staff already explicitly assigned through workspace membership management.
        for(String user:db.queryForList("SELECT m.user_id FROM project_memberships m JOIN dev_team_members t ON t.user_id=m.user_id AND t.team_id=? WHERE m.project_id=? AND m.status='ACTIVE'",String.class,team,project))roster.add(user);
        if(row.get("kickoff_at")!=null){
            var accepted=new HashSet<>(Arrays.asList(json.readValue(row.get("roster_snapshot").toString(),String[].class)));
            if(((Number)row.get("version")).longValue()==version+1 && accepted.equals(roster))return;
            throw conflict("Dự án đã được khởi động. Tải lại để xem nhân sự; bố trí thêm người từ Đội của tôi.");
        }
        if(((Number)row.get("version")).longValue()!=version)throw conflict("Kế hoạch đã thay đổi. Vui lòng tải lại.");
        teams.assign(actor,team,project,roster);
        db.update("UPDATE project_agreements SET kickoff_at=UTC_TIMESTAMP(6),kickoff_by=?,roster_snapshot=?,version=version+1 WHERE project_id=?",actor.userId(),json.writeValueAsString(roster),project);
        db.update("INSERT INTO activity_logs(project_id,actor_user_id,action,entity_type,entity_id) VALUES(?,?,'PROJECT_KICKOFF','PROJECT',?)",project,actor.userId(),String.valueOf(project));
        notifications.send(actor.userId(),snapshot.get("customerId").toString(),"discovery.engagement.accepted","TEAM",String.valueOf(team),"kickoff:"+project,"Đội đã khởi động dự án","Nhân sự thực hiện đã được xác nhận. Mở dự án để theo dõi kế hoạch và bàn giao.","/projects/"+project+"?tab=overview");
    }
    @Transactional
    public long draftMilestone(WorkActor actor,long project,LocalDate due,String requestId){
        permissions.requireManager(project,actor);var row=one("SELECT * FROM project_agreements WHERE project_id=? FOR UPDATE",project);
        if(row.get("milestone_id")!=null)return ((Number)row.get("milestone_id")).longValue();
        if(row.get("kickoff_at")==null)throw conflict("Xác nhận nhân sự trước khi lập mốc bàn giao.");
        var snapshot=read(row.get("snapshot"));String plan=snapshot.get("plan").toString();var criteria=planCriteria(plan);
        long id=milestones.save(actor,project,null,new MilestoneService.Plan(snapshot.get("title").toString().substring(0,Math.min(100,snapshot.get("title").toString().length())),criteria,due,Set.of(),requestId,null));
        db.update("UPDATE project_agreements SET milestone_id=?,version=version+1 WHERE project_id=?",id,project);return id;
    }
    @Transactional(readOnly=true)
    public List<Map<String,Object>> history(WorkActor actor,long request,Long proposal){
        permissions.requireVerified(actor);var source=one("SELECT customer_user_id FROM customer_project_requests WHERE id=?",request);boolean customer=actor.userId().equals(source.get("customer_user_id"));
        if(proposal!=null){var bid=one("SELECT t.owner_user_id FROM team_project_proposals p JOIN dev_teams t ON t.id=p.team_id WHERE p.id=? AND p.request_id=?",proposal,request);if(!customer&&!actor.userId().equals(bid.get("owner_user_id")))throw missing();}
        else if(!customer&&count("SELECT COUNT(*) FROM team_project_proposals p JOIN dev_teams t ON t.id=p.team_id WHERE p.request_id=? AND t.owner_user_id=?",request,actor.userId())==0)throw missing();
        var rows=rows("SELECT version,snapshot,created_at FROM marketplace_revisions WHERE resource_type=? AND resource_id=?"+(!customer&&proposal==null?" AND snapshot->>'$.status'<>'DRAFT'":"")+" ORDER BY version DESC LIMIT 100",proposal==null?"REQUEST":"PROPOSAL",proposal==null?request:proposal);
        rows.forEach(row->row.put("snapshot",read(row.get("snapshot"))));return rows;
    }
    static List<String> planCriteria(String plan){
        var criteria=new ArrayList<String>();String remaining=plan.strip();
        while(!remaining.isEmpty()){
            int end=Math.min(300,remaining.length());
            if(end<remaining.length()){
                int boundary=remaining.lastIndexOf(' ',end);
                if(boundary>=150 && remaining.length()-boundary <= (19-criteria.size())*299)end=boundary;
                if(Character.isHighSurrogate(remaining.charAt(end-1)))end--;
            }
            criteria.add(remaining.substring(0,end).strip());remaining=remaining.substring(end).strip();
        }
        if(criteria.isEmpty()||criteria.size()>20)throw new WorkException(HttpStatus.BAD_REQUEST,"INVALID_PLAN","Kế hoạch cần từ 1 đến 20 tiêu chí nháp. Chia lại phạm vi trước khi tạo mốc.");
        return criteria;
    }
    private Map<String,Object> read(Object value){return new LinkedHashMap<>(json.readValue(value.toString(),json.getTypeFactory().constructMapType(Map.class,String.class,Object.class)));}
    private long count(String sql,Object...args){return db.queryForObject(sql,Long.class,args);}
    private List<Map<String,Object>> rows(String sql,Object...args){return ApiValues.utc(db.queryForList(sql,args));}
    private Map<String,Object> one(String sql,Object...args){var rows=rows(sql,args);if(rows.isEmpty())throw missing();return rows.getFirst();}
    private WorkException missing(){return new WorkException(HttpStatus.NOT_FOUND,"COOPERATION_NOT_FOUND","Không tìm thấy thông tin hợp tác.");}
    private WorkException invalid(String message){return new WorkException(HttpStatus.BAD_REQUEST,"INVALID_COOPERATION",message);}
    private WorkException conflict(String message){return new WorkException(HttpStatus.CONFLICT,"COOPERATION_CHANGED",message);}
}

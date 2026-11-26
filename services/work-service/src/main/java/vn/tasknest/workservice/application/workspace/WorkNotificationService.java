package vn.tasknest.workservice.application.workspace;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import tools.jackson.databind.json.JsonMapper;

/** Durable per-recipient events; no cross-service database access. */
@Service
public class WorkNotificationService {
    private final JdbcTemplate db;private final Clock clock;private final JsonMapper json=new JsonMapper();
    public WorkNotificationService(JdbcTemplate db,Clock clock){this.db=db;this.clock=clock;}
    public Set<String> managers(long project){var row=db.queryForMap("SELECT owner_user_id,manager_user_id FROM projects WHERE id=?",project);var result=new LinkedHashSet<String>();result.add((String)row.get("owner_user_id"));if(row.get("manager_user_id")!=null)result.add((String)row.get("manager_user_id"));return result;}
    @Transactional(propagation=Propagation.MANDATORY)
    public String send(long project,Long task,String actor,String recipient,String type,String title,String body,boolean email,List<String> reasons,boolean allowNonMember){
        return sendTo(project,task,actor,recipient,type,title,body,email,reasons,allowNonMember,null);
    }
    @Transactional(propagation=Propagation.MANDATORY)
    public String sendTo(long project,Long task,String actor,String recipient,String type,String title,String body,boolean email,List<String> reasons,boolean allowNonMember,String destination){
        if(recipient==null)return null;
        if(task!=null && Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM team_engagements WHERE project_id=? AND customer_user_id=?)",Boolean.class,project,recipient)))return null;
        if(!allowNonMember&&db.queryForObject("SELECT COUNT(*) FROM project_memberships WHERE project_id=? AND user_id=? AND status='ACTIVE'",Long.class,project,recipient)!=1)return null;
        String id=UUID.randomUUID().toString();var payload=new LinkedHashMap<String,Object>();
        payload.put("destinationPath",destination);payload.put("userId",recipient);payload.put("projectId",project);payload.put("taskId",task);payload.put("actorId",actor);payload.put("type",type);payload.put("title",title);payload.put("body",body);payload.put("email",email);payload.put("reasons",reasons);payload.put("allowNonMember",allowNonMember);payload.put("expiresAt",clock.instant().plus(Duration.ofDays(7)).toString());
        db.update("INSERT INTO outbox_events(event_id,aggregate_type,aggregate_id,aggregate_version,event_type,schema_version,occurred_at,payload) VALUES(?,'Notification',?,0,?,1,?,?)",id,recipient,destination==null?"work.notification.created":"work.notification.v2.created",Timestamp.from(clock.instant()),json.writeValueAsString(payload));return id;
    }
    @Transactional(propagation=Propagation.MANDATORY)
    public void team(long team, String actor, String recipient, String type, String title, String body) {
        var payload = new LinkedHashMap<String,Object>();
        payload.put("destinationPath",type.equals("team.invitation.created")?"/team-management":"/team-management/"+team);
        payload.put("userId",recipient); payload.put("teamId",team); payload.put("projectId",null); payload.put("taskId",null);
        payload.put("actorId",actor); payload.put("type",type); payload.put("title",title); payload.put("body",body);
        payload.put("email",false); payload.put("reasons",List.of()); payload.put("allowNonMember",true);
        payload.put("expiresAt",clock.instant().plus(Duration.ofDays(7)).toString());
        db.update("INSERT INTO outbox_events(event_id,aggregate_type,aggregate_id,aggregate_version,event_type,schema_version,occurred_at,payload) VALUES(?,'Notification',?,0,'work.notification.v2.created',1,?,?)",
            UUID.randomUUID().toString(),recipient,Timestamp.from(clock.instant()),json.writeValueAsString(payload));
    }
    @Transactional(propagation = Propagation.MANDATORY)
    public void chat(long conversationId, String actor, String recipient, boolean direct) {
        var payload = new LinkedHashMap<String, Object>();
        payload.put("userId", recipient);
        payload.put("actorId", actor);
        payload.put("projectId", null);
        payload.put("taskId", null);
        payload.put("type", "discovery.chat.message");
        payload.put("resourceType", "CONVERSATION");
        payload.put("resourceId", Long.toString(conversationId));
        payload.put("destinationPath", "/messages?conversation=" + conversationId);
        payload.put("title", "Bạn có tin nhắn mới");
        payload.put("body", "Mở cuộc trò chuyện để xem và trả lời.");
        payload.put("email", false);
        payload.put("reasons", List.of());
        payload.put("directMessage", direct);
        payload.put("allowNonMember", true);
        payload.put("expiresAt", clock.instant().plus(Duration.ofDays(7)).toString());
        db.update("""
            INSERT INTO outbox_events(event_id,aggregate_type,aggregate_id,aggregate_version,event_type,schema_version,occurred_at,payload)
            VALUES(?,'Notification',?,0,'work.notification.v2.created',1,?,?)
            """, UUID.randomUUID().toString(), recipient, Timestamp.from(clock.instant()), json.writeValueAsString(payload));
    }
    @Transactional(propagation = Propagation.MANDATORY)
    public void assigned(long project, long task, String actor, String recipient) {
        if (!recipient.equals(actor)) send(project, task, actor, recipient, "work.task.assigned",
            "Bạn được giao nhiệm vụ", "Mở nhiệm vụ để xem nội dung và thời hạn.", false, List.of(), false);
    }
    public void task(long project,long task,String actor,Collection<String> recipients,String type,String title){task(project,task,actor,recipients,type,title,"Mở nhiệm vụ để xem nội dung và phản hồi.");}
    public void task(long project,long task,String actor,Collection<String> recipients,String type,String title,String body){for(String user:new LinkedHashSet<>(recipients))send(project,task,actor,user,type,title,body,true,List.of(),false);}
}

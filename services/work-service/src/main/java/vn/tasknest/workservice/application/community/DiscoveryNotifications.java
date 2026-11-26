package vn.tasknest.workservice.application.community;

import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import tools.jackson.databind.json.JsonMapper;

/** Account-scoped discovery events: transactional outbox and stable per-transition delivery IDs.
 * V2 routing prevents legacy relays from claiming events that require the upgraded consumer. */
@Service
public class DiscoveryNotifications {
    private final JdbcTemplate db; private final Clock clock; private final JsonMapper json=new JsonMapper();
    public DiscoveryNotifications(JdbcTemplate db,Clock clock){this.db=db;this.clock=clock;}
    @Transactional(propagation=Propagation.MANDATORY)
    public void send(String actor,String recipient,String type,String resource,String id,String transition,String title,String body,String destination) {
        if(recipient==null||recipient.equals(actor))return;
        String event=UUID.nameUUIDFromBytes(("discovery/"+type+"/"+resource+"/"+id+"/"+transition+"/"+recipient).getBytes(StandardCharsets.UTF_8)).toString();
        var payload=new LinkedHashMap<String,Object>();
        payload.put("userId",recipient);payload.put("actorId",actor);payload.put("projectId",null);payload.put("taskId",null);
        payload.put("type",type);payload.put("resourceType",resource);payload.put("resourceId",id);payload.put("destinationPath",destination);
        payload.put("title",title);payload.put("body",body);payload.put("email",false);payload.put("allowNonMember",true);payload.put("reasons",List.of());
        payload.put("expiresAt",clock.instant().plus(Duration.ofDays(7)).toString());
        db.update("INSERT IGNORE INTO outbox_events(event_id,aggregate_type,aggregate_id,aggregate_version,event_type,schema_version,occurred_at,payload) VALUES(?,'Notification',?,0,'work.notification.v2.created',1,?,?)",event,recipient,Timestamp.from(clock.instant()),json.writeValueAsString(payload));
    }
    public void team(String actor,long team,String recipient,String type,String transition,String title,String body,String destination){send(actor,recipient,type,"TEAM",String.valueOf(team),transition,title,body,destination);}
    public void request(String actor,long request,String recipient,String type,String transition,String title,String body,String destination){send(actor,recipient,type,"REQUEST",String.valueOf(request),transition,title,body,destination);}
}

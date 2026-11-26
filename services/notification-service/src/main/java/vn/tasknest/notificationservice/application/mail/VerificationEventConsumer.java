package vn.tasknest.notificationservice.application.mail;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.UUID;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.AmqpRejectAndDontRequeueException;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.json.JsonMapper;

@Component

public class VerificationEventConsumer {
    private final JdbcTemplate jdbc;
    private final TransactionTemplate tx;
    private final JsonMapper json = new JsonMapper();
    private org.springframework.amqp.rabbit.core.RabbitTemplate realtime;
    @org.springframework.beans.factory.annotation.Autowired public void realtimePublisher(org.springframework.amqp.rabbit.core.RabbitTemplate rabbit){this.realtime=rabbit;}
    public VerificationEventConsumer(JdbcTemplate jdbc, TransactionTemplate tx) { this.jdbc=jdbc; this.tx=tx; }

    @RabbitListener(queues="tasknest.notification.events", ackMode="AUTO")
    public void receive(Message message) {
        try {
            ingest(message.getBody());
            var event=json.readTree(message.getBody());
            if(realtime!=null && java.util.Set.of("work.project-invitation.created","work.notification.created","work.notification.v2.created").contains(event.path("eventType").asText()))
                realtime.convertAndSend("tasknest.events","notification.inbox.changed",json.writeValueAsBytes(java.util.Map.of("userId",event.path("payload").path("userId").asText())));
            // Container ACKs only after BOTH dedupe marker and job commit.
        } catch (IllegalArgumentException ex) {
            throw new AmqpRejectAndDontRequeueException("Invalid notification event");
        } catch (RuntimeException ex) {
            // Sanitized retryable exception: no payload or token in listener logs.
            throw new IllegalStateException("Notification event processing failed");
        }
    }

    private void invitation(tools.jackson.databind.JsonNode event) {
        String id=UUID.fromString(event.path("eventId").asText()).toString();
        var data=event.path("payload");
        String user=UUID.fromString(data.path("userId").asText()).toString();
        String actor=UUID.fromString(data.path("actorId").asText()).toString();
        String email=data.path("email").asText();
        long project=data.path("projectId").asLong(), invitation=data.path("invitationId").asLong();
        String name=data.path("projectName").asText();
        java.time.Instant expires=java.time.Instant.parse(data.path("expiresAt").asText());
        if(event.path("schemaVersion").asInt()!=1 || project<=0 || invitation<=0 || !email.contains("@") || email.length()>255 || name.isBlank() || name.length()>100) throw new IllegalArgumentException("Invalid invitation event");
        tx.executeWithoutResult(status -> {
            if(jdbc.update("INSERT IGNORE INTO processed_events(consumer_name,event_id,event_type) VALUES('project-invitation',?,'work.project-invitation.created')",id)==0) return;
            if(!expires.isAfter(java.time.Instant.now())) return;
            jdbc.update("""
                INSERT INTO notifications(recipient_user_id,event_id,event_type,actor_user_id,project_id,resource_type,resource_id,title,body)
                VALUES(?,?,'work.project-invitation.created',?,?,'PROJECT_INVITATION',?,'Lời mời tham gia dự án',?)
                """,user,id,actor,project,String.valueOf(invitation),"Bạn được mời tham gia dự án "+name+". Mở Lời mời và yêu cầu để phản hồi.");
            Long notification=jdbc.queryForObject("SELECT id FROM notifications WHERE recipient_user_id=? AND event_id=?",Long.class,user,id);
            jdbc.update("""
                INSERT INTO email_jobs(event_id,recipient_user_id,recipient_email,event_type,purpose,notification_id,template_key,template_data,expires_at)
                VALUES(?,?,?,'work.project-invitation.created','PROJECT_EVENT',?,'project-invitation',?,?)
                """,id,user,email,notification,json.writeValueAsString(data),java.sql.Timestamp.from(expires));
        });
    }

    private void notification(tools.jackson.databind.JsonNode event) {
        String id=UUID.fromString(event.path("eventId").asText()).toString();var data=event.path("payload");
        String user=UUID.fromString(data.path("userId").asText()).toString();
        long project=data.path("projectId").asLong();Long task=data.path("taskId").isNull()?null:data.path("taskId").asLong();
        String type=data.path("type").asText(),title=data.path("title").asText(),body=data.path("body").asText();
        long team=data.path("teamId").asLong();
        boolean teamEvent=java.util.Set.of("team.invitation.created","team.invitation.accepted","team.invitation.rejected").contains(type);
        boolean discoveryEvent=java.util.Set.of("discovery.engagement.proposed","discovery.engagement.accepted","discovery.engagement.declined","discovery.engagement.completed","discovery.engagement.reopen","discovery.application.created","discovery.application.withdrawn","discovery.application.accepted","discovery.application.rejected","discovery.opening.status","discovery.proposal.created","discovery.proposal.updated","discovery.proposal.withdrawn","discovery.proposal.declined","discovery.request.updated","discovery.request.status","discovery.discussion.message","discovery.chat.message","discovery.review.created","discovery.review.replied","discovery.member.recognized","discovery.profile.liked","discovery.connection.requested","discovery.connection.accepted").contains(type);
        String resource=data.path("resourceType").asText(),resourceId=data.path("resourceId").asText();
        String destination=data.path("destinationPath").isMissingNode()||data.path("destinationPath").isNull()?null:data.path("destinationPath").asText();
        boolean legacyChat="work.notification.created".equals(event.path("eventType").asText()) && "discovery.chat.message".equals(type);
        if(!NotificationDestination.valid(destination))throw new IllegalArgumentException("Invalid notification destination");
        if("discovery.chat.message".equals(type) && (!"CONVERSATION".equals(resource) || !resourceId.matches("[1-9][0-9]{0,18}") || (destination!=null && !("/messages?conversation="+resourceId).equals(destination)) || (destination==null && !legacyChat)))throw new IllegalArgumentException("Invalid chat destination");
        if("CONVERSATION".equals(resource) && !"discovery.chat.message".equals(type))throw new IllegalArgumentException("Invalid chat resource");
        if(discoveryEvent && (!data.path("projectId").isNull() || task!=null || !data.path("allowNonMember").asBoolean() || data.path("email").asBoolean() || (destination==null && !legacyChat) || !java.util.Set.of("TEAM","REQUEST","MEMBER","CONVERSATION").contains(resource) || !(resource.equals("MEMBER")?resourceId.matches("[0-9a-f-]{36}"):resourceId.matches("[1-9][0-9]*"))))throw new IllegalArgumentException("Invalid discovery notification");
        if(teamEvent && (team<=0 || !data.path("projectId").isNull() || task!=null || !data.path("allowNonMember").asBoolean() || data.path("email").asBoolean()))throw new IllegalArgumentException("Invalid team notification");
        if((!teamEvent && !discoveryEvent && project<=0)||title.isBlank()||title.length()>255||body.length()>4000||!type.matches("[a-zA-Z0-9._-]{1,120}"))throw new IllegalArgumentException("Invalid notification event");
        java.time.Instant expiry=java.time.Instant.parse(data.path("expiresAt").asText());
        tx.executeWithoutResult(status->{
            if(jdbc.update("INSERT IGNORE INTO processed_events(consumer_name,event_id,event_type) VALUES('work-notification',?,?)",id,type)==0||!expiry.isAfter(java.time.Instant.now()))return;
            String reasons=json.writeValueAsString(data.path("reasons"));
            jdbc.update("INSERT INTO notifications(recipient_user_id,event_id,event_type,actor_user_id,project_id,task_id,resource_type,resource_id,title,body,recipient_reasons,access_scope,destination_path,push_direct) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",user,id,type,data.path("actorId").isNull()?null:data.path("actorId").asText(),teamEvent||discoveryEvent?null:project,task,discoveryEvent?resource:teamEvent?"TEAM":"WORK_EVENT",discoveryEvent?resourceId:teamEvent?String.valueOf(team):task==null?String.valueOf(project):String.valueOf(task),title,body,reasons,data.path("allowNonMember").asBoolean()?"ACCOUNT_ONLY":"PROJECT_MEMBER",destination,"discovery.chat.message".equals(type) && data.path("directMessage").asBoolean());
            Long notification=jdbc.queryForObject("SELECT id FROM notifications WHERE recipient_user_id=? AND event_id=?",Long.class,user,id);
            if(data.path("email").asBoolean())jdbc.update("INSERT INTO email_jobs(event_id,recipient_user_id,recipient_email,event_type,purpose,notification_id,template_key,template_data,expires_at,recipient_reasons) VALUES(?,?,'',?,?,?,?,?,?,?)",id,user,type,type.startsWith("task.comment.")?"TASK_EVENT":"PROJECT_EVENT",notification,"work-event",json.writeValueAsString(data),java.sql.Timestamp.from(expiry),reasons);
        });
    }

    public void ingest(byte[] body) {
        var event=json.readTree(body);
        String type=event.path("eventType").asText();
        if ("work.notification.created".equals(type)||"work.notification.v2.created".equals(type)) { notification(event); return; }
        if ("work.project-invitation.created".equals(type)) { invitation(event); return; }
        boolean reset="identity.password-reset.requested".equals(type);
        if (!reset && !"identity.email-verification.requested".equals(type)) return;
        String id=UUID.fromString(event.path("eventId").asText()).toString();
        int version=event.path("schemaVersion").asInt();
        String rawUserId=event.path("userId").asText();
        // Pending v1 broker messages may still contain a legacy numeric ID.
        String userId=version==1 && rawUserId.matches("[1-9][0-9]*")
            ? UUID.nameUUIDFromBytes(("tasknest:user:"+rawUserId).getBytes(StandardCharsets.UTF_8)).toString()
            : UUID.fromString(rawUserId).toString();
        String keyId=event.path("encryptionKeyId").asText();
        byte[] encrypted=Base64.getDecoder().decode(event.path("sensitivePayload").asText());
        java.time.Instant expires=java.time.Instant.parse(event.path("payload").path("expiresAt").asText());
        if (keyId.isBlank() || keyId.length()>100 || encrypted.length<28
            || (version!=1 && version!=2)) throw new IllegalArgumentException("Invalid event");
        tx.executeWithoutResult(status -> {
            if (jdbc.update("INSERT IGNORE INTO processed_events(consumer_name,event_id,event_type) VALUES ('verification-email',?,?)",id,type)==0) return;
            // Expired messages are consumed/deduplicated without creating an undeliverable job.
            if (!expires.isAfter(java.time.Instant.now())) return;
            // Recipient is inside the encrypted payload; resolved only by the mail worker.
            jdbc.update("""
                INSERT INTO email_jobs(event_id,recipient_user_id,recipient_email,event_type,purpose,
                  template_key,template_data,sensitive_data,encryption_key_id,expires_at)
                VALUES (?,?,'',?,?,?,'{}',?,?,?)
                """,id,userId,type,reset?"PASSWORD_RESET":"EMAIL_VERIFICATION",reset?"password-reset":"email-verification",encrypted,keyId,java.sql.Timestamp.from(expires));
        });
    }
}

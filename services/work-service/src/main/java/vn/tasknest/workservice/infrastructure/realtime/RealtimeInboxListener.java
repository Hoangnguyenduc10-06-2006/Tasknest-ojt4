package vn.tasknest.workservice.infrastructure.realtime;
import org.springframework.stereotype.Component;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
@Component
public class RealtimeInboxListener {
    private final WorkspaceSocket socket;public RealtimeInboxListener(WorkspaceSocket socket){this.socket=socket;}
    @RabbitListener(queues="#{realtimeQueue.name}") public void inbox(org.springframework.amqp.core.Message message){try{var payload=new tools.jackson.databind.json.JsonMapper().readTree(message.getBody());socket.inboxChanged(payload.path("userId").asText());}catch(RuntimeException ex){throw new org.springframework.amqp.AmqpRejectAndDontRequeueException("Invalid realtime event");}}
}

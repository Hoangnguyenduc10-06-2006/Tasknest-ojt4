package vn.tasknest.workservice.config;
import org.springframework.context.annotation.*;
import org.springframework.amqp.core.*;
@Configuration
public class RealtimeTopology {
    @Bean Queue realtimeQueue(){return new AnonymousQueue();}
    @Bean Binding realtimeBinding(Queue realtimeQueue){return BindingBuilder.bind(realtimeQueue).to(new TopicExchange("tasknest.events",true,false)).with("notification.inbox.changed");}
}

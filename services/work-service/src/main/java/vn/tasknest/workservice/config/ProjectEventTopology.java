package vn.tasknest.workservice.config;
import org.springframework.amqp.core.*;
import org.springframework.context.annotation.*;
@Configuration
public class ProjectEventTopology {
    @Bean Declarables projectNotificationDeclarations() {
        var exchange=new TopicExchange("tasknest.events",true,false);
        var queue=QueueBuilder.durable("tasknest.notification.events").deadLetterExchange("tasknest.dead-letter").deadLetterRoutingKey("notification.failed").build();
        return new Declarables(exchange,queue,BindingBuilder.bind(queue).to(exchange).with("#"));
    }
}

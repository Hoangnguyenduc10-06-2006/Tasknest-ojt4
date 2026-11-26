package vn.tasknest.notificationservice.config;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Declarables;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
@Configuration
public class MessagingConfiguration {
    @Bean
    Declarables notificationTopology() {
        var events = new TopicExchange("tasknest.events", true, false);
        var dead = new TopicExchange("tasknest.dead-letter", true, false);
        var queue = QueueBuilder.durable("tasknest.notification.events")
                .deadLetterExchange(dead.getName()).deadLetterRoutingKey("notification.failed").build();
        var dlq = QueueBuilder.durable("tasknest.notification.dead-letter").build();
        return new Declarables(events, dead, queue, dlq,
                BindingBuilder.bind(queue).to(events).with("#"),
                BindingBuilder.bind(dlq).to(dead).with("notification.failed"));
    }
}

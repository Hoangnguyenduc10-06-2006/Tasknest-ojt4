package vn.tasknest.identityservice.infrastructure.messaging;

import java.time.Duration;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.amqp.rabbit.connection.CorrelationData;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.json.JsonMapper;

/** At-least-once relay: durable claim, publisher confirm, consumer deduplication by eventId. */
@Component
@ConditionalOnProperty(name = "tasknest.mail.enabled", havingValue = "true")
public class VerificationOutboxPublisher {
    private final JdbcTemplate jdbc;
    private final TransactionTemplate tx;
    private final RabbitTemplate rabbit;
    private final JsonMapper json = new JsonMapper();
    private final String worker = UUID.randomUUID().toString();

    public VerificationOutboxPublisher(JdbcTemplate jdbc, TransactionTemplate tx, RabbitTemplate rabbit) {
        this.jdbc = jdbc; this.tx = tx; this.rabbit = rabbit;
    }

    @Scheduled(fixedDelayString = "${tasknest.mail.poll-ms:2000}")
    public void dispatch() {
        for (int i = 0; i < 10; i++) {
            Map<String, Object> event = tx.execute(status -> {
                var rows = jdbc.queryForList("""
                    SELECT * FROM outbox_events WHERE event_type IN ('identity.email-verification.requested','identity.password-reset.requested')
                    AND ((status='PENDING' AND available_at<=UTC_TIMESTAMP(6))
                      OR (status='PROCESSING' AND locked_until<UTC_TIMESTAMP(6)))
                    ORDER BY occurred_at LIMIT 1 FOR UPDATE SKIP LOCKED
                    """);
                if (rows.isEmpty()) return null;
                var row = rows.getFirst();
                jdbc.update("""
                    UPDATE outbox_events SET status='PROCESSING', locked_by=?,
                    locked_until=DATE_ADD(UTC_TIMESTAMP(6), INTERVAL 30 SECOND), attempts=attempts+1 WHERE event_id=?
                    """, worker, row.get("event_id"));
                return row;
            });
            if (event == null) return;
            String id = event.get("event_id").toString();
            try {
                byte[] body = json.writeValueAsBytes(Map.of(
                    "eventId", id, "eventType", event.get("event_type"), "schemaVersion", 2,
                    "userId", UUID.fromString(event.get("aggregate_id").toString()).toString(),
                    "payload", json.readTree(event.get("payload").toString()),
                    "sensitivePayload", event.get("sensitive_payload"), "encryptionKeyId", event.get("encryption_key_id")));
                var props = new MessageProperties();
                props.setContentType("application/json"); props.setMessageId(id);
                props.setDeliveryMode(org.springframework.amqp.core.MessageDeliveryMode.PERSISTENT);
                var correlation = new CorrelationData(id);
                rabbit.send("tasknest.events", event.get("event_type").toString(), new Message(body, props), correlation);
                var confirm = correlation.getFuture().get(10, TimeUnit.SECONDS);
                if (!confirm.isAck() || correlation.getReturned() != null) throw new IllegalStateException("Not routed");
                jdbc.update("""
                    UPDATE outbox_events SET status='PUBLISHED', published_at=UTC_TIMESTAMP(6),
                    locked_by=NULL, locked_until=NULL, last_error_safe=NULL WHERE event_id=? AND locked_by=?
                    """, id, worker);
            } catch (Exception ex) {
                if (ex instanceof InterruptedException) Thread.currentThread().interrupt();
                // Never persist exception messages: broker errors may include serialized sensitive data.
                jdbc.update("""
                    UPDATE outbox_events SET status=IF(attempts>=10,'DEAD','PENDING'),
                    available_at=DATE_ADD(UTC_TIMESTAMP(6), INTERVAL 30 SECOND),
                    locked_by=NULL, locked_until=NULL, last_error_safe='BROKER_PUBLISH_FAILED'
                    WHERE event_id=? AND locked_by=?
                    """, id, worker);
                return;
            }
        }
    }
}

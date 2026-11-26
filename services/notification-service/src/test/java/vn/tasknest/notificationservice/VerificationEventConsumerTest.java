package vn.tasknest.notificationservice;

import java.time.Instant;
import java.util.Base64;
import java.util.function.Consumer;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.amqp.AmqpRejectAndDontRequeueException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.TransactionTemplate;
import vn.tasknest.notificationservice.application.mail.VerificationEventConsumer;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class VerificationEventConsumerTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final TransactionTemplate tx = mock(TransactionTemplate.class);
    private byte[] event(Instant expires) {
        return ("""
            {"eventType":"identity.email-verification.requested","eventId":"00000000-0000-4000-8000-000000000001",
            "schemaVersion":2,"userId":"00000000-0000-4000-8000-000000000002","encryptionKeyId":"test",
            "sensitivePayload":"%s","payload":{"expiresAt":"%s"}}
            """).formatted(Base64.getEncoder().encodeToString(new byte[32]), expires).getBytes(java.nio.charset.StandardCharsets.UTF_8);
    }
    @SuppressWarnings("unchecked")
    private void transaction() {
        doAnswer(invocation -> { ((Consumer<TransactionStatus>) invocation.getArgument(0)).accept(null); return null; })
            .when(tx).executeWithoutResult(any());
        when(jdbc.update(anyString(), any(Object[].class))).thenReturn(1);
    }
    @Test void expiredEventCommitsDedupeWithoutCreatingAJob() {
        transaction(); new VerificationEventConsumer(jdbc, tx).ingest(event(Instant.now().minusSeconds(10)));
        verify(jdbc, times(1)).update(anyString(), any(Object[].class));
    }
    @Test void currentEventCommitsBothMarkerAndJob() {
        transaction(); new VerificationEventConsumer(jdbc, tx).ingest(event(Instant.now().plusSeconds(3600)));
        verify(jdbc, times(2)).update(anyString(), any(Object[].class));
    }
    @Test void databaseFailureIsRetryableAndSanitized() {
        doThrow(new IllegalStateException("sensitive database details")).when(tx).executeWithoutResult(any());
        var consumer = new VerificationEventConsumer(jdbc, tx);
        var ex = assertThrows(IllegalStateException.class, () -> consumer.receive(new Message(event(Instant.now().plusSeconds(3600)), new MessageProperties())));
        assertNull(ex.getCause()); assertFalse(ex.getMessage().contains("sensitive"));
    }
    @Test void malformedEventIsRejected() {
        assertThrows(AmqpRejectAndDontRequeueException.class, () -> new VerificationEventConsumer(jdbc, tx)
            .receive(new Message("{\"eventType\":\"identity.email-verification.requested\",\"eventId\":\"invalid\"}".getBytes(), new MessageProperties())));
    }
    @Test void dueSoonTaskAlertCreatesInboxNotificationAndEmailJobOnce() {
        transaction();
        when(jdbc.queryForObject(anyString(), eq(Long.class), any(), any())).thenReturn(99L);
        byte[] alertEvent = ("""
            {"eventType":"work.notification.created","eventId":"00000000-0000-4000-8000-000000000010",
            "schemaVersion":1,"payload":{"userId":"00000000-0000-4000-8000-000000000002","projectId":7,"taskId":15,
            "actorId":null,"type":"work.task.alert.due_soon","title":"Nhiệm vụ sắp đến hạn",
            "body":"Nhiệm vụ sẽ đến hạn vào ngày 2026-11-07. Hãy chủ động xử lý trước hạn.",
            "email":true,"reasons":[],"allowNonMember":false,"expiresAt":"%s"}}
            """).formatted(Instant.now().plusSeconds(3600)).getBytes(java.nio.charset.StandardCharsets.UTF_8);
        var consumer = new VerificationEventConsumer(jdbc, tx);
        consumer.ingest(alertEvent);
        // 1: processed_events, 2: notifications, 3: email_jobs
        verify(jdbc, times(3)).update(anyString(), any(Object[].class));

        // Duplicate delivery is ignored when processed_events INSERT IGNORE returns 0.
        reset(jdbc);
        when(jdbc.update(startsWith("INSERT IGNORE INTO processed_events"), any(Object[].class))).thenReturn(0);
        consumer.ingest(alertEvent);
        verify(jdbc, times(1)).update(startsWith("INSERT IGNORE INTO processed_events"), any(Object[].class));
        verifyNoMoreInteractions(jdbc);
    }
    @Test void teamInvitationCreatesAccountNotificationWithoutProjectOrEmail() {
        transaction();when(jdbc.queryForObject(anyString(),eq(Long.class),any(),any())).thenReturn(12L);
        byte[] event=("""
            {"eventType":"work.notification.created","eventId":"00000000-0000-4000-8000-000000000010",
             "payload":{"userId":"00000000-0000-4000-8000-000000000002","projectId":null,"taskId":null,"teamId":4,
             "actorId":null,"type":"team.invitation.created","title":"Lời mời vào đội","body":"Mở Đội của tôi.",
             "email":false,"allowNonMember":true,"reasons":[],"expiresAt":"%s"}}
            """).formatted(Instant.now().plusSeconds(3600)).getBytes(java.nio.charset.StandardCharsets.UTF_8);
        new VerificationEventConsumer(jdbc,tx).ingest(event);
        verify(jdbc,times(2)).update(anyString(),any(Object[].class));
        verify(jdbc).update(startsWith("INSERT INTO notifications"),eq("00000000-0000-4000-8000-000000000002"),anyString(),eq("team.invitation.created"),isNull(),isNull(),isNull(),eq("TEAM"),eq("4"),anyString(),anyString(),anyString(),eq("ACCOUNT_ONLY"),isNull(),eq(false));
    }
    @Test void discoveryDiscussionIsPrivateAndDeduplicated() {
        transaction();when(jdbc.queryForObject(anyString(),eq(Long.class),any(),any())).thenReturn(12L);
        byte[] event=("""
            {"eventType":"work.notification.v2.created","eventId":"00000000-0000-4000-8000-000000000011",
             "payload":{"userId":"00000000-0000-4000-8000-000000000002","projectId":null,"taskId":null,
             "resourceType":"REQUEST","resourceId":"8","destinationPath":"/requests/8?proposal=12&discussion=1",
             "actorId":null,"type":"discovery.discussion.message","title":"Có trao đổi mới","body":"Mở đề xuất để xem.",
             "email":false,"allowNonMember":true,"reasons":[],"expiresAt":"%s"}}
            """).formatted(Instant.now().plusSeconds(3600)).getBytes(java.nio.charset.StandardCharsets.UTF_8);
        var consumer=new VerificationEventConsumer(jdbc,tx);consumer.ingest(event);
        verify(jdbc,times(2)).update(anyString(),any(Object[].class));
        verify(jdbc).update(startsWith("INSERT INTO notifications"),eq("00000000-0000-4000-8000-000000000002"),anyString(),eq("discovery.discussion.message"),isNull(),isNull(),isNull(),eq("REQUEST"),eq("8"),anyString(),anyString(),anyString(),eq("ACCOUNT_ONLY"),eq("/requests/8?proposal=12&discussion=1"),eq(false));
        reset(jdbc);when(jdbc.update(startsWith("INSERT IGNORE INTO processed_events"),any(Object[].class))).thenReturn(0);
        consumer.ingest(event);verify(jdbc,times(1)).update(anyString(),any(Object[].class));verifyNoMoreInteractions(jdbc);
        String invalid=new String(event,java.nio.charset.StandardCharsets.UTF_8).replace("/requests/8?proposal=12&discussion=1","https://evil.test");
        assertThrows(IllegalArgumentException.class,()->consumer.ingest(invalid.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
    }
    @Test void chatNotificationsUseAccountScopeAndExactConversationDestination() {
        transaction();when(jdbc.queryForObject(anyString(),eq(Long.class),any(),any())).thenReturn(12L);
        String event=("""
          {"eventType":"work.notification.v2.created","eventId":"00000000-0000-4000-8000-000000000010","schemaVersion":1,
           "payload":{"userId":"00000000-0000-4000-8000-000000000002","actorId":"00000000-0000-4000-8000-000000000001",
           "projectId":null,"taskId":null,"type":"discovery.chat.message","resourceType":"CONVERSATION","resourceId":"8",
           "destinationPath":"/messages?conversation=8","directMessage":true,"title":"Tin nhắn mới","body":"Mở để xem.","email":false,"allowNonMember":true,
           "reasons":[],"expiresAt":"%s"}}
          """).formatted(Instant.now().plusSeconds(3600));
        var consumer=new VerificationEventConsumer(jdbc,tx);consumer.ingest(event.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        verify(jdbc).update(startsWith("INSERT INTO notifications"),any(),any(),eq("discovery.chat.message"),any(),isNull(),isNull(),eq("CONVERSATION"),eq("8"),any(),any(),any(),eq("ACCOUNT_ONLY"),eq("/messages?conversation=8"),eq(true));
        assertThrows(IllegalArgumentException.class,()->consumer.ingest(event.replace("conversation=8","conversation=9").getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        assertThrows(IllegalArgumentException.class,()->consumer.ingest(event.replace("CONVERSATION","TEAM").getBytes(java.nio.charset.StandardCharsets.UTF_8)));
    }

    @Test void legacyChatNotificationsWithoutDestinationRemainReadable() {
        transaction();when(jdbc.queryForObject(anyString(),eq(Long.class),any(),any())).thenReturn(12L);
        String event=("""
          {"eventType":"work.notification.created","eventId":"00000000-0000-4000-8000-000000000010","schemaVersion":1,
           "payload":{"userId":"00000000-0000-4000-8000-000000000002","actorId":"00000000-0000-4000-8000-000000000001",
           "projectId":null,"taskId":null,"type":"discovery.chat.message","resourceType":"CONVERSATION","resourceId":"8",
           "title":"Tin nhắn mới","body":"Mở để xem.","email":false,"allowNonMember":true,
           "reasons":[],"expiresAt":"%s"}}
          """).formatted(Instant.now().plusSeconds(3600));
        new VerificationEventConsumer(jdbc,tx).ingest(event.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        verify(jdbc).update(startsWith("INSERT INTO notifications"),any(),any(),eq("discovery.chat.message"),any(),isNull(),isNull(),eq("CONVERSATION"),eq("8"),any(),any(),any(),eq("ACCOUNT_ONLY"),isNull(),eq(false));
    }

}

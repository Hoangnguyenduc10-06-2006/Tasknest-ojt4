package vn.tasknest.workservice.application.community;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import vn.tasknest.workservice.application.WorkException;
import vn.tasknest.workservice.application.security.ProjectPermissionService;
import vn.tasknest.workservice.application.security.WorkActor;
import vn.tasknest.workservice.application.workspace.WorkNotificationService;
import vn.tasknest.workservice.infrastructure.identity.IdentityDirectoryClient;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class MessagingServiceTest {
    private static final String USER = "00000000-0000-4000-8000-000000000001";
    private static final String PEER = "00000000-0000-4000-8000-000000000002";
    private final WorkActor actor = new WorkActor(USER, true);

    @Test void searchesOnlyMessagesInsideAnAuthorizedConversationAndTreatsQueryAsData() {
        var db = mock(JdbcTemplate.class);
        var room = directRoom(USER, PEER);
        when(db.queryForList("SELECT * FROM chat_conversations WHERE id=?", 7L)).thenReturn(List.of(room));
        var match = new HashMap<String, Object>();
        match.put("id", 12L);
        match.put("sender_user_id", PEER);
        match.put("sender_name", "Minh");
        match.put("body", "Bàn về %_ kế hoạch");
        match.put("created_at", "2026-11-20T00:00:00Z");
        match.put("image_id", null);
        match.put("image_count", 0L);
        match.put("reply_image_count", 0L);
        when(db.queryForList(contains("LOCATE(LOWER(?),LOWER(m.body))"), eq(7L), eq("%_"))).thenReturn(List.of(match));
        var service = service(db);

        var result = service.search(actor, 7L, "  %_  ");

        assertEquals(1, result.size());
        assertEquals(12L, result.getFirst().get("id"));
        assertEquals(false, result.getFirst().get("has_image"));
        verify(db).queryForList(contains("LOCATE(LOWER(?),LOWER(m.body))"), eq(7L), eq("%_"));
    }

    @Test void rejectsShortSearchTerms() {
        var db = mock(JdbcTemplate.class);
        when(db.queryForList("SELECT * FROM chat_conversations WHERE id=?", 7L)).thenReturn(List.of(
            directRoom(USER, PEER)));
        var error = assertThrows(WorkException.class, () -> service(db).search(actor, 7L, " "));
        assertEquals(HttpStatus.BAD_REQUEST, error.status());
        verify(db, never()).queryForList(startsWith("SELECT id,sender_user_id"), any(Object[].class));
    }

    @Test void doesNotSearchMessagesWhenTheViewerIsNotAConversationMember() {
        var db = mock(JdbcTemplate.class);
        when(db.queryForList("SELECT * FROM chat_conversations WHERE id=?", 7L)).thenReturn(List.of(
            directRoom(PEER, "00000000-0000-4000-8000-000000000003")));
        var error = assertThrows(WorkException.class, () -> service(db).search(actor, 7L, "kế hoạch"));
        assertEquals(HttpStatus.NOT_FOUND, error.status());
        verify(db, never()).queryForList(startsWith("SELECT id,sender_user_id"), any(Object[].class));
    }

    @Test void rejectsAReplyTargetFromAnotherConversationBeforeWriting() {
        var db = mock(JdbcTemplate.class);
        when(db.queryForList("SELECT * FROM chat_conversations WHERE id=?", 7L)).thenReturn(List.of(
            directRoom(USER, PEER)));
        when(db.queryForList("SELECT * FROM chat_conversations WHERE id=? FOR UPDATE", 7L)).thenReturn(List.of(
            directRoom(USER, PEER)));
        when(db.queryForObject("SELECT COUNT(*) FROM chat_messages WHERE conversation_id=? AND id=?", Long.class, 7L, 13L))
            .thenReturn(0L);
        var error = assertThrows(WorkException.class,
            () -> service(db).send(actor, 7L, "Reply", "00000000-0000-4000-8000-000000000003", 13L));
        assertEquals(HttpStatus.BAD_REQUEST, error.status());
        verify(db, never()).update(contains("INSERT INTO chat_messages"), any(Object[].class));
    }

    @Test void idempotentRetryMustKeepTheSameReplyTarget() {
        var db = mock(JdbcTemplate.class);
        when(db.queryForList("SELECT * FROM chat_conversations WHERE id=?", 7L)).thenReturn(List.of(
            directRoom(USER, PEER)));
        when(db.queryForList("SELECT * FROM chat_conversations WHERE id=? FOR UPDATE", 7L)).thenReturn(List.of(
            directRoom(USER, PEER)));
        when(db.queryForObject("SELECT COUNT(*) FROM chat_messages WHERE conversation_id=? AND id=?", Long.class, 7L, 13L))
            .thenReturn(1L);
        var prior = new HashMap<String, Object>();
        prior.put("id", 22L);
        prior.put("body", "Reply");
        prior.put("content_sha256", null);
        prior.put("reply_to_message_id", 12L);
        when(db.queryForList(contains("SELECT m.id, m.body, m.reply_to_message_id"), eq(7L), eq(USER),
            eq("00000000-0000-4000-8000-000000000004"))).thenReturn(List.of(prior));

        var error = assertThrows(WorkException.class, () -> service(db).send(actor, 7L, "Reply",
            "00000000-0000-4000-8000-000000000004", 13L));

        assertEquals(HttpStatus.CONFLICT, error.status());
        verify(db, never()).update(contains("INSERT INTO chat_messages"), any(Object[].class));
    }

    @Test void returnsOnlyReplyPreviewFieldsForHistoryAndSearchRows() {
        var db = mock(JdbcTemplate.class);
        when(db.queryForList("SELECT * FROM chat_conversations WHERE id=?", 7L)).thenReturn(List.of(
            directRoom(USER, PEER)));
        var match = new HashMap<String, Object>();
        match.put("id", 15L);
        match.put("sender_user_id", USER);
        match.put("sender_name", "An Linh");
        match.put("body", "Đồng ý");
        match.put("created_at", "2026-11-20T00:00:00Z");
        match.put("image_id", null);
        match.put("image_count", 0L);
        match.put("reply_to_message_id", 12L);
        match.put("reply_sender_user_id", PEER);
        match.put("reply_sender_name", "Minh");
        match.put("reply_body", "Bàn giao vào thứ Hai");
        match.put("reply_image_id", null);
        match.put("reply_image_count", 0L);
        when(db.queryForList(contains("LEFT JOIN chat_messages r"), eq(7L), eq("đồng ý")))
            .thenReturn(List.of(match));

        var result = service(db).search(actor, 7L, "đồng ý").getFirst();

        assertEquals(15L, result.get("id"));
        assertEquals(false, result.get("has_image"));
        assertEquals(Map.of("id", 12L, "sender_user_id", PEER, "sender_name", "Minh",
            "body", "Bàn giao vào thứ Hai", "has_image", false), result.get("reply_to"));
        assertFalse(result.containsKey("reply_image_id"));
    }

    @Test void reactionAggregatesIncludeCountAndWhetherTheViewerReacted() {
        var db = mock(JdbcTemplate.class);
        when(db.queryForList("SELECT * FROM chat_conversations WHERE id=?", 7L)).thenReturn(List.of(directRoom(USER, PEER)));
        var match = new HashMap<String, Object>();
        match.put("id", 15L);
        match.put("sender_user_id", PEER);
        match.put("sender_name", "Minh");
        match.put("body", "Đồng ý");
        match.put("created_at", "2026-11-20T00:00:00Z");
        match.put("image_count", 2L);
        match.put("reply_image_count", 0L);
        var heart = new HashMap<String, Object>();
        heart.put("message_id", 15L);
        heart.put("emoji", "❤️");
        heart.put("reaction_count", 3L);
        heart.put("reacted_by_me", 1L);
        when(db.queryForList(contains("LOCATE(LOWER(?),LOWER(m.body))"), eq(7L), eq("đồng ý")))
            .thenReturn(List.of(match));
        when(db.queryForList(startsWith("SELECT message_id, emoji"), any(Object[].class)))
            .thenReturn(List.of(heart));

        var result = service(db).search(actor, 7L, "đồng ý").getFirst();

        assertEquals(2, result.get("image_count"));
        assertEquals(List.of(Map.of("emoji", "❤️", "count", 3, "reactedByMe", true)), result.get("reactions"));
    }

    @Test void reactionsAreUpsertedOnlyForMessagesInsideTheAuthorizedConversation() {
        var db = mock(JdbcTemplate.class);
        when(db.queryForList("SELECT * FROM chat_conversations WHERE id=?", 7L)).thenReturn(List.of(directRoom(USER, PEER)));
        when(db.queryForList("SELECT * FROM chat_conversations WHERE id=? FOR UPDATE", 7L))
            .thenReturn(List.of(directRoom(USER, PEER)));
        when(db.queryForObject("SELECT COUNT(*) FROM chat_messages WHERE conversation_id=? AND id=?", Long.class, 7L, 15L))
            .thenReturn(1L);

        service(db).react(actor, 7L, 15L, "❤️");

        verify(db).update(contains("INSERT INTO chat_message_reactions"), eq(15L), eq(USER), eq("❤️"));
    }

    @Test void rejectsUnsupportedMessageReactionsWithoutWriting() {
        var db = mock(JdbcTemplate.class);
        when(db.queryForList("SELECT * FROM chat_conversations WHERE id=?", 7L)).thenReturn(List.of(directRoom(USER, PEER)));
        when(db.queryForList("SELECT * FROM chat_conversations WHERE id=? FOR UPDATE", 7L))
            .thenReturn(List.of(directRoom(USER, PEER)));

        var error = assertThrows(WorkException.class, () -> service(db).react(actor, 7L, 15L, "🔥"));

        assertEquals(HttpStatus.BAD_REQUEST, error.status());
        verify(db, never()).update(contains("chat_message_reactions"), any(Object[].class));
    }

    private MessagingService service(JdbcTemplate db) {
        return new MessagingService(db, mock(ProjectPermissionService.class), mock(IdentityDirectoryClient.class), mock(WorkNotificationService.class));
    }

    private Map<String, Object> directRoom(String low, String high) {
        var room = new HashMap<String, Object>();
        room.put("id", 7L);
        room.put("kind", "DIRECT");
        room.put("user_low", low);
        room.put("user_high", high);
        return room;
    }
}

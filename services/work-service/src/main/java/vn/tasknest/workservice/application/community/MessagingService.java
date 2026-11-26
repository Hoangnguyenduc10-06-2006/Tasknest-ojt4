package vn.tasknest.workservice.application.community;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.Statement;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Isolation;
import vn.tasknest.workservice.api.ApiValues;
import vn.tasknest.workservice.application.WorkException;
import vn.tasknest.workservice.application.collaboration.FileValidation;
import vn.tasknest.workservice.application.security.*;
import vn.tasknest.workservice.infrastructure.identity.IdentityDirectoryClient;
import vn.tasknest.workservice.application.workspace.WorkNotificationService;

@Service
public class MessagingService {
    private final JdbcTemplate db;
    private final ProjectPermissionService permissions;
    private final IdentityDirectoryClient directory;
    private final WorkNotificationService notifications;
    public MessagingService(JdbcTemplate db,ProjectPermissionService permissions,IdentityDirectoryClient directory,WorkNotificationService notifications){this.db=db;this.permissions=permissions;this.directory=directory;this.notifications=notifications;}
    // Membership is evaluated from the source on every request. A room is never its own grant of access.
    private static final String VISIBLE="""
        (c.kind='DIRECT' AND (? IN(c.user_low,c.user_high))) OR
        (c.kind='TEAM' AND EXISTS(SELECT 1 FROM dev_team_members m WHERE m.team_id=c.team_id AND m.user_id=?)) OR
        (c.kind='PROJECT' AND (EXISTS(SELECT 1 FROM project_memberships m WHERE m.project_id=c.project_id AND m.user_id=? AND m.status='ACTIVE') OR
          EXISTS(SELECT 1 FROM team_engagements e WHERE e.project_id=c.project_id AND e.customer_user_id=? AND e.status IN('ACTIVE','COMPLETED'))))
        """;

    public static final int MAX_IMAGE_BYTES = 5 * 1024 * 1024;
    public static final int MAX_IMAGES_PER_MESSAGE = 5;
    public static final Set<String> QUICK_REACTIONS = Set.of("👍", "❤️", "😂", "😮", "😢", "🙏");

    public static final class ImageUpload {
        private final String mime;
        private final byte[] bytes;
        private final byte[] digest;

        private ImageUpload(String mime, byte[] bytes, byte[] digest) {
            this.mime = mime;
            this.bytes = bytes;
            this.digest = digest;
        }

        public static ImageUpload validate(String filename, byte[] bytes) {
            if (bytes.length > MAX_IMAGE_BYTES) {
                throw new WorkException(HttpStatus.PAYLOAD_TOO_LARGE, "CHAT_IMAGE_TOO_LARGE", "Ảnh tối đa 5 MiB.");
            }
            String mime = FileValidation.validate(filename, bytes, true);
            try {
                return new ImageUpload(mime, bytes, MessageDigest.getInstance("SHA-256").digest(bytes));
            } catch (NoSuchAlgorithmException exception) {
                throw new IllegalStateException("SHA-256 is required by the Java platform", exception);
            }
        }
    }

    public record ImageDownload(String mime, byte[] bytes) {}
    @Transactional(readOnly=true)
    public Map<String,Object> list(WorkActor actor,int page){
        permissions.requireVerified(actor); if(page<0||page>10000)throw invalid("Trang không hợp lệ.");
        String u=actor.userId();
        var rooms=rows("SELECT c.* FROM chat_conversations c WHERE "+VISIBLE+" ORDER BY c.updated_at DESC,c.id DESC LIMIT 31 OFFSET ?",u,u,u,u,page*30);
        boolean more=rooms.size()>30;if(more)rooms.removeLast();
        var peers=new HashSet<String>();for(var room:rooms)if("DIRECT".equals(room.get("kind")))peers.add(peer(room,u));
        var names=directory.names(peers);var items=new ArrayList<Map<String,Object>>();for(var room:rooms)items.add(summary(room,u,names));
        long unread=unread(actor);
        return Map.of("items",items,"hasMore",more,"unreadCount",unread);
    }
    @Transactional(readOnly=true)
    public long unread(WorkActor actor){permissions.requireVerified(actor);String u=actor.userId();return count("SELECT COUNT(*) FROM chat_messages m JOIN chat_conversations c ON c.id=m.conversation_id LEFT JOIN chat_reads r ON r.conversation_id=c.id AND r.user_id=? WHERE ("+VISIBLE+") AND m.sender_user_id<>? AND m.id>COALESCE(r.last_message_id,0)",u,u,u,u,u,u);}
    @Transactional(readOnly=true)
    public Map<String,Object> spaces(WorkActor actor){
        permissions.requireVerified(actor);String u=actor.userId();
        return Map.of("teams",rows("SELECT t.id,t.name FROM dev_teams t JOIN dev_team_members m ON m.team_id=t.id WHERE m.user_id=? ORDER BY t.name LIMIT 100",u),
          "projects",rows("SELECT p.id,p.name FROM projects p WHERE EXISTS(SELECT 1 FROM project_memberships m WHERE m.project_id=p.id AND m.user_id=? AND m.status='ACTIVE') OR EXISTS(SELECT 1 FROM team_engagements e WHERE e.project_id=p.id AND e.customer_user_id=? AND e.status IN('ACTIVE','COMPLETED')) ORDER BY p.name LIMIT 100",u,u));
    }
    public List<IdentityDirectoryClient.InvitationUser> people(WorkActor actor,String search){permissions.requireVerified(actor);if(search==null||search.strip().length()<2||search.length()>100)throw invalid("Nhập từ 2 đến 100 ký tự để tìm tài khoản.");return directory.invitationUsers(search.strip()).stream().filter(p->!p.id().equals(actor.userId())).toList();}
    @Transactional(isolation=Isolation.READ_COMMITTED)
    public long open(WorkActor actor,String kind,String target){
        permissions.requireVerified(actor);var room=new HashMap<String,Object>();room.put("kind",kind);
        String scope;String low=null,high=null;Long team=null,project=null;
        if("DIRECT".equals(kind)){
            try{if(!UUID.fromString(target).toString().equals(target)||target.equals(actor.userId()))throw invalid("Chọn một tài khoản khác để nhắn tin.");}catch(IllegalArgumentException ex){throw invalid("Tài khoản không hợp lệ.");}
            directory.invitationUser(target);
            low=actor.userId().compareTo(target)<0?actor.userId():target;high=actor.userId().equals(low)?target:actor.userId();scope="DIRECT/"+low+"/"+high;
            room.put("user_low",low);room.put("user_high",high);
        }else if("TEAM".equals(kind)||"PROJECT".equals(kind)){
            long id;try{id=Long.parseLong(target);if(id<1)throw new NumberFormatException();}catch(NumberFormatException ex){throw invalid("Không gian không hợp lệ.");}
            room.put("TEAM".equals(kind)?"team_id":"project_id",id);
            authorizeSource(actor,room,true);scope=kind+"/"+id;if("TEAM".equals(kind))team=id;else project=id;
        }else throw invalid("Loại cuộc trò chuyện không hợp lệ.");
        if (project != null && !canSend(room)) {
            var existing = rows("SELECT id FROM chat_conversations WHERE scope_key=?",scope);
            if (!existing.isEmpty()) return ((Number)existing.getFirst().get("id")).longValue();
            permissions.requireUncompleted(project);
            throw conflict("Dự án đang ở chế độ chỉ xem.");
        }
        db.update("INSERT INTO chat_conversations(kind,scope_key,user_low,user_high,team_id,project_id) VALUES(?,?,?,?,?,?) ON DUPLICATE KEY UPDATE scope_key=scope_key",kind,scope,low,high,team,project);
        return db.queryForObject("SELECT id FROM chat_conversations WHERE scope_key=?",Long.class,scope);
    }
    @Transactional(readOnly=true)
    public Map<String,Object> history(WorkActor actor,long id,Long before,Long around){
        var room=access(actor,id,false);if(before!=null&&before<1)throw invalid("Mốc tin nhắn không hợp lệ.");
        if(around!=null&&(around<1||before!=null))throw invalid("Mốc tin nhắn không hợp lệ.");
        List<Map<String,Object>> items;boolean more;
        if(around==null){
            items=messageRows(actor.userId(), "AND (? IS NULL OR m.id<?) ORDER BY m.id DESC LIMIT 41",id,before,before);
            more=items.size()>40;if(more)items.removeLast();Collections.reverse(items);
        }else{
            if(count("SELECT COUNT(*) FROM chat_messages WHERE conversation_id=? AND id=?",id,around)!=1)throw invalid("Mốc tin nhắn không thuộc cuộc trò chuyện.");
            var older=messageRows(actor.userId(), "AND m.id<? ORDER BY m.id DESC LIMIT 21",id,around);more=older.size()>20;if(more)older.removeLast();Collections.reverse(older);
            var selected=messageRows(actor.userId(), "AND m.id=? ORDER BY m.id LIMIT 1",id,around);
            var newer=messageRows(actor.userId(), "AND m.id>? ORDER BY m.id LIMIT 20",id,around);
            items=new ArrayList<>(older.size()+selected.size()+newer.size());items.addAll(older);items.addAll(selected);items.addAll(newer);
        }
        var participants=participants(room);var names=directory.names(new HashSet<>(participants));
        var result=summary(room,actor.userId(),names);result.put("items",items);result.put("nextBefore",more?items.getFirst().get("id"):null);
        result.put("participants",participants.stream().map(u->Map.of("userId",u,"name",names.getOrDefault(u,"Thành viên"),"readId",readId(id,u))).toList());
        String connection = connectionState(room, actor.userId());
        Integer remaining = remainingBeforeFriendship(room, actor.userId(), connection);
        boolean writable = connection == null ? canSend(room) : !"UNAVAILABLE".equals(connection);
        result.put("connectionState", connection);
        result.put("readOnly", "PROJECT".equals(room.get("kind")) && !writable);
        result.put("myReadId", readId(id, actor.userId()));
        result.put("canSend", writable && !Integer.valueOf(0).equals(remaining));
        result.put("remainingBeforeFriendship", remaining);
        result.put("myBlocked","DIRECT".equals(room.get("kind"))&&blocked(actor.userId(),peer(room,actor.userId())));
        return result;
    }
    @Transactional(readOnly=true)
    public List<Map<String,Object>> search(WorkActor actor,long id,String query){
        access(actor,id,false);
        String text=query==null?"":query.strip();
        if(text.length()<2||text.length()>100)throw invalid("Nhập từ 2 đến 100 ký tự để tìm tin nhắn.");
        return messageRows(actor.userId(), "AND LOCATE(LOWER(?),LOWER(m.body))>0 ORDER BY m.id DESC LIMIT 20",id,text);
    }
    @Transactional(isolation=Isolation.READ_COMMITTED)
    public long send(WorkActor actor,long id,String body,String clientId){
        return send(actor, id, body, clientId, null);
    }

    @Transactional(isolation=Isolation.READ_COMMITTED)
    public long send(WorkActor actor,long id,String body,String clientId,Long replyToMessageId){
        return saveMessage(actor, id, body, clientId, null, replyToMessageId);
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public long sendImage(WorkActor actor, long id, String body, String clientId, ImageUpload image) {
        return sendImage(actor, id, body, clientId, image, null);
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public long sendImage(WorkActor actor, long id, String body, String clientId, ImageUpload image, Long replyToMessageId) {
        return sendImages(actor, id, body, clientId, List.of(Objects.requireNonNull(image)), replyToMessageId);
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public long sendImages(WorkActor actor, long id, String body, String clientId, List<ImageUpload> images, Long replyToMessageId) {
        return saveMessage(actor, id, body, clientId, images, replyToMessageId);
    }

    private long saveMessage(WorkActor actor, long id, String body, String clientId, List<ImageUpload> images, Long replyToMessageId) {
        var room = access(actor, id, true);
        var attachments = images == null ? List.<ImageUpload>of() : List.copyOf(images);
        String text = body == null ? "" : body.strip();
        if (text.length() > 4000 || (text.isEmpty() && attachments.isEmpty())) {
            throw invalid("Nhập nội dung tối đa 4000 ký tự hoặc chọn ảnh.");
        }
        if (attachments.size() > MAX_IMAGES_PER_MESSAGE) {
            throw invalid("Mỗi tin nhắn được gửi tối đa 5 ảnh.");
        }
        if (replyToMessageId != null &&
            (replyToMessageId < 1 || count("SELECT COUNT(*) FROM chat_messages WHERE conversation_id=? AND id=?", id, replyToMessageId) != 1)) {
            throw invalid("Tin nhắn được trả lời không thuộc cuộc trò chuyện này.");
        }
        var previous = rows("""
            SELECT m.id, m.body, m.reply_to_message_id
            FROM chat_messages m
            WHERE m.conversation_id=? AND m.sender_user_id=? AND m.client_message_id=?
            """, id, actor.userId(), clientId);
        if (!previous.isEmpty()) {
            var existing = previous.getFirst();
            if (!text.equals(existing.get("body")) ||
                !sameAttachmentDigests(id, ((Number) existing.get("id")).longValue(), attachments) ||
                !Objects.equals(nullableLong(existing.get("reply_to_message_id")), replyToMessageId)) {
                throw conflict("Mã gửi đã được dùng cho nội dung khác.");
            }
            return ((Number) existing.get("id")).longValue();
        }
        String connection = connectionState(room, actor.userId());
        if (connection == null ? !canSend(room) : "UNAVAILABLE".equals(connection)) {
            throw conflict("Cuộc trò chuyện hiện không thể nhận tin nhắn mới.");
        }
        if (Integer.valueOf(0).equals(remainingBeforeFriendship(room, actor.userId(), connection))) {
            throw conflict("Bạn đã gửi đủ 3 tin nhắn. Hãy kết bạn để tiếp tục trò chuyện.");
        }
        String name = directory.names(Set.of(actor.userId())).get(actor.userId());
        if (name == null) throw conflict("Không thể tải tên tài khoản. Vui lòng thử lại.");
        var imageIds = new ArrayList<Long>(attachments.size());
        for (ImageUpload image : attachments) imageIds.add(insertKey(
            "INSERT INTO chat_message_images(mime_type, content_sha256, image_data) VALUES(?,?,?)",
            image.mime, image.digest, image.bytes));
        Long imageId = imageIds.isEmpty() ? null : imageIds.getFirst();
        long message = insertKey("""
            INSERT INTO chat_messages(conversation_id,sender_user_id,sender_name,body,client_message_id,image_id,reply_to_message_id)
            VALUES(?,?,?,?,?,?,?)
            """, id, actor.userId(), name, text, clientId, imageId, replyToMessageId);
        for (int index = 0; index < imageIds.size(); index++) {
            db.update("INSERT INTO chat_message_attachments(message_id,image_id,position) VALUES(?,?,?)",
                message, imageIds.get(index), index + 1);
        }
        db.update("UPDATE chat_conversations SET updated_at=UTC_TIMESTAMP(6) WHERE id=?", id);
        for (String recipient : participants(room)) {
            if (!recipient.equals(actor.userId())) notifications.chat(id, actor.userId(), recipient, "DIRECT".equals(room.get("kind")));
        }
        return message;
    }

    @Transactional(readOnly = true)
    public ImageDownload image(WorkActor actor, long conversationId, long messageId) {
        return image(actor, conversationId, messageId, 1);
    }

    @Transactional(readOnly = true)
    public ImageDownload image(WorkActor actor, long conversationId, long messageId, int slot) {
        if (slot < 1 || slot > MAX_IMAGES_PER_MESSAGE) throw invalid("Vị trí ảnh không hợp lệ.");
        access(actor, conversationId, false);
        var images = db.query("""
            SELECT i.mime_type, i.image_data
            FROM chat_messages m
            JOIN chat_message_attachments a ON a.message_id=m.id
            JOIN chat_message_images i ON i.id=a.image_id
            WHERE m.conversation_id=? AND m.id=? AND a.position=?
            """, (rs, row) -> new ImageDownload(rs.getString("mime_type"), rs.getBytes("image_data")),
            conversationId, messageId, slot);
        if (images.isEmpty() && slot == 1) {
            images = db.query("""
                SELECT i.mime_type, i.image_data FROM chat_messages m
                JOIN chat_message_images i ON i.id=m.image_id
                WHERE m.conversation_id=? AND m.id=?
                """, (rs, row) -> new ImageDownload(rs.getString("mime_type"), rs.getBytes("image_data")),
                conversationId, messageId);
        }
        if (images.isEmpty()) throw new WorkException(HttpStatus.NOT_FOUND, "CHAT_IMAGE_NOT_FOUND", "Không tìm thấy ảnh.");
        return images.getFirst();
    }

    private boolean sameAttachmentDigests(long conversationId, long messageId, List<ImageUpload> attachments) {
        var stored = db.queryForList("""
            SELECT i.content_sha256 FROM chat_message_attachments a
            JOIN chat_message_images i ON i.id=a.image_id
            JOIN chat_messages m ON m.id=a.message_id
            WHERE m.conversation_id=? AND m.id=? ORDER BY a.position
            """, byte[].class, conversationId, messageId);
        return stored.size() == attachments.size() && java.util.stream.IntStream.range(0, stored.size())
            .allMatch(index -> Arrays.equals(stored.get(index), attachments.get(index).digest));
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public void react(WorkActor actor, long conversationId, long messageId, String emoji) {
        var room = access(actor, conversationId, true);
        if ("PROJECT".equals(room.get("kind")) && !canSend(room)) throw conflict("Dự án đang ở chế độ chỉ xem.");
        validateReaction(emoji);
        if (count("SELECT COUNT(*) FROM chat_messages WHERE conversation_id=? AND id=?", conversationId, messageId) != 1) {
            throw invalid("Tin nhắn không thuộc cuộc trò chuyện.");
        }
        db.update("""
            INSERT INTO chat_message_reactions(message_id,user_id,emoji) VALUES(?,?,?)
            ON DUPLICATE KEY UPDATE emoji=VALUES(emoji),updated_at=UTC_TIMESTAMP(6)
            """, messageId, actor.userId(), emoji);
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public void unreact(WorkActor actor, long conversationId, long messageId, String emoji) {
        var room = access(actor, conversationId, true);
        if ("PROJECT".equals(room.get("kind")) && !canSend(room)) throw conflict("Dự án đang ở chế độ chỉ xem.");
        validateReaction(emoji);
        if (count("SELECT COUNT(*) FROM chat_messages WHERE conversation_id=? AND id=?", conversationId, messageId) != 1) {
            throw invalid("Tin nhắn không thuộc cuộc trò chuyện.");
        }
        db.update("DELETE FROM chat_message_reactions WHERE message_id=? AND user_id=? AND emoji=?",
            messageId, actor.userId(), emoji);
    }

    private void validateReaction(String emoji) {
        if (!QUICK_REACTIONS.contains(emoji)) throw invalid("Biểu tượng cảm xúc không được hỗ trợ.");
    }

    private long insertKey(String sql, Object... values) {
        var key = new GeneratedKeyHolder();
        db.update(connection -> {
            var statement = connection.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);
            for (int i = 0; i < values.length; i++) statement.setObject(i + 1, values[i]);
            return statement;
        }, key);
        return Objects.requireNonNull(key.getKey()).longValue();
    }

    private List<Map<String,Object>> messageRows(String suffix, Object... args) {
        return messageRows(null, suffix, args);
    }

    private List<Map<String,Object>> messageRows(String viewer, String suffix, Object... args) {
        var messages = rows("""
            SELECT m.id,m.sender_user_id,m.sender_name,m.body,m.created_at,m.image_id,m.reply_to_message_id,
                   GREATEST((SELECT COUNT(*) FROM chat_message_attachments a WHERE a.message_id=m.id),
                            IF(m.image_id IS NULL,0,1)) AS image_count,
                   r.sender_user_id AS reply_sender_user_id,r.sender_name AS reply_sender_name,
                   r.body AS reply_body,r.image_id AS reply_image_id,
                   GREATEST((SELECT COUNT(*) FROM chat_message_attachments ra WHERE ra.message_id=r.id),
                            IF(r.image_id IS NULL,0,1)) AS reply_image_count
            FROM chat_messages m
            LEFT JOIN chat_messages r ON r.conversation_id=m.conversation_id AND r.id=m.reply_to_message_id
            WHERE m.conversation_id=?
            """ + suffix, args);
        messages.forEach(message -> {
            boolean hasImage = ((Number) message.get("image_count")).intValue() > 0;
            message.put("image_count", ((Number) message.get("image_count")).intValue());
            message.remove("image_id");
            message.put("has_image", hasImage);
            message.put("reactions", List.of());
            Long replyId = nullableLong(message.remove("reply_to_message_id"));
            Object senderId = message.remove("reply_sender_user_id");
            Object senderName = message.remove("reply_sender_name");
            Object body = message.remove("reply_body");
            boolean replyHasImage = ((Number) message.remove("reply_image_count")).intValue() > 0;
            message.remove("reply_image_id");
            if (replyId == null) {
                message.put("reply_to", null);
            } else {
                var reply = new LinkedHashMap<String, Object>();
                reply.put("id", replyId);
                reply.put("sender_user_id", senderId);
                reply.put("sender_name", senderName);
                reply.put("body", body);
                reply.put("has_image", replyHasImage);
                message.put("reply_to", reply);
            }
        });
        if (viewer != null && !messages.isEmpty()) loadReactionAggregates(messages, viewer);
        return messages;
    }

    private void loadReactionAggregates(List<Map<String,Object>> messages, String viewer) {
        String placeholders = String.join(",", Collections.nCopies(messages.size(), "?"));
        var values = new ArrayList<Object>(messages.size() + 1);
        values.add(viewer);
        for (var message : messages) values.add(message.get("id"));
        var grouped = rows("""
            SELECT message_id, emoji, COUNT(*) AS reaction_count,
                   MAX(CASE WHEN user_id=? THEN 1 ELSE 0 END) AS reacted_by_me
            FROM chat_message_reactions WHERE message_id IN (%s)
            GROUP BY message_id, emoji ORDER BY emoji
            """.formatted(placeholders), values.toArray());
        var byMessage = new HashMap<Long,List<Map<String,Object>>>();
        for (var row : grouped) {
            var reaction = new LinkedHashMap<String,Object>();
            reaction.put("emoji", row.get("emoji"));
            reaction.put("count", ((Number) row.get("reaction_count")).intValue());
            reaction.put("reactedByMe", ((Number) row.get("reacted_by_me")).intValue() > 0);
            byMessage.computeIfAbsent(((Number) row.get("message_id")).longValue(), ignored -> new ArrayList<>()).add(reaction);
        }
        for (var message : messages) {
            message.put("reactions", byMessage.getOrDefault(((Number) message.get("id")).longValue(), List.of()));
        }
    }

    private Long nullableLong(Object value) {
        return value instanceof Number number ? number.longValue() : null;
    }
    public byte[] connectedAvatar(WorkActor actor, String userId) {
        permissions.requireVerified(actor);
        String viewer = actor.userId();
        if (blocked(viewer, userId) || blocked(userId, viewer) || count("""
            SELECT COUNT(*) FROM account_connections
            WHERE user_low=LEAST(?,?) AND user_high=GREATEST(?,?) AND status='ACCEPTED'
            """, viewer, userId, viewer, userId) != 1) throw missing();
        return directory.avatar(userId);
    }

    @Transactional(isolation=Isolation.READ_COMMITTED)
    public byte[] participantAvatar(WorkActor actor, long conversationId, String userId) {
        var room = access(actor, conversationId, false);
        if ("DIRECT".equals(room.get("kind"))) {
            if (!userId.equals(peer(room, actor.userId())) || !"ACCEPTED".equals(connectionState(room, actor.userId())))
                throw missing();
        } else if (!participants(room).contains(userId)) {
            throw missing();
        }
        return directory.avatar(userId);
    }

    public void read(WorkActor actor,long id,long message){var room=access(actor,id,true);if("PROJECT".equals(room.get("kind"))&&!canSend(room))return;if(count("SELECT COUNT(*) FROM chat_messages WHERE conversation_id=? AND id=?",id,message)!=1)throw invalid("Tin nhắn không thuộc cuộc trò chuyện.");db.update("INSERT INTO chat_reads(conversation_id,user_id,last_message_id) VALUES(?,?,?) ON DUPLICATE KEY UPDATE last_message_id=GREATEST(last_message_id,?),read_at=UTC_TIMESTAMP(6)",id,actor.userId(),message,message);}
    @Transactional(isolation=Isolation.READ_COMMITTED)
    public void block(WorkActor actor,long id,boolean blocked){var room=access(actor,id,true);if(!"DIRECT".equals(room.get("kind")))throw invalid("Chỉ chặn được cuộc trò chuyện riêng.");String other=peer(room,actor.userId());if(blocked)db.update("INSERT IGNORE INTO chat_blocks(blocker_user_id,blocked_user_id) VALUES(?,?)",actor.userId(),other);else db.update("DELETE FROM chat_blocks WHERE blocker_user_id=? AND blocked_user_id=?",actor.userId(),other);}
    private Map<String,Object> access(WorkActor actor,long id,boolean lock){permissions.requireVerified(actor);var rooms=rows("SELECT * FROM chat_conversations WHERE id=?",id);if(rooms.isEmpty())throw missing();var room=rooms.getFirst();authorizeSource(actor,room,lock);if(lock)room=rows("SELECT * FROM chat_conversations WHERE id=? FOR UPDATE",id).getFirst();return room;}
    private void authorizeSource(WorkActor actor,Map<String,Object> room,boolean lock){String u=actor.userId();switch(room.get("kind").toString()){
        case "DIRECT" -> {if(!u.equals(room.get("user_low"))&&!u.equals(room.get("user_high")))throw missing();}
        case "TEAM" -> {long team=((Number)room.get("team_id")).longValue();var t=rows("SELECT id FROM dev_teams WHERE id=?"+(lock?" FOR UPDATE":""),team);if(t.isEmpty()||count("SELECT COUNT(*) FROM dev_team_members WHERE team_id=? AND user_id=?",team,u)==0)throw missing();}
        case "PROJECT" -> {long project=((Number)room.get("project_id")).longValue();var p=rows("SELECT id FROM projects WHERE id=?"+(lock?" FOR UPDATE":""),project);if(p.isEmpty()||(count("SELECT COUNT(*) FROM project_memberships WHERE project_id=? AND user_id=? AND status='ACTIVE'",project,u)==0&&count("SELECT COUNT(*) FROM team_engagements WHERE project_id=? AND customer_user_id=? AND status IN('ACTIVE','COMPLETED')",project,u)==0))throw missing();}
        default -> throw missing();}}
    private List<String> participants(Map<String,Object> room){if("DIRECT".equals(room.get("kind")))return List.of(room.get("user_low").toString(),room.get("user_high").toString());if("TEAM".equals(room.get("kind")))return db.queryForList("SELECT user_id FROM dev_team_members WHERE team_id=?",String.class,room.get("team_id"));return db.queryForList("SELECT user_id FROM project_memberships WHERE project_id=? AND status='ACTIVE' UNION SELECT customer_user_id FROM team_engagements WHERE project_id=? AND status IN('ACTIVE','COMPLETED')",String.class,room.get("project_id"),room.get("project_id"));}
    private Map<String,Object> summary(Map<String,Object> room,String u,Map<String,String> names){long id=((Number)room.get("id")).longValue();var result=new LinkedHashMap<String,Object>();result.put("id",id);result.put("kind",room.get("kind"));result.put("teamId",room.get("team_id"));result.put("projectId",room.get("project_id"));
        String title;if("DIRECT".equals(room.get("kind"))){String other=peer(room,u);title=names.getOrDefault(other,"Thành viên");result.put("peerId",other);}else title=db.queryForObject("TEAM".equals(room.get("kind"))?"SELECT name FROM dev_teams WHERE id=?":"SELECT name FROM projects WHERE id=?",String.class,"TEAM".equals(room.get("kind"))?room.get("team_id"):room.get("project_id"));
        result.put("title",title);result.put("updatedAt",room.get("updated_at"));var last=messageRows(u,"ORDER BY m.id DESC LIMIT 1",id);result.put("lastMessage",last.isEmpty()?null:last.getFirst());result.put("unread",count("SELECT COUNT(*) FROM chat_messages WHERE conversation_id=? AND id>? AND sender_user_id<>?",id,readId(id,u),u));return result;}
    private String connectionState(Map<String,Object> room, String user) {
        if (!"DIRECT".equals(room.get("kind"))) return null;
        if (!canSend(room)) return "UNAVAILABLE";
        var rows = db.queryForList("SELECT status,requested_by FROM account_connections WHERE user_low=? AND user_high=?",
            room.get("user_low"), room.get("user_high"));
        if (rows.isEmpty()) return "NONE";
        var row = rows.getFirst();
        if ("ACCEPTED".equals(row.get("status"))) return "ACCEPTED";
        return user.equals(row.get("requested_by")) ? "OUTGOING" : "INCOMING";
    }

    private Integer remainingBeforeFriendship(Map<String,Object> room, String user, String connection) {
        if (connection == null || "ACCEPTED".equals(connection) || "UNAVAILABLE".equals(connection)) return null;
        long sent = count("""
            SELECT COUNT(*) FROM (SELECT id FROM chat_messages WHERE conversation_id=? AND sender_user_id=? LIMIT 3) sent
            """, room.get("id"), user);
        return 3 - (int) sent;
    }

    private boolean canSend(Map<String,Object> room){if("DIRECT".equals(room.get("kind")))return !blocked(room.get("user_low").toString(),room.get("user_high").toString())&&!blocked(room.get("user_high").toString(),room.get("user_low").toString());if("PROJECT".equals(room.get("kind")))return count("SELECT COUNT(*) FROM projects p WHERE p.id=? AND p.status='ACTIVE' AND NOT EXISTS (SELECT 1 FROM team_engagements e WHERE e.project_id=p.id AND e.status='COMPLETED')",room.get("project_id"))==1;return true;}
    private String peer(Map<String,Object> room,String u){return room.get(u.equals(room.get("user_low"))?"user_high":"user_low").toString();}
    private boolean blocked(String u,String other){return count("SELECT COUNT(*) FROM chat_blocks WHERE blocker_user_id=? AND blocked_user_id=?",u,other)>0;}
    private long readId(long id,String u){return db.queryForObject("SELECT COALESCE(MAX(last_message_id),0) FROM chat_reads WHERE conversation_id=? AND user_id=?",Long.class,id,u);}
    private long count(String sql,Object...args){return db.queryForObject(sql,Long.class,args);}
    private List<Map<String,Object>> rows(String sql,Object...args){return ApiValues.utc(db.queryForList(sql,args));}
    private WorkException missing(){return new WorkException(HttpStatus.NOT_FOUND,"CONVERSATION_NOT_FOUND","Không tìm thấy cuộc trò chuyện hoặc bạn không còn quyền truy cập.");}
    private WorkException invalid(String message){return new WorkException(HttpStatus.BAD_REQUEST,"INVALID_MESSAGE",message);}
    private WorkException conflict(String message){return new WorkException(HttpStatus.CONFLICT,"MESSAGE_CONFLICT",message);}
}

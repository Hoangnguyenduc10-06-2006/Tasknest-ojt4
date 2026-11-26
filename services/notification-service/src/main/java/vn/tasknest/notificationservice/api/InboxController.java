package vn.tasknest.notificationservice.api;
import java.time.Instant;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

@RestController @RequestMapping("/api/notifications/inbox")
public class InboxController {
    private final JdbcTemplate db;
    private final vn.tasknest.notificationservice.application.mail.DeliveryAccess access;
    public InboxController(JdbcTemplate db,vn.tasknest.notificationservice.application.mail.DeliveryAccess access) { this.db=db;this.access=access; }
    public record Item(Long id,Long projectId,Long taskId,String eventType,String conversationId,String title,String body,Instant createdAt,Instant readAt,String destinationPath) {}
    public record Inbox(List<Item> items,long total,long unreadCount,int page,int size,long matchingTotal,long matchingUnreadCount) {}
    @GetMapping public Inbox list(@AuthenticationPrincipal String user,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size,@RequestParam(defaultValue="all") String category,@RequestParam(defaultValue="false") boolean unreadOnly) {
        if(page<0 || page>100000 || (size!=10 && size!=20 && size!=50)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        if(!java.util.Set.of("all","task","comment","invite","warning","discovery").contains(category))throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        var rows=db.queryForList("SELECT * FROM notifications WHERE recipient_user_id=? ORDER BY created_at DESC,id DESC",user);
        var allowed=new java.util.HashMap<String,Boolean>();var visible=new java.util.ArrayList<Item>();long unread=0;
        for(var row:rows){Long project=row.get("project_id")==null?null:((Number)row.get("project_id")).longValue(),task=row.get("task_id")==null?null:((Number)row.get("task_id")).longValue();
            if("PROJECT_MEMBER".equals(row.get("access_scope"))&&project!=null){String key=project+"/"+task;if(!allowed.computeIfAbsent(key,k->access.allowed(project,user,task)))continue;}
            java.time.Instant created=instant(row.get("created_at")),read=instant(row.get("read_at"));if(read==null)unread++;
            String resourceType=(String)row.get("resource_type");
            String resourceId=(String)row.get("resource_id");
            visible.add(new Item(((Number)row.get("id")).longValue(),project,task,(String)row.get("event_type"),"CONVERSATION".equals(resourceType)?resourceId:null,(String)row.get("title"),(String)row.get("body"),created,read,(String)row.get("destination_path")));
        }
        var matching=visible.stream().filter(item -> category.equals("all")||category.equals(category(item.eventType()))).toList();
        long matchingUnread=matching.stream().filter(item -> item.readAt()==null).count();
        var filtered=matching.stream().filter(item -> !unreadOnly||item.readAt()==null).toList();
        return new Inbox(filtered.stream().skip((long)page*size).limit(size).toList(),filtered.size(),unread,page,size,matching.size(),matchingUnread);
    }
    private String category(String type) {
        if(type.startsWith("discovery.")||type.startsWith("work.milestone-")||type.equals("work.project-awarded"))return "discovery";
        if(type.contains("comment"))return "comment";
        if(type.matches(".*(invitation|join|member).*"))return "invite";
        if(type.matches(".*(warning|deadline|estimate|overdue|alert|due_soon).*"))return "warning";
        return "task";
    }
    private Instant instant(Object value){if(value==null)return null;return value instanceof java.sql.Timestamp timestamp?timestamp.toInstant():((java.time.LocalDateTime)value).toInstant(java.time.ZoneOffset.UTC);}
    @PutMapping("/{id}/read") public void read(@AuthenticationPrincipal String user,@PathVariable Long id) {
        if(db.queryForObject("SELECT COUNT(*) FROM notifications WHERE id=? AND recipient_user_id=?",Long.class,id,user)!=1) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        db.update("UPDATE notifications SET read_at=COALESCE(read_at,UTC_TIMESTAMP(6)) WHERE id=? AND recipient_user_id=?",id,user);
    }
    @PutMapping("/read-all") public java.util.Map<String, Object> readAll(@AuthenticationPrincipal String user) {
        int updated = db.update("UPDATE notifications SET read_at=COALESCE(read_at,UTC_TIMESTAMP(6)) WHERE recipient_user_id=? AND read_at IS NULL", user);
        return java.util.Map.of("updated", updated);
    }
}

package vn.tasknest.workservice.application.collaboration;

import java.sql.Timestamp;
import java.time.Clock;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;
import vn.tasknest.workservice.application.WorkException;
import vn.tasknest.workservice.application.security.*;
import vn.tasknest.workservice.application.workspace.WorkNotificationService;
import vn.tasknest.workservice.domain.project.ProjectRole;

@Service
public class TaskCommentService {
    private final JdbcTemplate db;private final ProjectPermissionService permissions;private final ProjectFileService files;private final WorkNotificationService notifications;private final Clock clock;private final JsonMapper json=new JsonMapper();
    public TaskCommentService(JdbcTemplate db,ProjectPermissionService permissions,ProjectFileService files,WorkNotificationService notifications,Clock clock){this.db=db;this.permissions=permissions;this.files=files;this.notifications=notifications;this.clock=clock;}
    public record Input(String requestId,Long version,Long parentId,String body,List<Long> imageIds,List<String> mentions){}
    private WorkException conflict(String text){return new WorkException(HttpStatus.CONFLICT,"COMMENT_CONFLICT",text);}
    private Map<String,Object> task(long project,long task){var rows=db.queryForList("SELECT id,assignee_user_id,created_by FROM tasks WHERE id=? AND project_id=?",task,project);if(rows.isEmpty())throw new WorkException(HttpStatus.NOT_FOUND,"TASK_NOT_FOUND","Không tìm thấy nhiệm vụ.");return rows.getFirst();}
    private String body(Input input){return input.body()==null||input.body().isBlank()?null:input.body().strip();}
    private void validate(Input input,long project){
        String body=body(input);if(input.imageIds()==null||input.mentions()==null||input.imageIds().size()>5||new HashSet<>(input.imageIds()).size()!=input.imageIds().size()||input.mentions().size()>10||new HashSet<>(input.mentions()).size()!=input.mentions().size()||(body==null&&input.imageIds().isEmpty())||(body!=null&&body.length()>2000))throw conflict("Bình luận cần nội dung hoặc ảnh; tối đa 2000 ký tự, 5 ảnh và 10 người được nhắc.");
        for(String user:input.mentions())if(db.queryForObject("SELECT COUNT(*) FROM project_memberships WHERE project_id=? AND user_id=? AND status='ACTIVE'",Long.class,project,user)!=1)throw conflict("Người được nhắc không còn là thành viên dự án.");
    }
    public Map<String,Object> list(WorkActor actor,long project,long task,Long parent,int page,int size){permissions.requireInternalMember(project,actor);task(project,task);if(page<0||page>100000||!List.of(10,20,50).contains(size))throw conflict("Phân trang không hợp lệ.");
        String condition=parent==null?"parent_comment_id IS NULL":"parent_comment_id=?";var parameters=new ArrayList<Object>(List.of(project,task));if(parent!=null)parameters.add(parent);
        long total=db.queryForObject("SELECT COUNT(*) FROM task_comments WHERE project_id=? AND task_id=? AND "+condition,Long.class,parameters.toArray());parameters.add(size);parameters.add(page*size);
        var items=db.queryForList("SELECT c.*,(SELECT COUNT(*) FROM task_comments r WHERE r.parent_comment_id=c.id) reply_count FROM task_comments c WHERE c.project_id=? AND c.task_id=? AND c."+condition+" ORDER BY c.created_at,c.id LIMIT ? OFFSET ?",parameters.toArray());
        vn.tasknest.workservice.api.ApiValues.utc(items);
        for(var row:items){long id=((Number)row.get("id")).longValue();row.remove("request_hash");row.remove("creation_request_id");boolean deleted=row.get("deleted_at")!=null;
            row.put("images",deleted?List.of():db.queryForList("SELECT f.id,f.original_name,f.mime_type,f.size_bytes FROM comment_attachments a JOIN stored_files f ON f.id=a.stored_file_id WHERE a.comment_id=? AND f.status='READY' ORDER BY a.slot_no",id));
            row.put("mentions",deleted?List.of():db.queryForList("SELECT mentioned_user_id FROM comment_mentions WHERE comment_id=? AND removed_at IS NULL ORDER BY slot_no",String.class,id));
        }
        return Map.of("items",items,"total",total,"page",page,"size",size);
    }
    @Transactional public long save(WorkActor actor,long project,long task,Long id,Input input){
        permissions.requireInternalRole(permissions.requireWritable(project,actor));var taskRow=task(project,task);
        Map<String,Object> existing=null;
        if(id!=null){
            var rows=db.queryForList("SELECT * FROM task_comments WHERE id=? AND project_id=? AND task_id=? FOR UPDATE",id,project,task);
            if(rows.isEmpty())throw conflict("Bình luận không còn tồn tại.");
            existing=rows.getFirst();
            if(!actor.userId().equals(existing.get("author_user_id")))throw new WorkException(HttpStatus.FORBIDDEN,"COMMENT_FORBIDDEN","Chỉ được sửa bình luận của mình.");
        }
        validate(input,project);
        if(input.mentions().contains(actor.userId()))throw conflict("Không thể nhắc tên chính mình trong bình luận.");
        var now=Timestamp.from(clock.instant());boolean creating=id==null;
        byte[] requestHash=ProjectFileService.hash(json.writeValueAsBytes(input));
        if(creating){UUID.fromString(input.requestId());var prior=db.queryForList("SELECT id,request_hash FROM task_comments WHERE project_id=? AND author_user_id=? AND creation_request_id=?",project,actor.userId(),input.requestId());if(!prior.isEmpty()){if(!java.security.MessageDigest.isEqual(requestHash,(byte[])prior.getFirst().get("request_hash")))throw conflict("Mã yêu cầu đã được dùng cho bình luận khác.");return ((Number)prior.getFirst().get("id")).longValue();}
            if(input.parentId()!=null){var parent=db.queryForList("SELECT id FROM task_comments WHERE id=? AND project_id=? AND task_id=? AND parent_comment_id IS NULL AND deleted_at IS NULL FOR UPDATE",input.parentId(),project,task);if(parent.isEmpty())throw conflict("Chỉ phản hồi bình luận gốc còn tồn tại trong nhiệm vụ.");}
            var key=new GeneratedKeyHolder();db.update(connection->{var statement=connection.prepareStatement("INSERT INTO task_comments(project_id,task_id,author_user_id,body,creation_request_id,request_hash,parent_comment_id,thread_level,parent_thread_level,image_count,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",java.sql.Statement.RETURN_GENERATED_KEYS);Object[] values={project,task,actor.userId(),body(input),input.requestId(),requestHash,input.parentId(),input.parentId()==null?0:1,input.parentId()==null?null:0,input.imageIds().size(),now};for(int i=0;i<values.length;i++)statement.setObject(i+1,values[i]);return statement;},key);id=Objects.requireNonNull(key.getKey()).longValue();
        } else {
            var row=Objects.requireNonNull(existing);
            if(row.get("deleted_at")!=null||input.version()==null||((Number)row.get("version")).longValue()!=input.version())throw conflict("Bình luận đã thay đổi hoặc bị xóa. Vui lòng tải lại.");
            if(!Objects.equals(input.parentId(),row.get("parent_comment_id")==null?null:((Number)row.get("parent_comment_id")).longValue()))throw conflict("Không được chuyển bình luận sang luồng khác.");
            db.update("UPDATE task_comments SET body=?,image_count=?,edited_at=?,version=version+1 WHERE id=?",body(input),input.imageIds().size(),now,id);
        }
        var oldImages=db.queryForList("SELECT stored_file_id FROM comment_attachments WHERE comment_id=?",Long.class,id);
        for(long file:input.imageIds())if(!oldImages.contains(file))files.attach(actor,project,file,"COMMENT_IMAGE");
        db.update("DELETE FROM comment_attachments WHERE comment_id=?",id);
        for(int i=0;i<input.imageIds().size();i++)db.update("INSERT INTO comment_attachments(project_id,task_id,comment_id,slot_no,stored_file_id) VALUES(?,?,?,?,?)",project,task,id,i+1,input.imageIds().get(i));
        for(long file:oldImages)if(!input.imageIds().contains(file))files.remove(project,file,actor.userId());
        Map<String,Set<String>> recipients=new LinkedHashMap<>();
        if(creating){reason(recipients,(String)taskRow.get("assignee_user_id"),"ASSIGNEE");reason(recipients,(String)taskRow.get("created_by"),"CREATOR");if(input.parentId()!=null)reason(recipients,db.queryForObject("SELECT author_user_id FROM task_comments WHERE id=?",String.class,input.parentId()),"REPLY");}
        db.update("UPDATE comment_mentions SET removed_at=? WHERE comment_id=? AND removed_at IS NULL",now,id);
        for(int i=0;i<input.mentions().size();i++){String user=input.mentions().get(i);var history=db.queryForList("SELECT first_notified_at FROM comment_mentions WHERE comment_id=? AND mentioned_user_id=?",id,user);boolean notified=!history.isEmpty()&&history.getFirst().get("first_notified_at")!=null;
            db.update("INSERT INTO comment_mentions(project_id,task_id,comment_id,mentioned_user_id,slot_no,created_at) VALUES(?,?,?,?,?,?) ON DUPLICATE KEY UPDATE removed_at=NULL,slot_no=VALUES(slot_no)",project,task,id,user,i+1,now);if(!notified)reason(recipients,user,"MENTION");}
        recipients.remove(actor.userId());
        for(var recipient:recipients.entrySet()){
            var reasons=recipient.getValue();String event=notifications.send(project,task,actor.userId(),recipient.getKey(),creating?"task.comment.created":"task.comment.mentioned",reasons.contains("MENTION")?"Bạn được nhắc trong bình luận":reasons.contains("REPLY")?"Bình luận của bạn có phản hồi":"Có bình luận mới trong nhiệm vụ","Mở nhiệm vụ để xem trao đổi.",reasons.contains("MENTION")||reasons.contains("REPLY"),new ArrayList<>(reasons),false);
            if(event!=null&&reasons.contains("MENTION"))db.update("UPDATE comment_mentions SET first_notified_at=?,first_notification_event_id=? WHERE comment_id=? AND mentioned_user_id=? AND first_notified_at IS NULL",now,event,id,recipient.getKey());
        }
        audit(project,task,actor.userId(),creating?"COMMENT_CREATED":"COMMENT_EDITED",id);return id;
    }
    private void reason(Map<String,Set<String>> recipients,String user,String reason){if(user!=null)recipients.computeIfAbsent(user,k->new LinkedHashSet<>()).add(reason);}
    @Transactional public void delete(WorkActor actor,long project,long task,long id,long version){
        var access=permissions.requireWritable(project,actor);permissions.requireInternalRole(access);var rows=db.queryForList("SELECT * FROM task_comments WHERE id=? AND project_id=? AND task_id=? FOR UPDATE",id,project,task);if(rows.isEmpty())throw conflict("Bình luận không tồn tại.");var row=rows.getFirst();
        if(!actor.userId().equals(row.get("author_user_id"))&&!access.role().canManage())throw new WorkException(HttpStatus.FORBIDDEN,"COMMENT_FORBIDDEN","Bạn không có quyền xóa bình luận.");
        if(row.get("deleted_at")!=null)return;if(((Number)row.get("version")).longValue()!=version)throw conflict("Bình luận đã thay đổi. Vui lòng tải lại.");
        for(long file:db.queryForList("SELECT stored_file_id FROM comment_attachments WHERE comment_id=?",Long.class,id))files.remove(project,file,actor.userId());
        db.update("DELETE FROM comment_attachments WHERE comment_id=?",id);db.update("UPDATE comment_mentions SET removed_at=? WHERE comment_id=? AND removed_at IS NULL",Timestamp.from(clock.instant()),id);
        db.update("UPDATE task_comments SET body=NULL,image_count=0,deleted_at=?,deleted_by=?,version=version+1 WHERE id=?",Timestamp.from(clock.instant()),actor.userId(),id);audit(project,task,actor.userId(),"COMMENT_DELETED",id);
    }
    private void audit(long project,long task,String actor,String action,long id){db.update("INSERT INTO activity_logs(project_id,task_id,actor_user_id,action,entity_type,entity_id) VALUES(?,?,?,?,'COMMENT',?)",project,task,actor,action,String.valueOf(id));}
}

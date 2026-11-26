package vn.tasknest.workservice.application.workspace;

import java.time.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;
import vn.tasknest.workservice.application.WorkException;
import vn.tasknest.workservice.application.security.*;

@Service
public class TaskOrganizationService {
    private final JdbcTemplate db; private final ProjectPermissionService permissions;private final Clock clock;
    private final JsonMapper json=new JsonMapper();
    public TaskOrganizationService(JdbcTemplate db,ProjectPermissionService permissions,Clock clock){this.db=db;this.permissions=permissions;this.clock=clock;}
    public record Item(String id,String title,boolean completed,String createdAt) {}
    public record Snapshot(long version,List<Item> checklist,List<String> tags,boolean canEdit) {}
    @Transactional(readOnly=true)
    public Snapshot read(WorkActor actor,long project,long task){var access=permissions.requireInternalMember(project,actor);var row=task(project,task,false);boolean edit=access.project().getStatus()==vn.tasknest.workservice.domain.project.ProjectStatus.ACTIVE && access.role()!=vn.tasknest.workservice.domain.project.ProjectRole.CUSTOMER && permissions.developmentState(project).equals("ACTIVE") && (access.role().canManage()||actor.userId().equals(row.get("assignee_user_id")));return snapshot(task,edit);}
    @Transactional
    public Snapshot save(WorkActor actor,long project,long task,long version,List<Item> checklist,List<String> tags){
        var access=permissions.requireDeveloper(project,actor);var taskRow=task(project,task,true);
        if(!access.role().canManage()&&!actor.userId().equals(taskRow.get("assignee_user_id")))throw failure(HttpStatus.FORBIDDEN,"Chỉ người phụ trách và quản lý được cập nhật checklist, nhãn.");
        var current=snapshot(task,true);if(current.version()!=version)throw failure(HttpStatus.CONFLICT,"Checklist hoặc nhãn đã được người khác cập nhật. Tải lại trước khi lưu.");
        if(checklist==null||checklist.size()>100||tags==null||tags.size()>5||new HashSet<>(tags).size()!=tags.size()||!Set.of("BUG","BACKEND","FRONTEND","FEATURE","HOTFIX").containsAll(tags))throw failure(HttpStatus.BAD_REQUEST,"Checklist tối đa 100 bước và nhãn phải thuộc danh mục hợp lệ.");
        var ids=new HashSet<String>();var old=new HashMap<String,String>();current.checklist().forEach(item->old.put(item.id(),item.createdAt()));var normalized=new ArrayList<Item>();
        for(var item:checklist){if(item==null||item.id()==null||item.title()==null||item.title().strip().isEmpty()||item.title().strip().length()>200)throw failure(HttpStatus.BAD_REQUEST,"Mỗi bước cần tiêu đề từ 1 đến 200 ký tự.");try{if(!UUID.fromString(item.id()).toString().equals(item.id())||!ids.add(item.id()))throw new IllegalArgumentException();}catch(IllegalArgumentException ex){throw failure(HttpStatus.BAD_REQUEST,"Mã bước không hợp lệ hoặc trùng lặp.");}normalized.add(new Item(item.id(),item.title().strip(),item.completed(),old.getOrDefault(item.id(),clock.instant().toString())));}
        db.update("INSERT INTO task_organization(task_id,checklist,tags,version,updated_by) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE checklist=VALUES(checklist),tags=VALUES(tags),version=VALUES(version),updated_by=VALUES(updated_by),updated_at=UTC_TIMESTAMP(6)",task,json.writeValueAsString(normalized),json.writeValueAsString(tags),version+1,actor.userId());
        db.update("INSERT INTO activity_logs(project_id,task_id,actor_user_id,action,entity_type,entity_id) VALUES(?,?,?,'TASK_ORGANIZATION_UPDATED','TASK',?)",project,task,actor.userId(),String.valueOf(task));
        return new Snapshot(version+1,normalized,List.copyOf(tags),true);
    }
    private Snapshot snapshot(long task,boolean editable){var rows=db.queryForList("SELECT checklist,tags,version FROM task_organization WHERE task_id=?",task);if(rows.isEmpty())return new Snapshot(0,List.of(),List.of(),editable);var row=rows.getFirst();return new Snapshot(((Number)row.get("version")).longValue(),List.of(json.readValue(row.get("checklist").toString(),Item[].class)),List.of(json.readValue(row.get("tags").toString(),String[].class)),editable);}
    private Map<String,Object> task(long project,long task,boolean lock){var rows=db.queryForList("SELECT assignee_user_id FROM tasks WHERE project_id=? AND id=?"+(lock?" FOR UPDATE":""),project,task);if(rows.isEmpty())throw failure(HttpStatus.NOT_FOUND,"Không tìm thấy nhiệm vụ trong dự án.");return rows.getFirst();}
    private WorkException failure(HttpStatus status,String message){return new WorkException(status,"TASK_ORGANIZATION",message);}
}

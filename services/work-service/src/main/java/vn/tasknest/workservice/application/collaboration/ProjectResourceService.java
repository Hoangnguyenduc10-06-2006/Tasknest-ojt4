package vn.tasknest.workservice.application.collaboration;
import java.net.URI;
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
import vn.tasknest.workservice.domain.project.ProjectRole;
@Service
public class ProjectResourceService {
    private final JdbcTemplate db;private final ProjectPermissionService permissions;private final ProjectFileService files;private final Clock clock;private final JsonMapper json=new JsonMapper();
    public ProjectResourceService(JdbcTemplate db,ProjectPermissionService permissions,ProjectFileService files,Clock clock){this.db=db;this.permissions=permissions;this.files=files;this.clock=clock;}
    public record Input(String requestId,Long version,String title,String description,Long fileId,String url){}
    private WorkException conflict(String text){return new WorkException(HttpStatus.CONFLICT,"RESOURCE_CONFLICT",text);}
    private String url(String text){if(text==null||text.isBlank())return null;try{URI uri=URI.create(text.strip());if(text.length()>2048||!Set.of("http","https").contains(uri.getScheme())||uri.getHost()==null||uri.getRawUserInfo()!=null||text.chars().anyMatch(Character::isWhitespace))throw conflict("Chỉ nhận URL http/https tuyệt đối, không chứa thông tin đăng nhập.");return uri.toASCIIString();}catch(IllegalArgumentException ex){throw conflict("Liên kết không hợp lệ.");}}
    public Map<String,Object> list(WorkActor actor,long project,String search,String type,int page,int size){var access=permissions.requireInternalMember(project,actor);if(page<0||page>100000||!List.of(10,20,50).contains(size)||!Set.of("ALL","FILE","LINK").contains(type))throw conflict("Bộ lọc không hợp lệ.");
        String condition="r.project_id=? AND r.deleted_at IS NULL AND (?='ALL' OR r.resource_type=?) AND LOCATE(LOWER(?),LOWER(r.title))>0";
        var rows=db.queryForList("SELECT r.id,r.resource_type,r.title,r.description,r.link_url,r.stored_file_id,r.created_by,r.created_at,r.updated_at,r.version,f.original_name,f.mime_type,f.size_bytes FROM project_resources r LEFT JOIN stored_files f ON f.id=r.stored_file_id WHERE "+condition+" ORDER BY r.created_at DESC,r.id DESC LIMIT ? OFFSET ?",project,type,type,search.strip(),size,page*size);
        vn.tasknest.workservice.api.ApiValues.utc(rows);
        return Map.of("items",rows,"total",db.queryForObject("SELECT COUNT(*) FROM project_resources r WHERE "+condition,Long.class,project,type,type,search.strip()),"page",page,"size",size,"usage",files.usage(actor,project),"readOnly",access.project().getStatus()!=vn.tasknest.workservice.domain.project.ProjectStatus.ACTIVE || "COMPLETED".equals(permissions.developmentState(project)));
    }
    @Transactional public long save(WorkActor actor,long project,Long id,Input input){var access=permissions.requireWritable(project,actor);permissions.requireInternalRole(access);
        String title=input.title()==null?"":input.title().strip(),description=input.description()==null?"":input.description().strip(),link=url(input.url());
        if(title.isBlank()||title.length()>150||description.length()>500)throw conflict("Tên cần 1–150 ký tự, mô tả tối đa 500 ký tự.");
        var now=Timestamp.from(clock.instant());
        if(id==null){UUID.fromString(input.requestId());if((input.fileId()==null)==(link==null))throw conflict("Chọn một tệp hoặc một liên kết.");byte[] hash=ProjectFileService.hash(json.writeValueAsBytes(input));
            var prior=db.queryForList("SELECT id,request_hash FROM project_resources WHERE project_id=? AND created_by=? AND creation_request_id=?",project,actor.userId(),input.requestId());if(!prior.isEmpty()){if(!java.security.MessageDigest.isEqual(hash,(byte[])prior.getFirst().get("request_hash")))throw conflict("Mã yêu cầu đã dùng cho mục khác.");return ((Number)prior.getFirst().get("id")).longValue();}
            if(input.fileId()!=null)files.attach(actor,project,input.fileId(),"PROJECT_DOCUMENT");
            var key=new GeneratedKeyHolder();db.update(connection->{var statement=connection.prepareStatement("INSERT INTO project_resources(project_id,resource_type,title,description,stored_file_id,file_kind,link_url,created_by,creation_request_id,request_hash,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",java.sql.Statement.RETURN_GENERATED_KEYS);Object[] values={project,input.fileId()==null?"LINK":"FILE",title,description,input.fileId(),input.fileId()==null?null:"PROJECT_DOCUMENT",link,actor.userId(),input.requestId(),hash,now,now};for(int i=0;i<values.length;i++)statement.setObject(i+1,values[i]);return statement;},key);id=Objects.requireNonNull(key.getKey()).longValue();
        }else{var row=editable(actor,project,id,access.role());if(input.version()==null||((Number)row.get("version")).longValue()!=input.version())throw conflict("Mục đã thay đổi. Vui lòng tải lại.");
            Long oldFile=row.get("stored_file_id")==null?null:((Number)row.get("stored_file_id")).longValue();if(!Objects.equals(oldFile,input.fileId())||(oldFile!=null&&link!=null)||(oldFile==null&&link==null))throw conflict("Không thay nội dung tệp. Hãy xóa mục và thêm tệp mới.");
            db.update("UPDATE project_resources SET title=?,description=?,link_url=?,updated_at=?,version=version+1 WHERE id=?",title,description,link,now,id);
        }audit(project,actor.userId(),"RESOURCE_SAVED",id);return id;
    }
    private Map<String,Object> editable(WorkActor actor,long project,long id,ProjectRole role){var rows=db.queryForList("SELECT * FROM project_resources WHERE id=? AND project_id=? AND deleted_at IS NULL FOR UPDATE",id,project);if(rows.isEmpty())throw conflict("Mục không tồn tại hoặc đã bị xóa.");var row=rows.getFirst();if(!role.canManage()&&!actor.userId().equals(row.get("created_by")))throw new WorkException(HttpStatus.FORBIDDEN,"RESOURCE_FORBIDDEN","Chỉ được sửa/xóa mục của mình.");return row;}
    @Transactional public void delete(WorkActor actor,long project,long id,long version){var access=permissions.requireWritable(project,actor);permissions.requireInternalRole(access);var row=editable(actor,project,id,access.role());if(((Number)row.get("version")).longValue()!=version)throw conflict("Mục đã thay đổi. Vui lòng tải lại.");if(row.get("stored_file_id")!=null)files.remove(project,((Number)row.get("stored_file_id")).longValue(),actor.userId());db.update("UPDATE project_resources SET deleted_at=?,deleted_by=?,version=version+1 WHERE id=?",Timestamp.from(clock.instant()),actor.userId(),id);audit(project,actor.userId(),"RESOURCE_DELETED",id);}
    private void audit(long project,String actor,String action,long id){db.update("INSERT INTO activity_logs(project_id,actor_user_id,action,entity_type,entity_id) VALUES(?,?,?,'RESOURCE',?)",project,actor,action,String.valueOf(id));}
}

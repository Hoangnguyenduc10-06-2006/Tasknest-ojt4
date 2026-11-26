package vn.tasknest.workservice.application.collaboration;

import java.io.*;
import java.nio.file.*;
import java.security.MessageDigest;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.*;
import vn.tasknest.workservice.application.WorkException;
import vn.tasknest.workservice.application.security.*;

@Service
public class ProjectFileService {
    private final JdbcTemplate db;
    private final ProjectPermissionService permissions;
    private final Clock clock;
    private final Path root;
    public ProjectFileService(JdbcTemplate db,ProjectPermissionService permissions,Clock clock,@Value("${tasknest.files.root:local/work-files}") String root) throws IOException {this.db=db;this.permissions=permissions;this.clock=clock;this.root=Path.of(root).toAbsolutePath().normalize();Files.createDirectories(this.root);}
    public record StoredFile(long id,String originalName,String mimeType,long sizeBytes){}
    public record Download(String name,String mime,byte[] bytes,boolean image){}
    private WorkException conflict(String message){return new WorkException(HttpStatus.CONFLICT,"FILE_CONFLICT",message);}
    private WorkException missing(){return new WorkException(HttpStatus.NOT_FOUND,"FILE_NOT_FOUND","Không tìm thấy tệp hoặc không còn quyền truy cập.");}
    public static byte[] hash(byte[] input){try{return MessageDigest.getInstance("SHA-256").digest(input);}catch(Exception ex){throw new IllegalStateException(ex);}}
    public Map<String,Object> usage(WorkActor actor,long project){permissions.requireInternalMember(project,actor);var rows=db.queryForList("SELECT used_bytes,limit_bytes FROM project_storage_usage WHERE project_id=?",project);return rows.isEmpty()?Map.of("used_bytes",0,"limit_bytes",524288000):rows.getFirst();}
    @Transactional public StoredFile upload(WorkActor actor,long project,String kind,String requestId,String name,byte[] bytes){
        permissions.requireInternalRole(permissions.requireWritable(project,actor));
        if(!Set.of("COMMENT_IMAGE","PROJECT_DOCUMENT").contains(kind))throw conflict("Loại tệp không hợp lệ.");
        UUID.fromString(requestId);
        String mime=FileValidation.validate(name,bytes,kind.equals("COMMENT_IMAGE"));byte[] contentHash=hash(bytes);
        byte[] requestHash=hash((kind+"/"+name+"/"+HexFormat.of().formatHex(contentHash)).getBytes(java.nio.charset.StandardCharsets.UTF_8));
        var previous=db.queryForList("SELECT * FROM stored_files WHERE project_id=? AND uploaded_by=? AND upload_request_id=?",project,actor.userId(),requestId);
        if(!previous.isEmpty()){var row=previous.getFirst();if(!MessageDigest.isEqual((byte[])row.get("request_hash"),requestHash)||!"READY".equals(row.get("status")))throw conflict("Mã yêu cầu đã được dùng cho tệp khác hoặc tệp đã bị xóa.");return metadata(row);}
        db.update("INSERT INTO project_storage_usage(project_id) VALUES(?) ON DUPLICATE KEY UPDATE project_id=VALUES(project_id)",project);
        if(db.update("UPDATE project_storage_usage SET used_bytes=used_bytes+?,version=version+1 WHERE project_id=? AND used_bytes+reserved_bytes+?<=limit_bytes",bytes.length,project,bytes.length)!=1)throw conflict("Dự án đã đạt giới hạn lưu trữ 500 MiB.");
        String key=UUID.randomUUID().toString();Path target=root.resolve(key);
        try{Files.write(target,bytes,StandardOpenOption.CREATE_NEW);}catch(IOException ex){throw new WorkException(HttpStatus.SERVICE_UNAVAILABLE,"STORAGE_UNAVAILABLE","Không thể lưu tệp. Vui lòng thử lại.");}
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization(){@Override public void afterCompletion(int status){if(status!=STATUS_COMMITTED)try{Files.deleteIfExists(target);}catch(IOException ignored){/* Scheduled orphan cleanup retries. */}}});
        var now=Timestamp.from(clock.instant());
        db.update("INSERT INTO stored_files(project_id,uploaded_by,upload_request_id,request_hash,storage_key,original_name,file_kind,mime_type,size_bytes,content_sha256,status,created_at,temporary_expires_at,ready_at) VALUES(?,?,?,?,?,?,?,?,?,?,'READY',?,DATE_ADD(?,INTERVAL 24 HOUR),?)",project,actor.userId(),requestId,requestHash,key,name,kind,mime,bytes.length,contentHash,now,now,now);
        return metadata(db.queryForMap("SELECT * FROM stored_files WHERE storage_key=?",key));
    }
    private Instant instant(Object value){return value instanceof Timestamp timestamp?timestamp.toInstant():((LocalDateTime)value).toInstant(ZoneOffset.UTC);}
    private StoredFile metadata(Map<String,Object> row){return new StoredFile(((Number)row.get("id")).longValue(),(String)row.get("original_name"),(String)row.get("mime_type"),((Number)row.get("size_bytes")).longValue());}
    public void attach(WorkActor actor,long project,long file,String kind){
        var rows=db.queryForList("SELECT * FROM stored_files WHERE id=? AND project_id=? FOR UPDATE",file,project);
        if(rows.isEmpty())throw missing();var row=rows.getFirst();
        if(!actor.userId().equals(row.get("uploaded_by"))||!kind.equals(row.get("file_kind"))||!"READY".equals(row.get("status"))||row.get("attached_at")!=null||!instant(row.get("temporary_expires_at")).isAfter(clock.instant()))throw conflict("Tệp không thể đính kèm. Hãy tải lại tệp của bạn.");
        db.update("UPDATE stored_files SET attached_at=?,version=version+1 WHERE id=?",Timestamp.from(clock.instant()),file);
    }
    public void remove(long project,long file,String actor){
        var rows=db.queryForList("SELECT * FROM stored_files WHERE id=? AND project_id=? FOR UPDATE",file,project);
        if(rows.isEmpty()||!"READY".equals(rows.getFirst().get("status")))return;
        var now=Timestamp.from(clock.instant());
        db.update("UPDATE stored_files SET status='DELETE_PENDING',deleted_at=?,deleted_by=?,purge_after=DATE_ADD(?,INTERVAL 24 HOUR),version=version+1 WHERE id=?",now,actor,now,file);
        db.update("UPDATE project_storage_usage SET used_bytes=used_bytes-?,version=version+1 WHERE project_id=?",rows.getFirst().get("size_bytes"),project);
    }
    @Transactional public void discard(WorkActor actor,long project,long file){permissions.requireInternalRole(permissions.requireWritable(project,actor));var row=db.queryForList("SELECT uploaded_by,attached_at FROM stored_files WHERE id=? AND project_id=?",file,project);if(row.isEmpty()||!actor.userId().equals(row.getFirst().get("uploaded_by"))||row.getFirst().get("attached_at")!=null)throw missing();remove(project,file,actor.userId());}
    public Download download(WorkActor actor,long project,long file){
        permissions.requireInternalMember(project,actor);var rows=db.queryForList("SELECT * FROM stored_files WHERE project_id=? AND id=? AND status='READY'",project,file);if(rows.isEmpty())throw missing();var row=rows.getFirst();
        if(row.get("attached_at")==null&&!actor.userId().equals(row.get("uploaded_by")))throw missing();
        try{return new Download((String)row.get("original_name"),(String)row.get("mime_type"),Files.readAllBytes(root.resolve((String)row.get("storage_key"))),"COMMENT_IMAGE".equals(row.get("file_kind")));}catch(IOException ex){throw missing();}
    }
    @Scheduled(fixedDelay=60000) @Transactional public void cleanup(){
        var rows=db.queryForList("SELECT project_id,id FROM stored_files WHERE (status='READY' AND attached_at IS NULL AND temporary_expires_at<=UTC_TIMESTAMP(6)) OR status='DELETE_PENDING' ORDER BY project_id,id LIMIT 100");
        for(var row:rows){long project=((Number)row.get("project_id")).longValue(),file=((Number)row.get("id")).longValue();db.queryForList("SELECT id FROM projects WHERE id=? FOR UPDATE",project);remove(project,file,null);
            var value=db.queryForMap("SELECT storage_key FROM stored_files WHERE id=?",file);
            try{Files.deleteIfExists(root.resolve((String)value.get("storage_key")));db.update("UPDATE stored_files SET status='DELETED',purged_at=? WHERE id=? AND status='DELETE_PENDING'",Timestamp.from(clock.instant()),file);}catch(IOException ignored){/* Retry next sweep. Access is already denied. */}
        }
        try(var paths=Files.list(root)){paths.filter(Files::isRegularFile).filter(path->{try{return Files.getLastModifiedTime(path).toInstant().plus(Duration.ofHours(24)).isBefore(clock.instant());}catch(IOException ex){return false;}}).limit(100).forEach(path->{if(db.queryForObject("SELECT COUNT(*) FROM stored_files WHERE storage_key=? AND status IN ('READY','UPLOADING')",Long.class,path.getFileName().toString())==0)try{Files.deleteIfExists(path);}catch(IOException ignored){/* Retry next sweep. */}});}catch(IOException ignored){/* Retry next sweep. */}
    }
}

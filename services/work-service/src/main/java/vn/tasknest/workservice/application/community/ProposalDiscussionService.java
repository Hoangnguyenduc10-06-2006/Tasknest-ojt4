package vn.tasknest.workservice.application.community;

import java.sql.Statement;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.tasknest.workservice.api.ApiValues;
import vn.tasknest.workservice.application.WorkException;
import vn.tasknest.workservice.application.security.*;
import vn.tasknest.workservice.infrastructure.identity.IdentityDirectoryClient;

@Service
public class ProposalDiscussionService {
    private final DiscoveryNotifications discovery;
    private final JdbcTemplate db;
    private final ProjectPermissionService permissions;
    private final IdentityDirectoryClient directory;
    public ProposalDiscussionService(JdbcTemplate db,ProjectPermissionService permissions,IdentityDirectoryClient directory,DiscoveryNotifications discovery){this.discovery=discovery; this.db=db;this.permissions=permissions;this.directory=directory;}

    @Transactional(readOnly=true)
    public Map<String,Object> messages(WorkActor actor,long request,long proposal,Long before) {
        var access=access(actor,request,proposal,false);
        if(before!=null&&before<1)throw invalid("Mốc tin nhắn không hợp lệ.");
        var items=rows("SELECT id,sender_user_id,sender_name,body,created_at FROM proposal_messages WHERE proposal_id=? AND (? IS NULL OR id<?) ORDER BY id DESC LIMIT 31",proposal,before,before);
        boolean hasMore=items.size()>30;
        if(hasMore)items.removeLast();
        Collections.reverse(items);
        String other=actor.userId().equals(access.get("customer_user_id"))?access.get("owner_user_id").toString():access.get("customer_user_id").toString();
        var result=new LinkedHashMap<String,Object>();
        result.put("items",items);
        result.put("nextBefore",hasMore?items.getFirst().get("id"):null);
        result.put("canSend",canSend(access));
        result.put("myReadId",readId(proposal,actor.userId()));
        result.put("otherReadId",readId(proposal,other));
        return result;
    }

    @Transactional
    public long send(WorkActor actor,long request,long proposal,String body,String clientId) {
        var access=access(actor,request,proposal,true);
        String text=body.strip();
        if(text.isEmpty())throw invalid("Nhập nội dung trao đổi trước khi gửi.");
        var previous=rows("SELECT id,body FROM proposal_messages WHERE proposal_id=? AND sender_user_id=? AND client_message_id=?",proposal,actor.userId(),clientId);
        if(!previous.isEmpty()) {
            if(!text.equals(previous.getFirst().get("body")))throw conflict("Mã gửi tin nhắn đã dùng cho nội dung khác.");
            return ((Number)previous.getFirst().get("id")).longValue();
        }
        if(!canSend(access))throw conflict("Trao đổi đã đóng. Sau khi chọn đội, tiếp tục làm việc trong không gian dự án.");
        String name=directory.names(Set.of(actor.userId())).get(actor.userId());
        if(name==null)throw conflict("Không thể đọc tên tài khoản. Vui lòng thử lại.");
        var key=new GeneratedKeyHolder();
        db.update(connection->{
            var statement=connection.prepareStatement("INSERT INTO proposal_messages(proposal_id,sender_user_id,sender_name,body,client_message_id) VALUES(?,?,?,?,?)",Statement.RETURN_GENERATED_KEYS);
            Object[] values={proposal,actor.userId(),name,text,clientId};
            for(int i=0;i<values.length;i++)statement.setObject(i+1,values[i]);
            return statement;
        },key);
        long message=Objects.requireNonNull(key.getKey()).longValue();
        String recipient=actor.userId().equals(access.get("customer_user_id"))?access.get("owner_user_id").toString():access.get("customer_user_id").toString();
        discovery.request(actor.userId(),request,recipient,"discovery.discussion.message",String.valueOf(message),"Có trao đổi mới về đề xuất","Cuộc trao đổi riêng của bạn có tin nhắn mới. Mở đề xuất để xem và trả lời.","/requests/"+request+"?proposal="+proposal+"&discussion=1");
        return message;
    }

    @Transactional
    public void read(WorkActor actor,long request,long proposal,long message) {
        access(actor,request,proposal,true);
        if(count("SELECT COUNT(*) FROM proposal_messages WHERE proposal_id=? AND id=?",proposal,message)!=1)throw invalid("Tin nhắn không thuộc cuộc trao đổi này.");
        db.update("""
            INSERT INTO proposal_message_reads(proposal_id,user_id,last_message_id) VALUES(?,?,?)
            ON DUPLICATE KEY UPDATE last_message_id=GREATEST(last_message_id,?),read_at=UTC_TIMESTAMP(6)
            """,proposal,actor.userId(),message,message);
    }
    private Map<String,Object> access(WorkActor actor,long request,long proposal,boolean lock) {
        permissions.requireVerified(actor);
        // Match the award/withdraw lock order: request, proposal. No team lock is needed.
        var requests=rows("SELECT customer_user_id,status FROM customer_project_requests WHERE id=?"+(lock?" FOR UPDATE":""),request);
        if(requests.isEmpty())throw missing();
        var proposals=rows("SELECT team_id,status FROM team_project_proposals WHERE request_id=? AND id=?"+(lock?" FOR UPDATE":""),request,proposal);
        if(proposals.isEmpty())throw missing();
        var owners=rows("SELECT owner_user_id FROM dev_teams WHERE id=?",proposals.getFirst().get("team_id"));
        if(owners.isEmpty())throw missing();
        String customer=requests.getFirst().get("customer_user_id").toString(),owner=owners.getFirst().get("owner_user_id").toString();
        if(!actor.userId().equals(customer)&&!actor.userId().equals(owner))throw missing();
        return Map.of("customer_user_id",customer,"owner_user_id",owner,"request_status",requests.getFirst().get("status"),"proposal_status",proposals.getFirst().get("status"));
    }
    private boolean canSend(Map<String,Object> access){return "OPEN".equals(access.get("request_status"))&&"SUBMITTED".equals(access.get("proposal_status"));}
    private long readId(long proposal,String user){return db.queryForObject("SELECT COALESCE(MAX(last_message_id),0) FROM proposal_message_reads WHERE proposal_id=? AND user_id=?",Long.class,proposal,user);}
    private long count(String sql,Object...args){return db.queryForObject(sql,Long.class,args);}
    private List<Map<String,Object>> rows(String sql,Object...args){return ApiValues.utc(db.queryForList(sql,args));}
    private WorkException missing(){return new WorkException(HttpStatus.NOT_FOUND,"DISCUSSION_NOT_FOUND","Không tìm thấy cuộc trao đổi.");}
    private WorkException invalid(String message){return new WorkException(HttpStatus.BAD_REQUEST,"INVALID_DISCUSSION",message);}
    private WorkException conflict(String message){return new WorkException(HttpStatus.CONFLICT,"DISCUSSION_CLOSED",message);}
}

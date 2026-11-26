package vn.tasknest.workservice.application.workspace;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.json.JsonMapper;
@Service
public class ActivityNotificationProjector {
    private final JdbcTemplate db;private final WorkNotificationService notifications;private final TransactionTemplate tx;private final JsonMapper json=new JsonMapper();
    public ActivityNotificationProjector(JdbcTemplate db,WorkNotificationService notifications,TransactionTemplate tx){this.db=db;this.notifications=notifications;this.tx=tx;}
    @Scheduled(fixedDelay=250) public void project(){
        var activities=db.queryForList("SELECT a.* FROM activity_logs a LEFT JOIN activity_notification_receipts r ON r.activity_id=a.id WHERE r.activity_id IS NULL AND a.action IN ('TASK_CREATED','TASK_UPDATED','TASK_SUBMITTED','TASK_APPROVED','TASK_REJECTED','TASK_REOPENED','TASK_CANCELLED','INVITATION_ACCEPTED','INVITATION_REJECTED','JOIN_REQUEST_CREATED','JOIN_REQUEST_ACCEPTED','JOIN_REQUEST_REJECTED','MEMBER_ROLE_CHANGED','MEMBER_REMOVED') ORDER BY a.id LIMIT 100");
        for(var activity:activities)tx.executeWithoutResult(status->{long project=((Number)activity.get("project_id")).longValue();db.queryForList("SELECT id FROM projects WHERE id=? FOR UPDATE",project);if(db.update("INSERT IGNORE INTO activity_notification_receipts(activity_id) VALUES(?)",activity.get("id"))==0)return;emit(activity,project);});
    }
    private void emit(Map<String,Object> activity,long project){
        String action=(String)activity.get("action"),actor=(String)activity.get("actor_user_id");Long task=activity.get("task_id")==null?null:((Number)activity.get("task_id")).longValue();
        var after=json.readTree(Objects.toString(activity.get("after_data"),"{}"));var before=json.readTree(Objects.toString(activity.get("before_data"),"{}"));
        if(task!=null){String assignee=after.path("assigneeId").asText();if(assignee.isBlank())assignee=db.queryForObject("SELECT assignee_user_id FROM tasks WHERE id=?",String.class,task);var recipients=new LinkedHashSet<String>();String title;
            switch(action){
                case "TASK_SUBMITTED"->{recipients.addAll(notifications.managers(project));title="Có nhiệm vụ đang chờ bạn duyệt";}
                case "TASK_CREATED"->{recipients.add(assignee);title="Bạn được giao nhiệm vụ";}
                case "TASK_UPDATED"->{String old=before.path("assignee_user_id").asText();if(old.equals(assignee))return;recipients.add(assignee);if(!old.isBlank())recipients.add(old);title="Phân công nhiệm vụ đã thay đổi";}
                case "TASK_APPROVED"->{recipients.add(assignee);title="Nhiệm vụ đã được duyệt hoàn thành";}
                case "TASK_REJECTED"->{recipients.add(assignee);title="Nhiệm vụ cần thực hiện lại";}
                case "TASK_REOPENED"->{recipients.add(assignee);title="Nhiệm vụ đã được mở lại";}
                default->{recipients.add(assignee);title="Nhiệm vụ đã bị hủy";}
            }notifications.task(project,task,actor,recipients,"work."+action.toLowerCase(Locale.ROOT),title);return;
        }
        if(action.equals("JOIN_REQUEST_CREATED")){for(String user:notifications.managers(project))notifications.send(project,null,actor,user,"work.join-request.created","Có yêu cầu tham gia dự án","Mở mục Thành viên để xem xét yêu cầu tham gia.",true,List.of(),false);return;}
        String recipient,title;boolean accountOnly=false;
        if(action.startsWith("INVITATION_")){recipient=after.path("invitedBy").asText();title=action.equals("INVITATION_ACCEPTED")?"Lời mời đã được chấp nhận":"Lời mời đã bị từ chối";}
        else if(action.startsWith("JOIN_REQUEST_")){recipient=db.queryForObject("SELECT user_id FROM project_join_requests WHERE id=?",String.class,activity.get("entity_id"));title=action.endsWith("ACCEPTED")?"Yêu cầu tham gia đã được duyệt":"Yêu cầu tham gia đã bị từ chối";accountOnly=true;}
        else {recipient=activity.get("entity_id").toString();title=action.equals("MEMBER_REMOVED")?"Bạn đã được xóa khỏi một dự án":"Vai trò dự án của bạn đã thay đổi";accountOnly=action.equals("MEMBER_REMOVED");}
        if(recipient!=null&&!recipient.isBlank())notifications.send(project,null,actor,recipient,"work."+action.toLowerCase(Locale.ROOT),title,accountOnly?"Quyền tham gia của bạn đã thay đổi. Mở Lời mời và yêu cầu để xem trạng thái.":"Mở dự án để xem thông tin hiện tại.",true,List.of(),accountOnly);
    }
}

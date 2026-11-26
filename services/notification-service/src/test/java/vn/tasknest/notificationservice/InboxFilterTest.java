package vn.tasknest.notificationservice;
import java.util.*;
import java.sql.Timestamp;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import vn.tasknest.notificationservice.api.InboxController;
import vn.tasknest.notificationservice.application.mail.DeliveryAccess;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;
class InboxFilterTest {
    @Test void filtersAcrossAllPagesBeforePaginatingAndPreservesUnreadBadge() {
        var db=mock(JdbcTemplate.class);var access=mock(DeliveryAccess.class);
        List<Map<String,Object>> rows=new ArrayList<>();
        for(int index=1;index<=15;index++) {
            var row=new HashMap<String,Object>();row.put("id",(long)index);row.put("event_type",index<=12?"task.assigned":"discovery.application.created");
            row.put("title","Thông báo");row.put("body","");row.put("created_at",Timestamp.from(Instant.now()));row.put("access_scope","ACCOUNT_ONLY");
            if(index==15)row.put("read_at",Timestamp.from(Instant.now()));rows.add(row);
        }
        when(db.queryForList(anyString(),eq("user"))).thenReturn(rows);
        var controller=new InboxController(db,access);
        var page=controller.list("user",0,10,"discovery",false);
        assertEquals(3,page.total());assertEquals(3,page.items().size());assertEquals(14,page.unreadCount());assertEquals(2,page.matchingUnreadCount());
        assertEquals(2,controller.list("user",0,10,"discovery",true).total());
        verifyNoInteractions(access);
    }
}

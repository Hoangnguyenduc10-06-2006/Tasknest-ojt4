package vn.tasknest.workservice.application.security;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
@Service
public class WorkRequestBudget {
    private final JdbcTemplate db;public WorkRequestBudget(JdbcTemplate db){this.db=db;}
    @Transactional(propagation=Propagation.REQUIRES_NEW) public boolean consume(String user,String action,int maximum){long window=System.currentTimeMillis()/60000;db.update("INSERT INTO work_request_limits(user_id,action,window_start,requests) VALUES(?,?,?,1) ON DUPLICATE KEY UPDATE requests=LEAST(requests+1,2147483647)",user,action,window);return db.queryForObject("SELECT requests FROM work_request_limits WHERE user_id=? AND action=? AND window_start=?",Integer.class,user,action,window)<=maximum;}
    @org.springframework.scheduling.annotation.Scheduled(fixedDelay=3600000) public void cleanup(){db.update("DELETE FROM work_request_limits WHERE window_start<?",System.currentTimeMillis()/60000-1440);}
}

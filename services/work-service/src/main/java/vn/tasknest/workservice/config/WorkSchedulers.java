package vn.tasknest.workservice.config;
import org.springframework.context.annotation.*;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
@Configuration
public class WorkSchedulers {
    @Bean public ThreadPoolTaskScheduler taskScheduler(){var scheduler=new ThreadPoolTaskScheduler();scheduler.setPoolSize(4);scheduler.setThreadNamePrefix("work-background-");return scheduler;}
    @Bean public ThreadPoolTaskScheduler realtimeScheduler(){var scheduler=new ThreadPoolTaskScheduler();scheduler.setPoolSize(1);scheduler.setThreadNamePrefix("work-realtime-");return scheduler;}
}

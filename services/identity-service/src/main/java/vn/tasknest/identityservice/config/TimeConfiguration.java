package vn.tasknest.identityservice.config;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class TimeConfiguration {

    /** Đồng hồ UTC dùng chung; test có thể thay bằng Clock cố định. */
    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }
}

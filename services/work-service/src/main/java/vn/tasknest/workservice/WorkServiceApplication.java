package vn.tasknest.workservice;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@org.springframework.scheduling.annotation.EnableScheduling
@SpringBootApplication

public class WorkServiceApplication {
    public static void main(String[] args) { SpringApplication.run(WorkServiceApplication.class, args); }
}

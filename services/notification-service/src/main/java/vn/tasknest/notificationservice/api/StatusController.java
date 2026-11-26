package vn.tasknest.notificationservice.api;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
@RestController
public class StatusController {
    @GetMapping("/api/notifications/status")
    public Map<String, String> status() {
        return Map.of("service", "notification-service", "stage", "scaffold");
    }
}

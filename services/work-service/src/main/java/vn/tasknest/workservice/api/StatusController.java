package vn.tasknest.workservice.api;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
@RestController
public class StatusController {
    @GetMapping("/api/work/status")
    public Map<String, String> status() {
        return Map.of("service", "work-service", "stage", "scaffold");
    }
}

package vn.tasknest.identityservice.api.controller;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
@RestController
public class StatusController {
    @GetMapping("/api/identity/status")
    public Map<String, String> status() {
        return Map.of("service", "identity-service", "stage", "scaffold");
    }
}

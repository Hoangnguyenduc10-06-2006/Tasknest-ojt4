package vn.tasknest.aiservice.api;

import java.security.Principal;
import java.util.Map;
import org.springframework.web.bind.annotation.*;
import vn.tasknest.aiservice.application.DashboardBriefService;

@RestController
@RequestMapping("/api/ai/dashboard")
public class DashboardBriefController {
    private final DashboardBriefService service;
    public DashboardBriefController(DashboardBriefService service) { this.service = service; }
    @PostMapping public Map<String,Object> brief(Principal user, @RequestHeader("Authorization") String authorization) {
        return Map.of("success", true, "data", service.brief(authorization.substring(7), user.getName()));
    }
}

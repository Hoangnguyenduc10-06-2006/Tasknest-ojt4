package vn.tasknest.aiservice.api;

import java.security.Principal;
import java.util.Map;
import org.springframework.web.bind.annotation.*;
import vn.tasknest.aiservice.application.TaskBriefService;

@RestController
@RequestMapping("/api/ai/tasks")
public class TaskBriefController {
    private final TaskBriefService service;
    public TaskBriefController(TaskBriefService service) { this.service = service; }
    @PostMapping("/{taskId:[1-9][0-9]*}") public Map<String,Object> brief(Principal user, @RequestHeader("Authorization") String authorization, @PathVariable long taskId) {
        return Map.of("success",true,"data",service.brief(authorization.substring(7),user.getName(),taskId));
    }
}

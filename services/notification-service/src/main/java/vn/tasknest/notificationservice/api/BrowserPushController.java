package vn.tasknest.notificationservice.api;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import vn.tasknest.notificationservice.application.push.BrowserPush;

@RestController
@RequestMapping("/api/notifications/inbox/push")
public class BrowserPushController {
    private final BrowserPush push;

    public BrowserPushController(BrowserPush push) {
        this.push = push;
    }

    public record Endpoint(String endpoint) {}

    @PostMapping("/settings")
    public BrowserPush.Settings settings(@AuthenticationPrincipal String user, @RequestBody Endpoint input) {
        try {
            return push.settings(user, input.endpoint());
        } catch (IllegalArgumentException invalid) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        }
    }

    @PutMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void subscribe(@AuthenticationPrincipal String user, @RequestBody BrowserPush.Device input) {
        if (!push.enabled()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE);
        if (input.preferences() == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        try {
            push.save(user, input);
        } catch (IllegalArgumentException invalid) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        }
    }

    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unsubscribe(@AuthenticationPrincipal String user, @RequestBody Endpoint input) {
        try {
            push.remove(user, input.endpoint());
        } catch (IllegalArgumentException invalid) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        }
    }
}

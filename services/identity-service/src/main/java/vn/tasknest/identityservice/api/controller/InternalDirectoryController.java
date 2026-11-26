package vn.tasknest.identityservice.api.controller;

import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import vn.tasknest.identityservice.repository.UserRepository;

/** Service-to-service only: Gateway does not route /internal. No email, credentials or private bio. */
@RestController
public class InternalDirectoryController {
    private final UserRepository users;
    public InternalDirectoryController(UserRepository users) { this.users = users; }
    @GetMapping("/internal/identity/profiles")
    public List<DisplayUser> lookup(@RequestParam String ids) {
        List<String> batch = Arrays.asList(ids.split(",",-1));
        if (batch.size()>100) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        for (String id : batch) {
            try { if (!UUID.fromString(id).toString().equals(id)) throw new IllegalArgumentException(); }
            catch (IllegalArgumentException ex) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST); }
        }
        return users.findAllById(batch).stream().map(user -> new DisplayUser(user.getId(),user.getFullName())).toList();
    }
    @GetMapping("/internal/identity/invitation-recipient")
    public InvitationRecipient recipient(@RequestParam String email) {
        var user = users.findByEmail(email.strip().toLowerCase(Locale.ROOT))
            .filter(u -> u.isEmailVerified()).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        return new InvitationRecipient(user.getId(), user.getEmail());
    }
    @GetMapping("/internal/identity/invitation-users")
    public List<InvitationUser> invitationUsers(@RequestParam String search) {
        String query = search.strip();
        if (query.length() < 2 || query.length() > 100) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        return users.findInvitationCandidates(query, org.springframework.data.domain.PageRequest.of(0, 20)).stream()
            .map(user -> new InvitationUser(user.getId(), user.getFullName())).toList();
    }
    @GetMapping("/internal/identity/invitation-users/{id}")
    public InvitationUser invitationUser(@PathVariable String id) {
        try { if (!UUID.fromString(id).toString().equals(id)) throw new IllegalArgumentException(); }
        catch (IllegalArgumentException ex) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST); }
        var user = users.findById(id).filter(u -> u.isEmailVerified())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        return new InvitationUser(user.getId(), user.getFullName());
    }
    public record InvitationUser(String id, String fullName) {}
    public record InvitationRecipient(String id, String email) {}
    public record DisplayUser(String id, String fullName) {}
}

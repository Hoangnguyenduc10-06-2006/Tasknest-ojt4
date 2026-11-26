package vn.tasknest.identityservice.api.controller;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import vn.tasknest.identityservice.repository.UserRepository;
/** Private network plus service Basic credentials; never routed by Gateway. */
@RestController
public class MailContactController {
    private final UserRepository users;public MailContactController(UserRepository users){this.users=users;}
    @GetMapping("/internal/identity/mail-contact/{id}") public Map<String,String> contact(@PathVariable String id){UUID.fromString(id);var user=users.findById(id).filter(u->u.isEmailVerified()).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND));return Map.of("email",user.getEmail());}
}

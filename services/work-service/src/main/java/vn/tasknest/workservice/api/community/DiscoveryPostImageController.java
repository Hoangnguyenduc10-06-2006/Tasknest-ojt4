package vn.tasknest.workservice.api.community;

import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vn.tasknest.workservice.application.community.DiscoveryPostImage;
import vn.tasknest.workservice.application.security.WorkActor;

@RestController
@RequestMapping("/api/work/community/post-images")
public class DiscoveryPostImageController {
    private final JdbcTemplate db;

    public DiscoveryPostImageController(JdbcTemplate db) {
        this.db = db;
    }

    @GetMapping("/{kind}/{post}/{position}")
    public ResponseEntity<byte[]> get(@PathVariable DiscoveryPostImage.Kind kind, @PathVariable long post, @PathVariable int position,
                                      @AuthenticationPrincipal WorkActor actor) {
        return DiscoveryPostImage.read(db,kind,post,position,actor == null ? null : actor.userId());
    }
}

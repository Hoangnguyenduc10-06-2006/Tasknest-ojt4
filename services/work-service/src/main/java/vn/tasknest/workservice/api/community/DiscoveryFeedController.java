package vn.tasknest.workservice.api.community;

import java.util.ArrayList;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import vn.tasknest.workservice.application.security.WorkActor;
import vn.tasknest.workservice.application.security.ProjectPermissionService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import vn.tasknest.workservice.api.ApiValues;
import vn.tasknest.workservice.api.WorkResponse;
import vn.tasknest.workservice.application.WorkException;

@RestController
@RequestMapping("/api/work/community/feed")
public class DiscoveryFeedController {
    private static final String POSTS = """
        FROM (
            SELECT r.id, 'REQUEST' kind, r.title, r.description, r.skills,
                   r.customer_name author, NULL team_id, r.updated_at published_at,r.reference_url,
                   (SELECT COUNT(*) FROM request_post_images i WHERE i.post_id=r.id) image_count
            FROM customer_project_requests r
            WHERE r.status='OPEN' AND r.desired_delivery >= UTC_DATE()
            UNION ALL
            SELECT o.id, 'OPENING', o.title, o.description, o.skills,
                   t.name, t.id, o.created_at,o.reference_url,
                   (SELECT COUNT(*) FROM opening_post_images i WHERE i.post_id=o.id)
            FROM team_openings o JOIN dev_teams t ON t.id=o.team_id
            WHERE o.status='OPEN' AND o.closes_on >= UTC_DATE()
              AND (SELECT COUNT(*) FROM team_applications a
                   WHERE a.opening_id=o.id AND a.status='ACCEPTED') < o.slots
        ) posts
        WHERE LOCATE(LOWER(?), LOWER(CONCAT(title,' ',description,' ',skills,' ',author))) > 0
        """;
    private final JdbcTemplate db;
    private final ProjectPermissionService permissions;

    public DiscoveryFeedController(JdbcTemplate db, ProjectPermissionService permissions) {
        this.db = db;
        this.permissions = permissions;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public WorkResponse<Map<String,Object>> list(
            @RequestParam(defaultValue = "") String search,
            @RequestParam(defaultValue = "") String skill,
            @RequestParam(defaultValue = "ALL") String kind,
            @RequestParam(defaultValue = "0") int page) {
        return feed(search, skill, kind, page, null);
    }

    @GetMapping("/saved")
    @Transactional(readOnly = true)
    public WorkResponse<Map<String,Object>> saved(
            @AuthenticationPrincipal WorkActor actor,
            @RequestParam(defaultValue = "") String search,
            @RequestParam(defaultValue = "") String skill,
            @RequestParam(defaultValue = "ALL") String kind,
            @RequestParam(defaultValue = "0") int page) {
        permissions.requireVerified(actor);
        return feed(search, skill, kind, page, actor.userId());
    }

    @GetMapping("/preferences")
    public WorkResponse<Map<String,Object>> preferences(@AuthenticationPrincipal WorkActor actor) {
        permissions.requireVerified(actor);
        return WorkResponse.read(Map.of(
            "saved", db.queryForList("SELECT CONCAT(kind,post_id) FROM discovery_saved_posts WHERE user_id=?", String.class, actor.userId()),
            "skills", db.queryForList("SELECT skill FROM discovery_followed_skills WHERE user_id=? ORDER BY skill", String.class, actor.userId())));
    }

    public record Selection(boolean selected) {}
    public record FollowedSkill(String skill, boolean selected) {}

    @PutMapping("/saved/{kind}/{id}")
    public WorkResponse<Void> save(@AuthenticationPrincipal WorkActor actor, @PathVariable String kind,
                                   @PathVariable long id, @RequestBody Selection input) {
        permissions.requireVerified(actor);
        if (!Set.of("REQUEST", "OPENING").contains(kind) || id < 1) throw invalid();
        if (input.selected()) {
            db.update("INSERT IGNORE INTO discovery_saved_posts(user_id,kind,post_id) SELECT ?,kind,id "
                + POSTS + " AND kind=? AND id=?", actor.userId(), "", kind, id);
        } else {
            db.update("DELETE FROM discovery_saved_posts WHERE user_id=? AND kind=? AND post_id=?", actor.userId(), kind, id);
        }
        return WorkResponse.ok("Đã cập nhật bài đã lưu.", null);
    }

    @PutMapping("/skills")
    public WorkResponse<Void> follow(@AuthenticationPrincipal WorkActor actor, @RequestBody FollowedSkill input) {
        permissions.requireVerified(actor);
        if (input.skill() == null) throw invalid();
        String skill = input.skill().strip().toLowerCase(java.util.Locale.ROOT);
        if (skill.isEmpty() || skill.length() > 100 || skill.matches(".*[,，;/|].*")
            || skill.codePoints().anyMatch(Character::isISOControl)) throw invalid();
        if (input.selected()) {
            db.update("INSERT IGNORE INTO discovery_followed_skills(user_id,skill) VALUES (?,?)", actor.userId(), skill);
        } else {
            db.update("DELETE FROM discovery_followed_skills WHERE user_id=? AND skill=?", actor.userId(), skill);
        }
        return WorkResponse.ok("Đã cập nhật hashtag theo dõi.", null);
    }

    private WorkResponse<Map<String,Object>> feed(String search, String skill, String kind, int page, String savedBy) {
        if (page < 0 || page > 10000 || search.length() > 100 || skill.length() > 300
                || !Set.of("ALL", "REQUEST", "OPENING").contains(kind)) {
            throw invalid();
        }
        var params = new ArrayList<Object>();
        params.add(search.strip());
        String query = POSTS;
        if (!kind.equals("ALL")) {
            query += " AND kind=?";
            params.add(kind);
        }
        if (!skill.isBlank()) {
            query += " AND LOCATE(CONCAT(',', LOWER(?), ','), CONCAT(',', REGEXP_REPLACE(LOWER(TRIM(skills)), '[[:space:]]*[,，;/|]+[[:space:]]*', ','), ',')) > 0";
            params.add(skill.strip());
        }
        if (savedBy != null) {
            query += " AND EXISTS (SELECT 1 FROM discovery_saved_posts saved WHERE saved.user_id=? AND saved.kind=posts.kind AND saved.post_id=posts.id)";
            params.add(savedBy);
        }
        Long total = db.queryForObject("SELECT COUNT(*) " + query, Long.class, params.toArray());
        params.add(page * 12);
        var items = db.queryForList("SELECT * " + query + " ORDER BY published_at DESC, kind, id DESC LIMIT 12 OFFSET ?", params.toArray());
        return WorkResponse.read(Map.of("items", ApiValues.utc(items), "total", total));
    }
    private WorkException invalid() {
        return new WorkException(HttpStatus.BAD_REQUEST, "INVALID_FEED_FILTER", "Bộ lọc bảng tin không hợp lệ.");
    }
}

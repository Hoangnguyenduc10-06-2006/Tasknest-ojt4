package vn.tasknest.workservice.application.community;

import java.net.URI;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;
import vn.tasknest.workservice.api.ApiValues;
import vn.tasknest.workservice.application.WorkException;
import vn.tasknest.workservice.application.security.*;
import vn.tasknest.workservice.infrastructure.identity.IdentityDirectoryClient;

@Service
public class ProfessionalProfileService {
    private final JdbcTemplate db;
    private final ProjectPermissionService permissions;
    private final IdentityDirectoryClient directory;
    private final JsonMapper json = new JsonMapper();
    private static final Set<String> AVAILABILITY = Set.of("AVAILABLE", "LOOKING_FOR_TEAM", "BUSY");
    private static final Set<String> MODES = Set.of("PROJECT", "PART_TIME", "FULL_TIME");
    public record Portfolio(String title, String role, String description, String url) {}
    public record Input(String headline, String about, String location, Integer experienceYears,
            List<String> skills, List<String> desiredRoles, Set<String> collaborationModes,
            String availability, Integer weeklyHours, String githubUrl, String linkedinUrl, String websiteUrl,
            String contactEmail, String socialUrl, List<Portfolio> portfolioItems, boolean isPublic, Long version) {}

    public ProfessionalProfileService(JdbcTemplate db, ProjectPermissionService permissions, IdentityDirectoryClient directory) {
        this.db = db;
        this.permissions = permissions;
        this.directory = directory;
    }

    public Map<String,Object> own(WorkActor actor) {
        permissions.requireVerified(actor);
        var rows = db.queryForList("SELECT * FROM professional_member_profiles WHERE user_id=?", actor.userId());
        Map<String,Object> result = rows.isEmpty() ? new LinkedHashMap<>() : decode(rows.getFirst());
        result.put("configured", !rows.isEmpty());
        result.put("likes", db.queryForObject("SELECT COUNT(*) FROM profile_likes WHERE target_type='MEMBER' AND target_id=?", Long.class, actor.userId()));
        result.put("recognitionCount", db.queryForObject("SELECT COUNT(*) FROM member_recognitions WHERE user_id=?", Long.class, actor.userId()));
        result.put("completedProjects", db.queryForObject("SELECT COUNT(*) FROM team_engagement_contributors WHERE user_id=?", Long.class, actor.userId()));
        result.put("publicUrl", "/members/" + actor.userId());
        return result;
    }

    public Map<String,Object> publicProfile(String user) {
        var rows = db.queryForList("SELECT * FROM professional_member_profiles WHERE user_id=? AND is_public=TRUE", user);
        if (rows.isEmpty()) return null;
        var result = decode(rows.getFirst());
        result.remove("version");
        result.remove("created_at");
        result.remove("is_public");
        if (!(result.get("contact_email") instanceof String contact) || contact.isBlank()) result.remove("contact_email");
        if (!(result.get("social_url") instanceof String social) || social.isBlank()) result.remove("social_url");
        return result;
    }

    /** Caller holds a write transaction, serializing visibility changes against new likes. */
    public boolean lockVisibleProfile(String user) {
        return !db.queryForList("SELECT user_id FROM professional_member_profiles WHERE user_id=? AND is_public=TRUE FOR UPDATE", user).isEmpty();
    }

    @Transactional
    public Map<String,Object> save(WorkActor actor, Input input) {
        permissions.requireVerified(actor);
        if (!AVAILABILITY.contains(input.availability()) || !MODES.containsAll(input.collaborationModes())) {
            throw invalid("Trạng thái nhận việc hoặc hình thức hợp tác không hợp lệ.");
        }
        if (input.isPublic() && (input.headline().isBlank() || input.about().isBlank() || input.skills().isEmpty())) {
            throw invalid("Điền chuyên môn, giới thiệu và ít nhất một kỹ năng trước khi công khai hồ sơ.");
        }
        var portfolios = input.portfolioItems().stream().map(item -> {
            if (item.title().isBlank() || item.role().isBlank()) throw invalid("Mỗi sản phẩm cần tên và vai trò của bạn.");
            return new Portfolio(item.title().strip(), item.role().strip(), item.description().strip(), safeUrl(item.url()));
        }).toList();
        String github = safeUrl(input.githubUrl()), linkedin = safeUrl(input.linkedinUrl()), website = safeUrl(input.websiteUrl());
        String contact = input.contactEmail() == null ? null : input.contactEmail().strip();
        String social = input.socialUrl() == null ? null : input.socialUrl().isBlank() ? "" : safeUrl(input.socialUrl());
        var prior = db.queryForList("SELECT version FROM professional_member_profiles WHERE user_id=? FOR UPDATE", actor.userId());
        if (prior.isEmpty()) {
            if (input.version() != null) throw conflict();
            // A private placeholder is part of this transaction and rolls back if any subsequent step fails.
            db.update("""
                INSERT INTO professional_member_profiles(user_id,display_name,about,skills,desired_roles,collaboration_modes,portfolio_items)
                VALUES(?,'','',JSON_ARRAY(),JSON_ARRAY(),JSON_ARRAY(),JSON_ARRAY())
                """, actor.userId());
        } else if (input.version() == null || ((Number) prior.getFirst().get("version")).longValue() != input.version()) {
            throw conflict();
        }
        var displayName = directory.names(Set.of(actor.userId())).get(actor.userId());
        if (displayName == null || displayName.isBlank()) throw invalid("Không thể đọc tên tài khoản. Vui lòng thử lại.");
        db.update("""
            UPDATE professional_member_profiles SET display_name=?,headline=?,about=?,location=?,experience_years=?,
              skills=?,desired_roles=?,collaboration_modes=?,availability=?,weekly_hours=?,
              github_url=?,linkedin_url=?,website_url=?,contact_email=COALESCE(?,contact_email),social_url=COALESCE(?,social_url),portfolio_items=?,is_public=?,
              version=?,updated_at=UTC_TIMESTAMP(6) WHERE user_id=?
            """, displayName, input.headline().strip(), input.about().strip(), input.location().strip(), input.experienceYears(),
            json.writeValueAsString(cleanList(input.skills())), json.writeValueAsString(cleanList(input.desiredRoles())),
            json.writeValueAsString(new TreeSet<>(input.collaborationModes())), input.availability(), input.weeklyHours(),
            github, linkedin, website, contact, social, json.writeValueAsString(portfolios), input.isPublic(),
            prior.isEmpty() ? 0 : input.version() + 1, actor.userId());
        return own(actor);
    }

    private List<String> cleanList(List<String> items) {
        return items.stream().map(String::strip).filter(value -> !value.isEmpty()).distinct().toList();
    }
    private Map<String,Object> decode(Map<String,Object> row) {
        ApiValues.utc(List.of(row));
        for (String field : List.of("skills", "desired_roles", "collaboration_modes", "portfolio_items")) {
            row.put(field, json.readValue(row.get(field).toString(), List.class));
        }
        return row;
    }
    static String safeUrl(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            var uri = URI.create(value.strip());
            if (!Set.of("http", "https").contains(uri.getScheme()) || uri.getHost() == null
                    || uri.getUserInfo() != null || value.codePoints().anyMatch(Character::isISOControl)) {
                throw new IllegalArgumentException();
            }
            String ascii = uri.toASCIIString();
            if (ascii.length() > 2048) throw new IllegalArgumentException();
            return ascii;
        } catch (IllegalArgumentException exception) {
            throw invalid("Liên kết cần bắt đầu bằng http:// hoặc https:// và không chứa thông tin đăng nhập.");
        }
    }
    private static WorkException invalid(String message) {
        return new WorkException(HttpStatus.BAD_REQUEST, "INVALID_PROFESSIONAL_PROFILE", message);
    }
    private WorkException conflict() {
        return new WorkException(HttpStatus.CONFLICT, "PROFESSIONAL_PROFILE_CHANGED", "Hồ sơ nghề nghiệp đã thay đổi. Tải dữ liệu mới trước khi lưu.");
    }
}

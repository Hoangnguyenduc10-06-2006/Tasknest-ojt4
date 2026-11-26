package vn.tasknest.workservice.application.community;

import java.util.ArrayList;
import java.util.Base64;
import java.util.HashSet;
import java.util.List;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import vn.tasknest.workservice.application.WorkException;
import vn.tasknest.workservice.application.collaboration.FileValidation;

public final class DiscoveryPostImage {
    public enum Kind {
        REQUEST("request_post_images"), OPENING("opening_post_images");

        private final String table;
        Kind(String table) { this.table = table; }
    }

    private DiscoveryPostImage() {}

    private static final int MAX_IMAGES = 4;
    private record Image(String mime, byte[] bytes) {}

    public static void write(JdbcTemplate db, Kind kind, long post, List<String> encoded, List<Integer> keep) {
        if (encoded == null && keep == null) return;
        var additions = encoded == null ? List.<String>of() : encoded;
        var retained = keep == null ? List.<Integer>of() : keep;
        if (additions.size() + retained.size() > MAX_IMAGES || new HashSet<>(retained).size() != retained.size())
            throw invalid("Mỗi bài đăng được đính kèm tối đa 4 ảnh.");
        var images = new ArrayList<Image>();
        for (Integer position : retained) {
            var old = db.query("SELECT mime_type,image_data FROM " + kind.table + " WHERE post_id=? AND position=?",
                (row,index) -> new Image(row.getString(1),row.getBytes(2)), post,position);
            if (old.isEmpty()) throw invalid("Ảnh đã thay đổi. Vui lòng tải lại bài đăng.");
            images.add(old.getFirst());
        }
        for (String base64 : additions) images.add(decode(base64));
        db.update("DELETE FROM " + kind.table + " WHERE post_id=?", post);
        for (int i=0; i<images.size(); i++) {
            var image = images.get(i);
            db.update("INSERT INTO " + kind.table + " (post_id,position,mime_type,image_data) VALUES (?,?,?,?)",
                post,i+1,image.mime(),image.bytes());
        }
    }

    private static Image decode(String encoded) {
        byte[] bytes;
        try {
            bytes = Base64.getDecoder().decode(encoded);
            if (bytes.length == 0 || bytes.length > 1024 * 1024) throw new IllegalArgumentException();
        } catch (IllegalArgumentException invalid) {
            throw invalid("Chọn ảnh PNG hoặc JPG tối đa 1 MB mỗi ảnh.");
        }
        String extension = (bytes[0] & 0xff) == 0x89 ? "png" : "jpg";
        return new Image(FileValidation.validate("post." + extension,bytes,true),bytes);
    }

    private static WorkException invalid(String message) {
        return new WorkException(HttpStatus.BAD_REQUEST,"INVALID_POST_IMAGE",message);
    }

    public static ResponseEntity<byte[]> read(JdbcTemplate db, Kind kind, long post, int position, String viewer) {
        String access = switch (kind) {
            case REQUEST -> """
                JOIN customer_project_requests p ON p.id=i.post_id
                WHERE i.post_id=? AND i.position=? AND (p.status<>'DRAFT' OR p.customer_user_id=?)
                """;
            case OPENING -> """
                JOIN team_openings p ON p.id=i.post_id JOIN dev_teams t ON t.id=p.team_id
                WHERE i.post_id=? AND i.position=? AND (t.owner_user_id=? OR (p.status='OPEN' AND p.closes_on>=UTC_DATE()
                   AND (SELECT COUNT(*) FROM team_applications a WHERE a.opening_id=p.id AND a.status='ACCEPTED')<p.slots))
                """;
        };
        List<ResponseEntity<byte[]>> images = db.query("SELECT i.mime_type,i.image_data FROM " + kind.table + " i " + access,
            (row,index) -> ResponseEntity.ok().contentType(MediaType.parseMediaType(row.getString(1)))
                .cacheControl(CacheControl.noStore()).header("X-Content-Type-Options","nosniff").body(row.getBytes(2)),
            post,position,viewer);
        return images.isEmpty() ? ResponseEntity.notFound().build() : images.getFirst();
    }
}

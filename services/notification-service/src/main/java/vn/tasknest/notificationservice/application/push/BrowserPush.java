package vn.tasknest.notificationservice.application.push;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.Security;
import java.time.Duration;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Map;
import java.util.Set;

import nl.martijndwars.webpush.Encoding;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.PushService;
import org.apache.http.util.EntityUtils;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import tools.jackson.databind.json.JsonMapper;
import vn.tasknest.notificationservice.application.mail.DeliveryAccess;
import vn.tasknest.notificationservice.application.mail.NotificationDestination;

@Service
public class BrowserPush {
    private static final Logger LOG = LoggerFactory.getLogger(BrowserPush.class);
    private static final Set<String> HOSTS = Set.of("fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com");
    private static final int MAX_ATTEMPTS = 3;
    private final JdbcTemplate db;
    private final DeliveryAccess deliveryAccess;
    private final JsonMapper json;
    private final PushService transport;
    private final String publicKey;
    private final HttpClient http = HttpClient.newBuilder()
        .followRedirects(HttpClient.Redirect.NEVER).connectTimeout(Duration.ofSeconds(3)).build();

    public BrowserPush(JdbcTemplate db, DeliveryAccess deliveryAccess, JsonMapper json,
                       @Value("${PUSH_VAPID_PUBLIC_KEY:}") String publicKey,
                       @Value("${PUSH_VAPID_PRIVATE_KEY:}") String privateKey,
                       @Value("${PUSH_VAPID_SUBJECT:}") String subject) {
        this.db = db;
        this.deliveryAccess = deliveryAccess;
        this.json = json;
        this.publicKey = publicKey.strip();
        this.transport = configure(this.publicKey, privateKey.strip(), subject.strip());
    }

    private PushService configure(String publicKey, String privateKey, String subject) {
        if (publicKey.isEmpty() && privateKey.isEmpty()) return null;
        try {
            if (!subject.startsWith("mailto:") && !subject.startsWith("https://")) {
                throw new IllegalArgumentException("Missing VAPID subject");
            }
            Security.addProvider(new BouncyCastleProvider());
            return new PushService(publicKey, privateKey, subject);
        } catch (Exception invalid) {
            LOG.error("Browser push disabled because VAPID configuration is invalid");
            return null;
        }
    }

    public record Preferences(boolean work, boolean collaboration, boolean messages, boolean details) {}
    public record Device(String endpoint, String p256dh, String auth, Preferences preferences) {}
    public record Settings(String publicKey, Preferences preferences) {}

    public Settings settings(String user, String endpoint) {
        if (transport == null) return new Settings(null, null);
        if (endpoint == null) return new Settings(publicKey, null);
        var rows = db.query("""
            SELECT work_alerts, collaboration_alerts, message_alerts, show_details
              FROM browser_push_subscriptions WHERE endpoint_hash=? AND user_id=?
            """, (row, i) -> new Preferences(row.getBoolean(1), row.getBoolean(2), row.getBoolean(3), row.getBoolean(4)),
            hash(endpoint), user);
        return new Settings(publicKey, rows.isEmpty() ? null : rows.getFirst());
    }

    public boolean enabled() {
        return transport != null;
    }

    public void save(String user, Device device) {
        String endpoint = validateEndpoint(device.endpoint());
        var preferences = java.util.Objects.requireNonNull(device.preferences());
        byte[] point = decode(device.p256dh(), 65);
        if (point[0] != 4) throw new IllegalArgumentException("Invalid public key");
        org.bouncycastle.jce.ECNamedCurveTable.getParameterSpec("prime256v1").getCurve().decodePoint(point);
        decode(device.auth(), 16);
        long cursor = db.queryForObject("SELECT COALESCE(MAX(id),0) FROM notifications WHERE recipient_user_id=?", Long.class, user);
        db.update("""
            INSERT INTO browser_push_subscriptions
              (endpoint_hash,user_id,endpoint,public_key,auth_secret,work_alerts,collaboration_alerts,message_alerts,show_details,last_notification_id)
              VALUES(?,?,?,?,?,?,?,?,?,?) AS incoming
            ON DUPLICATE KEY UPDATE last_notification_id=IF(browser_push_subscriptions.user_id=incoming.user_id,
                browser_push_subscriptions.last_notification_id,incoming.last_notification_id),
              push_attempts=IF(browser_push_subscriptions.user_id=incoming.user_id,browser_push_subscriptions.push_attempts,0),
              retry_after=IF(browser_push_subscriptions.user_id=incoming.user_id,browser_push_subscriptions.retry_after,NULL),
              user_id=incoming.user_id, public_key=incoming.public_key, auth_secret=incoming.auth_secret,
              work_alerts=incoming.work_alerts, collaboration_alerts=incoming.collaboration_alerts,
              message_alerts=incoming.message_alerts, show_details=incoming.show_details
            """, hash(endpoint), user, endpoint, device.p256dh(), device.auth(), preferences.work(),
            preferences.collaboration(), preferences.messages(), preferences.details(), cursor);
    }

    public void remove(String user, String endpoint) {
        db.update("DELETE FROM browser_push_subscriptions WHERE endpoint_hash=? AND user_id=?", hash(endpoint), user);
    }

    static String validateEndpoint(String endpoint) {
        if (endpoint == null || endpoint.length() > 2048) throw new IllegalArgumentException("Invalid push endpoint");
        URI url = URI.create(endpoint);
        if (!"https".equals(url.getScheme()) || url.getHost() == null || !HOSTS.contains(url.getHost())
            || url.getPort() != -1 || url.getRawUserInfo() != null || url.getRawFragment() != null
            || url.getRawPath() == null || url.getRawPath().length() < 2) {
            throw new IllegalArgumentException("Invalid push endpoint");
        }
        return endpoint;
    }

    private static byte[] decode(String value, int length) {
        if (value == null || value.length() > 100) throw new IllegalArgumentException("Invalid push key");
        byte[] decoded = Base64.getUrlDecoder().decode(value);
        if (decoded.length != length) throw new IllegalArgumentException("Invalid push key");
        return decoded;
    }

    private static String hash(String endpoint) {
        validateEndpoint(endpoint);
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(endpoint.getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }

    @Scheduled(fixedDelayString = "${PUSH_POLL_INTERVAL_MS:5000}")
    public void deliver() {
        if (transport == null) return;
        var devices = db.queryForList("""
            SELECT s.* FROM browser_push_subscriptions s
            WHERE (s.retry_after IS NULL OR s.retry_after<=UTC_TIMESTAMP(6))
              AND EXISTS (SELECT 1 FROM notifications n WHERE n.recipient_user_id=s.user_id AND n.id>s.last_notification_id)
            ORDER BY s.checked_at LIMIT 30
            """);
        long deadline = System.nanoTime() + Duration.ofSeconds(8).toNanos();
        for (var device : devices) {
            if (System.nanoTime() >= deadline) return;
            try {
                deliverDevice(device, deadline);
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
                return;
            } catch (Exception failed) {
                LOG.warn("Browser push delivery failed ({})", failed.getClass().getSimpleName());
            }
        }
    }

    private void deliverDevice(Map<String, Object> device, long deadline) throws Exception {
        String key = (String) device.get("endpoint_hash");
        String user = (String) device.get("user_id");
        long cursor = ((Number) device.get("last_notification_id")).longValue();
        var events = db.queryForList("""
            SELECT id,event_type,recipient_reasons,project_id,task_id,access_scope,title,body,destination_path,
                   (created_at >= UTC_TIMESTAMP(6) - INTERVAL 15 MINUTE
                    AND (read_at IS NULL OR event_type='discovery.chat.message')) AS deliverable
              FROM notifications
             WHERE recipient_user_id=? AND id>?
             ORDER BY id LIMIT 10
            """, user, cursor);
        int attempts = ((Number) device.get("push_attempts")).intValue();
        for (var event : events) {
            if (System.nanoTime() >= deadline) return;
            long id = ((Number) event.get("id")).longValue();
            // Lease the current cursor position for one attempt across all replicas.
            if (db.update("""
                UPDATE browser_push_subscriptions
                SET push_attempts=push_attempts+1,retry_after=UTC_TIMESTAMP(6)+INTERVAL 90 SECOND,checked_at=UTC_TIMESTAMP(6)
                WHERE endpoint_hash=? AND user_id=? AND last_notification_id=? AND push_attempts=?
                  AND (retry_after IS NULL OR retry_after<=UTC_TIMESTAMP(6))
                """, key, user, cursor, attempts) != 1) return;
            int attempt = attempts + 1;
            if (attempt <= MAX_ATTEMPTS && flag(event, "deliverable") && selected(device, event)) {
                int status;
                try {
                    Long project = number(event.get("project_id"));
                    Long task = number(event.get("task_id"));
                    boolean projectCheck = !"work.project-invitation.created".equals(event.get("event_type"))
                        && "PROJECT_MEMBER".equals(event.get("access_scope"));
                    status = projectCheck && (project == null || !deliveryAccess.allowed(project, user, task))
                        ? 204 : send(device, event, id, project, task);
                } catch (java.io.IOException | org.springframework.web.client.RestClientException unavailable) {
                    LOG.warn("Browser push temporarily unavailable ({})", unavailable.getClass().getSimpleName());
                    status = 503;
                }
                if (status == 404 || status == 410) {
                    db.update("""
                        DELETE FROM browser_push_subscriptions
                        WHERE endpoint_hash=? AND user_id=? AND last_notification_id=? AND push_attempts=?
                        """, key, user, cursor, attempt);
                    return;
                }
                if ((status == 429 || status >= 500) && attempt < MAX_ATTEMPTS) return;
                if (status < 200 || status >= 300) LOG.warn("Browser push provider returned HTTP {}", status);
            }
            if (db.update("""
                UPDATE browser_push_subscriptions
                SET last_notification_id=?,push_attempts=0,retry_after=NULL,checked_at=UTC_TIMESTAMP(6)
                WHERE endpoint_hash=? AND user_id=? AND last_notification_id=? AND push_attempts=?
                """, id, key, user, cursor, attempt) != 1) return;
            cursor = id;
            attempts = 0;
        }
    }

    private boolean selected(Map<String, Object> device, Map<String, Object> event) {
        String type = (String) event.get("event_type");
        String reasons = String.valueOf(event.get("recipient_reasons"));
        if (type.equals("discovery.chat.message")) return flag(device, "message_alerts");
        if (type.startsWith("discovery.") || type.startsWith("work.milestone-") || type.equals("work.project-awarded") || type.contains("invitation")) {
            return flag(device, "collaboration_alerts") && !type.equals("discovery.profile.liked");
        }
        return flag(device, "work_alerts") && (type.contains("assign") || reasons.contains("\"MENTION\"") || reasons.contains("\"REPLY\""));
    }

    private int send(Map<String, Object> device, Map<String, Object> event, long id, Long project, Long task) throws Exception {
        boolean preview = flag(device, "show_details");
        String destination = (String) event.get("destination_path");
        if (destination == null || !NotificationDestination.valid(destination)) {
            destination = task != null ? "/tasks/" + task : project != null ? "/projects/" + project : "/notifications";
            if ("work.project-invitation.created".equals(event.get("event_type"))) destination = "/invitations?tab=invitations";
        }
        byte[] payload = json.writeValueAsBytes(Map.of(
            "title", preview ? abbreviated(event.get("title"), 90) : "TaskNest",
            "body", preview ? abbreviated(event.get("body"), 240) : "Bạn có cập nhật mới.",
            "path", destination, "tag", "tasknest-" + id));
        String endpoint = validateEndpoint((String) device.get("endpoint"));
        var push = transport.preparePost(new Notification(endpoint, (String) device.get("public_key"),
            (String) device.get("auth_secret"), payload, 900), Encoding.AES128GCM);
        var request = HttpRequest.newBuilder(URI.create(endpoint)).timeout(Duration.ofSeconds(5))
            .POST(HttpRequest.BodyPublishers.ofByteArray(EntityUtils.toByteArray(push.getEntity())));
        for (var header : push.getAllHeaders()) request.header(header.getName(), header.getValue());
        return http.send(request.build(), HttpResponse.BodyHandlers.discarding()).statusCode();
    }

    private static boolean flag(Map<String, Object> row, String key) {
        Object value = row.get(key);
        return Boolean.TRUE.equals(value) || value instanceof Number n && n.intValue() != 0;
    }

    private static Long number(Object value) {
        return value instanceof Number number ? number.longValue() : null;
    }

    private static String abbreviated(Object value, int max) {
        String text = value == null ? "" : value.toString();
        return text.substring(0, text.offsetByCodePoints(0, Math.min(max, text.codePointCount(0, text.length()))));
    }
}

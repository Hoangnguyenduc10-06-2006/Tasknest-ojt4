package vn.tasknest.identityservice.config;

import java.util.ArrayList;
import java.util.List;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Cấu hình bảo mật của identity-service (prefix {@code tasknest.identity}). Giá trị bí mật (khóa mã hóa
 * outbox) phải đến từ biến môi trường/Config Server, không đặt trong mã nguồn (SEC-10).
 */
@Getter
@Setter
@ConfigurationProperties(prefix = "tasknest.identity")
public class IdentityProperties {

    private Cookie cookie = new Cookie();
    private Outbox outbox = new Outbox();
    private Jwt jwt = new Jwt();
    private RateLimit rateLimit = new RateLimit();
    /** Origin trình duyệt được phép gọi các endpoint dùng cookie (refresh/logout) — SEC-07. */
    private List<String> allowedOrigins = new ArrayList<>(List.of("http://localhost:3000"));

    @Getter @Setter
    public static class Jwt {
        /** Required RSA PKCS#8 DER private key, encoded as base64. */
        private String privateKeyBase64;
    }

    @Getter @Setter
    public static class RateLimit {
        // Operational defaults, configurable without changing business rules.
        private int mailAddressAttempts = 10;
        private int mailGlobalAttempts = 200;
        private int mailWindowSeconds = 3600;
        private int loginAccountAttempts = 10;
        private int loginAddressAttempts = 100;
        private int loginWindowSeconds = 900;
        private int refreshSessionAttempts = 30;
        private int refreshAddressAttempts = 100;
        private int refreshWindowSeconds = 60;
    }

    @Getter
    @Setter
    public static class Cookie {
        private String name = "tasknest_refresh";
        /** Mặc định true; chỉ tắt cho môi trường dev không có HTTPS. */
        private boolean secure = true;
        private String sameSite = "Strict";
        private String path = "/api/identity/auth";
    }

    @Getter
    @Setter
    public static class Outbox {
        /** Required durable AES-256 key, base64 encoded; never generated at application startup. */
        private String keyBase64;
        private String keyId = "outbox-key-1";
    }
}

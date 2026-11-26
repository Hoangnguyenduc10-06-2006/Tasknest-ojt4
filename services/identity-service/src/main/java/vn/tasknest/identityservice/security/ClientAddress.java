package vn.tasknest.identityservice.security;

import jakarta.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class ClientAddress {
    private final String key;
    public ClientAddress(@Value("${TASKNEST_PROXY_KEY:}") String key) {
        this.key = key;
        if (!key.isEmpty() && !key.matches("[a-f0-9]{64}")) throw new IllegalStateException("Invalid proxy key configuration");
    }
    public String resolve(HttpServletRequest request) {
        String supplied = request.getHeader("X-Tasknest-Proxy-Key");
        String address = request.getHeader("X-Tasknest-Client-IP");
        if (!key.isEmpty() && supplied != null && address != null && address.matches("[0-9a-fA-F:.]{2,45}")
            && MessageDigest.isEqual(key.getBytes(StandardCharsets.UTF_8), supplied.getBytes(StandardCharsets.UTF_8))) return address;
        return request.getRemoteAddr();
    }
}

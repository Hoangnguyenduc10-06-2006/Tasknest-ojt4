package vn.tasknest.apigateway.config;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.stereotype.Component;
import org.springframework.web.server.*;
import reactor.core.publisher.Mono;

/** Only the ingress possessing the private proxy key may supply a client address. */
@Component
public class ClientAddressFilter implements WebFilter, Ordered {
    private final String key;
    public ClientAddressFilter(@Value("${TASKNEST_PROXY_KEY:}") String key) {
        this.key = key;
        if (!key.isEmpty() && !key.matches("[a-f0-9]{64}")) throw new IllegalStateException("Invalid proxy key configuration");
    }
    @Override public int getOrder() { return Ordered.HIGHEST_PRECEDENCE + 1; }
    @Override public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
        var incoming = exchange.getRequest();
        String supplied = incoming.getHeaders().getFirst("X-Tasknest-Proxy-Key");
        String forwarded = incoming.getHeaders().getFirst("X-Tasknest-Client-IP");
        boolean trusted = !key.isEmpty() && supplied != null && MessageDigest.isEqual(
            key.getBytes(StandardCharsets.UTF_8), supplied.getBytes(StandardCharsets.UTF_8));
        String peer = incoming.getRemoteAddress() == null ? "unknown" : incoming.getRemoteAddress().getAddress().getHostAddress();
        String address = trusted && forwarded != null && forwarded.matches("[0-9a-fA-F:.]{2,45}") ? forwarded : peer;
        var request = incoming.mutate().headers(headers -> {
            headers.remove("Forwarded"); headers.remove("X-Forwarded-For"); headers.remove("X-Real-IP");
            headers.remove("X-Tasknest-Proxy-Key"); headers.remove("X-Tasknest-Client-IP");
            if (!key.isEmpty()) {
                headers.set("X-Tasknest-Proxy-Key", key);
                headers.set("X-Tasknest-Client-IP", address);
            }
        }).build();
        return chain.filter(exchange.mutate().request(request).build());
    }
}

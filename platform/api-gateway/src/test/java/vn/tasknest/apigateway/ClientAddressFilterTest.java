package vn.tasknest.apigateway;

import java.net.InetSocketAddress;
import org.junit.jupiter.api.Test;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import vn.tasknest.apigateway.config.ClientAddressFilter;
import reactor.core.publisher.Mono;
import static org.junit.jupiter.api.Assertions.*;

class ClientAddressFilterTest {
    @Test void replacesForgedHeadersWithPeerAddress() {
        var request = MockServerHttpRequest.get("/api/identity/auth/login")
            .remoteAddress(new InetSocketAddress("192.0.2.10", 1000))
            .header("X-Tasknest-Client-IP", "198.51.100.1").header("X-Forwarded-For", "198.51.100.1")
            .header("X-Tasknest-Proxy-Key", "forged").build();
        new ClientAddressFilter("a".repeat(64)).filter(MockServerWebExchange.from(request), exchange -> {
            assertEquals("192.0.2.10", exchange.getRequest().getHeaders().getFirst("X-Tasknest-Client-IP"));
            assertNull(exchange.getRequest().getHeaders().getFirst("X-Forwarded-For"));
            return Mono.empty();
        }).block();
    }
    @Test void preservesOnlyAuthenticatedIngressAddress() {
        var request = MockServerHttpRequest.get("/api/identity/auth/login")
            .remoteAddress(new InetSocketAddress("192.0.2.10", 1000))
            .header("X-Tasknest-Client-IP", "198.51.100.1").header("X-Tasknest-Proxy-Key", "a".repeat(64)).build();
        new ClientAddressFilter("a".repeat(64)).filter(MockServerWebExchange.from(request), exchange -> {
            assertEquals("198.51.100.1", exchange.getRequest().getHeaders().getFirst("X-Tasknest-Client-IP"));
            return Mono.empty();
        }).block();
    }
}

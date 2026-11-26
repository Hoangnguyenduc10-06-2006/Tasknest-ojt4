package vn.tasknest.identityservice.security;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import static org.junit.jupiter.api.Assertions.*;

class ClientAddressTest {
    @Test void ignoresSpoofedForwardingMetadataUnlessProxyAuthenticates() {
        var resolver = new ClientAddress("a".repeat(64));
        var request = new MockHttpServletRequest(); request.setRemoteAddr("10.0.0.2");
        request.addHeader("X-Forwarded-For", "192.0.2.1");
        request.addHeader("X-Tasknest-Client-IP", "192.0.2.1");
        assertEquals("10.0.0.2", resolver.resolve(request));
        request.addHeader("X-Tasknest-Proxy-Key", "a".repeat(64));
        assertEquals("192.0.2.1", resolver.resolve(request));
        assertEquals("10.0.0.2", new ClientAddress("").resolve(request));
    }
}

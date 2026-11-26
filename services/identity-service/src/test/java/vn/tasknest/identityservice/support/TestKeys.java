package vn.tasknest.identityservice.support;

import java.security.KeyPairGenerator;
import java.util.Base64;
import vn.tasknest.identityservice.config.IdentityProperties;

public final class TestKeys {
    public static final String PRIVATE_KEY = generate();
    private TestKeys() { }
    private static String generate() {
        try {
            var generator = KeyPairGenerator.getInstance("RSA");
            generator.initialize(2048);
            return Base64.getEncoder().encodeToString(generator.generateKeyPair().getPrivate().getEncoded());
        } catch (Exception ex) { throw new IllegalStateException(ex); }
    }
    public static IdentityProperties properties() {
        var properties = new IdentityProperties();
        properties.getJwt().setPrivateKeyBase64(PRIVATE_KEY);
        properties.getOutbox().setKeyBase64(Base64.getEncoder().encodeToString(new byte[32]));
        return properties;
    }
}

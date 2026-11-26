package vn.tasknest.identityservice.service;

import static org.junit.jupiter.api.Assertions.*;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import vn.tasknest.identityservice.config.IdentityProperties;
import vn.tasknest.identityservice.config.RsaKeyConfiguration;
import vn.tasknest.identityservice.security.OutboxCipher;
import vn.tasknest.identityservice.support.TestKeys;

class KeyPersistenceTest {
    @Test
    void configuredOutboxKeyDecryptsAcrossInstances() {
        var first = new OutboxCipher(TestKeys.properties());
        var second = new OutboxCipher(TestKeys.properties());
        byte[] fixture = "review-fixture".getBytes(StandardCharsets.UTF_8);
        assertArrayEquals(fixture, second.decrypt(first.encrypt(fixture)));
        assertEquals(first.keyId(), second.keyId());
    }

    @Test
    void missingOutboxOrJwtKeyFailsRatherThanGeneratingEphemeralSecrets() {
        assertThrows(IllegalStateException.class, () -> new OutboxCipher(new IdentityProperties()));
        assertThrows(IllegalStateException.class, () -> new RsaKeyConfiguration().rsaKeyPair(new IdentityProperties()));
    }

    @Test
    void configuredRsaKeyAndKidSurviveRestart() throws Exception {
        var first = new RsaKeyConfiguration();
        var second = new RsaKeyConfiguration();
        var a = first.rsaKey(first.rsaKeyPair(TestKeys.properties()));
        var b = second.rsaKey(second.rsaKeyPair(TestKeys.properties()));
        assertEquals(a.toPublicJWK(), b.toPublicJWK());
        assertEquals(a.getKeyID(), b.getKeyID());
    }
}

package vn.tasknest.identityservice.security;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class CredentialPolicyTest {
    @Test void consistentEmailBoundaries() {
        assertTrue(CredentialPolicy.validEmail(" USER+tag@Example.com "));
        assertTrue(CredentialPolicy.validEmail("a".repeat(64)+"@example.test"));
        assertFalse(CredentialPolicy.validEmail("a".repeat(65)+"@example.test"));
        assertFalse(CredentialPolicy.validEmail("a..b@example.test"));
        assertFalse(CredentialPolicy.validEmail("a@-example.test"));
    }
    @Test void bcryptLimitsAreBytesAndNeverTruncated() {
        assertTrue(CredentialPolicy.validPassword("a".repeat(72)));
        assertFalse(CredentialPolicy.validPassword("a".repeat(73)));
        assertTrue(CredentialPolicy.validPassword("ậ".repeat(24)));
        assertFalse(CredentialPolicy.validPassword("ậ".repeat(25)));
        assertFalse(CredentialPolicy.validPassword("😀".repeat(4)));
    }
}

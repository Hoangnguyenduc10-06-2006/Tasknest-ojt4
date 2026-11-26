package vn.tasknest.identityservice.security;

import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Component;
import vn.tasknest.identityservice.config.IdentityProperties;

/**
 * Mã hóa AES-256-GCM cho {@code outbox_events.sensitive_payload}. Định dạng: IV(12) || ciphertext+tag.
 * Khóa bền vững lấy từ cấu hình ngoài mã nguồn; thiếu khóa thì dừng khởi động.
 */
@Component
public class OutboxCipher {

    private static final int IV_BYTES = 12;
    private static final int TAG_BITS = 128;

    private final SecureRandom random = new SecureRandom();
    private final SecretKey key;
    private final String keyId;

    public OutboxCipher(IdentityProperties properties) {
        this.keyId = properties.getOutbox().getKeyId();
        String configured = properties.getOutbox().getKeyBase64();
        if (configured == null || configured.isBlank()) {
            throw new IllegalStateException("Missing required tasknest.identity.outbox.key-base64; configure a durable key");
        }
        byte[] keyBytes = Base64.getDecoder().decode(configured.trim());
        if (keyBytes.length != 32) {
            throw new IllegalStateException("Khóa outbox phải là 32 byte (AES-256) mã hóa base64");
        }
        this.key = new SecretKeySpec(keyBytes, "AES");
    }

    public String keyId() {
        return keyId;
    }

    public byte[] encrypt(byte[] plaintext) {
        try {
            byte[] iv = new byte[IV_BYTES];
            random.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, iv));
            byte[] encrypted = cipher.doFinal(plaintext);
            byte[] out = new byte[IV_BYTES + encrypted.length];
            System.arraycopy(iv, 0, out, 0, IV_BYTES);
            System.arraycopy(encrypted, 0, out, IV_BYTES, encrypted.length);
            return out;
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Không thể mã hóa payload outbox", e);
        }
    }

    public byte[] decrypt(byte[] data) {
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, Arrays.copyOfRange(data, 0, IV_BYTES)));
            return cipher.doFinal(data, IV_BYTES, data.length - IV_BYTES);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Không thể giải mã payload outbox", e);
        }
    }
}

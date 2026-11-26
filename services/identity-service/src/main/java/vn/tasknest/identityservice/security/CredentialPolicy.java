package vn.tasknest.identityservice.security;

import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.regex.Pattern;

/** Supported email format and BCrypt UTF-8 limits, shared by all account entry points. */
public final class CredentialPolicy {
    private CredentialPolicy() {}
    private static final Pattern EMAIL = Pattern.compile("^[a-z0-9_+&*\\-]+(?:\\.[a-z0-9_+&*\\-]+)*@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z]{2,63}$");
    public static String normalizeEmail(String value) { return value == null ? "" : value.trim().toLowerCase(Locale.ROOT); }
    public static boolean validEmail(String value) {
        String email = normalizeEmail(value);
        int at = email.indexOf('@');
        return email.length() <= 255 && at > 0 && at <= 64 && EMAIL.matcher(email).matches();
    }
    public static boolean validPassword(String value) {
        return value != null && value.codePointCount(0, value.length()) >= 8
            && value.getBytes(StandardCharsets.UTF_8).length <= 72;
    }
}

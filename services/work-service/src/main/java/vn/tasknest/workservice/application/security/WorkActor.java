package vn.tasknest.workservice.application.security;

import java.security.Principal;
import java.util.UUID;

/** Identity-validated session. Never construct from X-User-Id, role headers or request JSON. */
public record WorkActor(String userId, boolean emailVerified) implements Principal {
    public WorkActor {
        if (userId == null || !UUID.fromString(userId).toString().equals(userId))
            throw new IllegalArgumentException("Canonical UUID required");
    }
    @Override public String getName() { return userId; }
}

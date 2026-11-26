package vn.tasknest.workservice.application.security;

public interface IdentitySessionVerifier {
    WorkActor verify(String bearerToken);
}

package vn.tasknest.identityservice.exception;

public class CooldownException extends RuntimeException {

    private final long remainingSeconds;

    public CooldownException(String message, long remainingSeconds) {
        super(message);
        this.remainingSeconds = remainingSeconds;
    }

    public long getRemainingSeconds() {
        return remainingSeconds;
    }
}

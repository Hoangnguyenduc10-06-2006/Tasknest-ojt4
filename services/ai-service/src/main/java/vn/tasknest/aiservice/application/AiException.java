package vn.tasknest.aiservice.application;



import org.springframework.http.HttpStatus;

public class AiException extends RuntimeException {
    private final HttpStatus status;
    private final String code;
    private final int retryAfter;
    public AiException(HttpStatus status, String code, String message) { this(status, code, message, 0); }
    public AiException(HttpStatus status, String code, String message, int retryAfter) {
        super(message); this.status = status; this.code = code; this.retryAfter = retryAfter;
    }
    public HttpStatus status() { return status; }
    public String code() { return code; }
    public int retryAfter() { return retryAfter; }
}

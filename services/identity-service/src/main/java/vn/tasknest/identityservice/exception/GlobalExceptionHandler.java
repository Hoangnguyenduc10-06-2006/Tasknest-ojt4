package vn.tasknest.identityservice.exception;

import java.util.HashMap;
import java.util.Map;
import org.springframework.context.support.DefaultMessageSourceResolvable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import vn.tasknest.identityservice.api.dto.common.response.ApiDataResponse;

@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(org.springframework.web.server.ResponseStatusException.class)
    public ResponseEntity<ApiDataResponse<Void>> handleStatus(org.springframework.web.server.ResponseStatusException ex) {
        HttpStatus status=HttpStatus.valueOf(ex.getStatusCode().value());
        String message=ex.getReason()!=null ? ex.getReason() : status.getReasonPhrase();
        return ResponseEntity.status(status).body(new ApiDataResponse<>(false,message,null,null,status));
    }


    @ExceptionHandler(EmailNotVerifiedException.class)
    public ResponseEntity<ApiDataResponse<Map<String,String>>> handleEmailNotVerified(EmailNotVerifiedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new ApiDataResponse<>(false,
            ex.getMessage(), Map.of("code", "EMAIL_NOT_VERIFIED"), null, HttpStatus.FORBIDDEN));
    }

    @ExceptionHandler(NotFoundUser.class)
    public ResponseEntity<ApiDataResponse<Void>> handleNotFoundUser(NotFoundUser ex) {
        return new ResponseEntity<>(
                new ApiDataResponse<>(
                        false,
                        "Không tìm thấy user",
                        null,
                        ex.getMessage(),
                        HttpStatus.NOT_FOUND
                ),
                HttpStatus.NOT_FOUND
        );
    }

    @ExceptionHandler(TokenNotFoundException.class)
    public ResponseEntity<ApiDataResponse<Void>> handleTokenNotFoundException(TokenNotFoundException ex) {
        return new ResponseEntity<>(
                new ApiDataResponse<>(
                        false,
                        ex.getMessage(),
                        null,
                        ex.getMessage(),
                        HttpStatus.NOT_FOUND
                ),
                HttpStatus.NOT_FOUND
        );
    }

    @ExceptionHandler(TokenExpiredException.class)
    public ResponseEntity<ApiDataResponse<Void>> handleTokenExpiredException(TokenExpiredException ex) {
        return new ResponseEntity<>(
                new ApiDataResponse<>(
                        false,
                        ex.getMessage(),
                        null,
                        ex.getMessage(),
                        HttpStatus.BAD_REQUEST
                ),
                HttpStatus.BAD_REQUEST
        );
    }

    @ExceptionHandler(RateLimitExceededException.class)
    public ResponseEntity<ApiDataResponse<Void>> handleRateLimitExceededException(RateLimitExceededException ex) {
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
            .header("Retry-After", String.valueOf(ex.getRetryAfterSeconds()))
            .body(new ApiDataResponse<>(false, ex.getMessage(), null, ex.getMessage(), HttpStatus.TOO_MANY_REQUESTS));
    }

    @ExceptionHandler(CooldownException.class)
    public ResponseEntity<ApiDataResponse<Map<String, Object>>> handleCooldownException(CooldownException ex) {
        Map<String, Object> errorDetail = Map.of(
            "remainingSeconds", ex.getRemainingSeconds(),
            "reason", ex.getMessage()
        );
        return new ResponseEntity<>(
                new ApiDataResponse<>(
                        false,
                        ex.getMessage(),
                        errorDetail,
                        ex.getMessage(),
                        HttpStatus.TOO_MANY_REQUESTS
                ),
                HttpStatus.TOO_MANY_REQUESTS
        );
    }

    @ExceptionHandler(EmailAlreadyVerifiedException.class)
    public ResponseEntity<ApiDataResponse<Void>> handleEmailAlreadyVerifiedException(EmailAlreadyVerifiedException ex) {
        return new ResponseEntity<>(
                new ApiDataResponse<>(
                        false,
                        ex.getMessage(),
                        null,
                        ex.getMessage(),
                        HttpStatus.BAD_REQUEST
                ),
                HttpStatus.BAD_REQUEST
        );
    }

    @ExceptionHandler(ValidationException.class)
    public ResponseEntity<ApiDataResponse<Void>> handleValidationException(ValidationException ex) {
        return new ResponseEntity<>(
                new ApiDataResponse<>(
                        false,
                        ex.getMessage(),
                        null,
                        ex.getMessage(),
                        HttpStatus.BAD_REQUEST
                ),
                HttpStatus.BAD_REQUEST
        );
    }

    @ExceptionHandler(DuplicateEmailException.class)
    public ResponseEntity<ApiDataResponse<Void>> handleDuplicateEmailException(DuplicateEmailException ex) {
        return new ResponseEntity<>(
                new ApiDataResponse<>(
                        false,
                        ex.getMessage(),
                        null,
                        ex.getMessage(),
                        HttpStatus.CONFLICT
                ),
                HttpStatus.CONFLICT
        );
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiDataResponse<Void>> handleMethodArgumentNotValid(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream()
                .findFirst()
                .map(DefaultMessageSourceResolvable::getDefaultMessage)
                .orElse("Dữ liệu không hợp lệ");

        Map<String, String> fieldErrors = new HashMap<>();
        for (FieldError fieldError : ex.getBindingResult().getFieldErrors()) {
            fieldErrors.put(fieldError.getField(), fieldError.getDefaultMessage());
        }

        return new ResponseEntity<>(
                new ApiDataResponse<>(
                        false,
                        message,
                        null,
                        fieldErrors,
                        HttpStatus.BAD_REQUEST
                ),
                HttpStatus.BAD_REQUEST
        );
    }

    @ExceptionHandler(InvalidCredentialsException.class)
    public ResponseEntity<ApiDataResponse<Void>> handleInvalidCredentialsException(InvalidCredentialsException ex) {
        return new ResponseEntity<>(
                new ApiDataResponse<>(
                        false,
                        ex.getMessage(),
                        null,
                        ex.getMessage(),
                        HttpStatus.UNAUTHORIZED
                ),
                HttpStatus.UNAUTHORIZED
        );
    }

    @ExceptionHandler(InvalidRefreshTokenException.class)
    public ResponseEntity<ApiDataResponse<Void>> handleInvalidRefreshTokenException(InvalidRefreshTokenException ex) {
        return new ResponseEntity<>(
                new ApiDataResponse<>(
                        false,
                        ex.getMessage(),
                        null,
                        ex.getMessage(),
                        HttpStatus.UNAUTHORIZED
                ),
                HttpStatus.UNAUTHORIZED
        );
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiDataResponse<Void>> handleIllegalArgumentException(IllegalArgumentException ex) {
        return new ResponseEntity<>(
                new ApiDataResponse<>(
                        false,
                        ex.getMessage(),
                        null,
                        ex.getMessage(),
                        HttpStatus.BAD_REQUEST
                ),
                HttpStatus.BAD_REQUEST
        );
    }
}

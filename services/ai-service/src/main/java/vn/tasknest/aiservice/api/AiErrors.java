package vn.tasknest.aiservice.api;

import vn.tasknest.aiservice.application.AiException;

import java.util.Map;
import org.springframework.http.*;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.*;
import org.springframework.dao.DataAccessException;

@RestControllerAdvice
public class AiErrors {
    @ExceptionHandler(AiException.class) ResponseEntity<?> ai(AiException ex) {
        var response = ResponseEntity.status(ex.status()).cacheControl(CacheControl.noStore());
        if (ex.retryAfter() > 0) response.header("Retry-After", Integer.toString(ex.retryAfter()));
        return response.body(Map.of("success", false, "code", ex.code(), "message", ex.getMessage()));
    }
    @ExceptionHandler({MethodArgumentNotValidException.class, HttpMessageNotReadableException.class}) ResponseEntity<?> invalid(Exception ex) {
        return ai(new AiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Câu hỏi phải có nội dung và không vượt quá 1.000 ký tự."));
    }
    @ExceptionHandler(DataAccessException.class) ResponseEntity<?> storage(DataAccessException ex) {
        return ai(new AiException(HttpStatus.SERVICE_UNAVAILABLE, "AI_QUOTA_UNAVAILABLE", "Không thể kiểm tra hạn mức AI. Vui lòng thử lại sau."));
    }
}

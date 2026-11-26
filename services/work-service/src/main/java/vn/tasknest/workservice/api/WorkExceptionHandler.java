package vn.tasknest.workservice.api;

import jakarta.validation.ConstraintViolationException;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.*;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.BindException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import vn.tasknest.workservice.application.WorkException;

@RestControllerAdvice
public class WorkExceptionHandler {
    @ExceptionHandler(WorkException.class)
    ResponseEntity<WorkResponse<Void>> business(WorkException ex) {
        return ResponseEntity.status(ex.status())
                .body(WorkResponse.error(ex.status(), ex.code(), ex.getMessage(), null));
    }

    @ExceptionHandler(BindException.class)
    ResponseEntity<WorkResponse<Void>> validation(BindException ex) {
        Map<String, String> fields = new LinkedHashMap<>();
        ex.getBindingResult().getFieldErrors().forEach(e -> {
            String field = switch (e.getField()) {
                case "sizeValid" -> "size";
                case "pageOffsetValid", "offsetValid" -> "page";
                default -> e.getField();
            };
            String message = e.isBindingFailure() ? "Giá trị tham số không hợp lệ." : e.getDefaultMessage();
            fields.putIfAbsent(field, message);
        });
        return ResponseEntity.badRequest()
                .body(WorkResponse.error(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Dữ liệu không hợp lệ.", fields));
    }

    @ExceptionHandler({ HttpMessageNotReadableException.class, ConstraintViolationException.class,
            MethodArgumentTypeMismatchException.class, IllegalArgumentException.class })
    ResponseEntity<WorkResponse<Void>> invalidInput(Exception ex) {
        return ResponseEntity.badRequest().body(WorkResponse.error(HttpStatus.BAD_REQUEST, "INVALID_REQUEST",
                "Kiểm tra dữ liệu và định dạng tham số yêu cầu.", null));
    }

    @ExceptionHandler(org.springframework.dao.ConcurrencyFailureException.class)
    ResponseEntity<WorkResponse<Void>> contention(org.springframework.dao.ConcurrencyFailureException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(WorkResponse.error(HttpStatus.CONFLICT,
                "WRITE_CONFLICT", "Dữ liệu đang được cập nhật ở nơi khác. Vui lòng tải lại rồi thử lại thao tác.", null));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<WorkResponse<Void>> conflict(DataIntegrityViolationException ex) {
        boolean duplicateName = ex.getMostSpecificCause().getMessage() != null
                && ex.getMostSpecificCause().getMessage().contains("uq_project_active_name");
        if (ex.getMostSpecificCause().getMessage() != null
                && ex.getMostSpecificCause().getMessage().contains("uq_task_name")) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(WorkResponse.error(HttpStatus.CONFLICT,
                    "TASK_NAME_EXISTS", "Tên nhiệm vụ đã tồn tại trong dự án.", null));
        }
        return ResponseEntity.status(HttpStatus.CONFLICT).body(WorkResponse.error(HttpStatus.CONFLICT,
                duplicateName ? "PROJECT_NAME_EXISTS" : "DATA_CONFLICT",
                duplicateName ? "Bạn đã có dự án đang hoạt động cùng tên."
                        : "Dữ liệu đã thay đổi hoặc vi phạm điều kiện nghiệp vụ.",
                null));
    }
}

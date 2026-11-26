package vn.tasknest.workservice.api;

import org.springframework.http.HttpStatus;

public record WorkResponse<T>(boolean success, String message, T data, Object errors, String code,
        HttpStatus httpStatus) {
    public static <T> WorkResponse<T> ok(String message, T data) {
        return new WorkResponse<>(true, message, data, null, "OK", HttpStatus.OK);
    }

    public static <T> WorkResponse<T> created(String message, T data) {
        return new WorkResponse<>(true, message, data, null, "CREATED", HttpStatus.CREATED);
    }

    public static <T> WorkResponse<T> read(T data) {
        return new WorkResponse<>(true, "Tải dự án thành công.", data, null, "PROJECT_READ", HttpStatus.OK);
    }

    public static <T> WorkResponse<T> created(T data) {
        return new WorkResponse<>(true, "Tạo dự án thành công.", data, null, "PROJECT_CREATED", HttpStatus.CREATED);
    }

    public static <T> WorkResponse<T> updated(T data) {
        return new WorkResponse<>(true, "Cập nhật dự án thành công.", data, null, "PROJECT_UPDATED", HttpStatus.OK);
    }
    public static <T> WorkResponse<T> archived(T data) {
        return new WorkResponse<>(true, "Lưu trữ dự án thành công.", data, null, "PROJECT_ARCHIVED", HttpStatus.OK);
    }
    public static <T> WorkResponse<T> reopened(T data) {
        return new WorkResponse<>(true, "Mở lại dự án thành công.", data, null, "PROJECT_REOPENED", HttpStatus.OK);
    }

    public static WorkResponse<Void> error(HttpStatus status, String code, String message, Object errors) {
        return new WorkResponse<>(false, message, null, errors, code, status);
    }
}

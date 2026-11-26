package vn.tasknest.workservice.api;

import org.springframework.http.HttpStatus;

public class ApiDataResponse<T> {
    private Boolean success;
    private String message;
    private T data;
    private Object errors;
    private HttpStatus httpStatus;

    public ApiDataResponse() {}

    public ApiDataResponse(Boolean success, String message, T data, Object errors, HttpStatus httpStatus) {
        this.success = success;
        this.message = message;
        this.data = data;
        this.errors = errors;
        this.httpStatus = httpStatus;
    }

    public Boolean getSuccess() { return success; }
    public void setSuccess(Boolean success) { this.success = success; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public T getData() { return data; }
    public void setData(T data) { this.data = data; }
    public Object getErrors() { return errors; }
    public void setErrors(Object errors) { this.errors = errors; }
    public HttpStatus getHttpStatus() { return httpStatus; }
    public void setHttpStatus(HttpStatus httpStatus) { this.httpStatus = httpStatus; }
}

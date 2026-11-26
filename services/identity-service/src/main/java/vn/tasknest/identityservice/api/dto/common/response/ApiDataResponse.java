package vn.tasknest.identityservice.api.dto.common.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.http.HttpStatus;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ApiDataResponse<T> {
    private Boolean success;
    private String message;
    private T data;
    private Object errors;
    private HttpStatus httpStatus;
}

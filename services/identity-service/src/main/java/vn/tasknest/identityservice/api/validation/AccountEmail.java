package vn.tasknest.identityservice.api.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.*;

@Target({ElementType.FIELD, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = AccountEmailValidator.class)
public @interface AccountEmail {
    String message() default "Email không đúng định dạng (tối đa 64 ký tự trước @, 255 ký tự tổng cộng)";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}

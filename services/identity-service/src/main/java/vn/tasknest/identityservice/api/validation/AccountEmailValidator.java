package vn.tasknest.identityservice.api.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import vn.tasknest.identityservice.security.CredentialPolicy;

public class AccountEmailValidator implements ConstraintValidator<AccountEmail, String> {
    @Override public boolean isValid(String value, ConstraintValidatorContext context) { return CredentialPolicy.validEmail(value); }
}

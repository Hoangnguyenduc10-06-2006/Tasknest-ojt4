package vn.tasknest.identityservice.service;

import vn.tasknest.identityservice.api.dto.auth.request.RegisterRequest;
import vn.tasknest.identityservice.api.dto.auth.response.VerifyEmailResponse;
import vn.tasknest.identityservice.api.dto.user.response.UserResponse;

public interface AccountService {

    UserResponse register(RegisterRequest request);

    VerifyEmailResponse verifyEmail(String token);

    void resendVerificationEmail(String email);
}

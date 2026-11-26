package vn.tasknest.identityservice.api.dto.user.response;

import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vn.tasknest.identityservice.domain.User;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserResponse {

    private String id;
    private String fullName;
    private String jobTitle;
    private String bio;
    private Long version;
    private boolean hasAvatar;
    private String accountPurpose;
    private String onboardingStatus;
    private int onboardingStep;
    private boolean avatarPublic;
    private String email;
    private boolean emailVerified;
    private Instant createdAt;

    /** Không bao giờ đưa password_hash vào phản hồi. */
    public static UserResponse from(User user) {
        return UserResponse.builder()
            .id(user.getId())
            .fullName(user.getFullName())
            .jobTitle(user.getJobTitle()).bio(user.getBio()).version(user.getVersion())
            .hasAvatar(user.getAvatarStorageKey() != null)
            .accountPurpose(user.getAccountPurpose()).onboardingStatus(user.getOnboardingStatus())
            .onboardingStep(user.getOnboardingStep()).avatarPublic(user.isAvatarPublic())
            .email(user.getEmail())
            .emailVerified(user.isEmailVerified())
            .createdAt(user.getCreatedAt())
            .build();
    }
}

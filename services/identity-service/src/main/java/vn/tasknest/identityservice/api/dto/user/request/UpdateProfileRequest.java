package vn.tasknest.identityservice.api.dto.user.request;

import jakarta.validation.constraints.*;

/** Explicit allowlist: never bind requests directly to the account entity. */
public record UpdateProfileRequest(
    @NotBlank @Size(max=200) String fullName,
    @NotNull @Size(max=200) String jobTitle,
    @NotNull @Size(max=1000) String bio,
    @NotNull @PositiveOrZero Long version,
    @Size(max=6990508) String avatarBase64,
    Boolean avatarPublic
) {
    public UpdateProfileRequest(String name,String job,String bio,Long version,String avatar){this(name,job,bio,version,avatar,null);}
}

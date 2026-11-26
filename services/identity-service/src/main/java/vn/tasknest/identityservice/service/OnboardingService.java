package vn.tasknest.identityservice.service;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.json.JsonMapper;
import vn.tasknest.identityservice.api.dto.user.response.UserResponse;
import vn.tasknest.identityservice.domain.User;
import vn.tasknest.identityservice.exception.ValidationException;
import vn.tasknest.identityservice.repository.UserRepository;

@Service
public class OnboardingService {
    private final UserRepository users;
    private final JsonMapper json=new JsonMapper();
    public OnboardingService(UserRepository users){this.users=users;}
    public record Draft(@NotNull @Size(max=100) String company,@NotNull @Size(max=100) String location,
        @NotNull @Size(max=1000) String goals,@NotNull @Size(max=150) String headline,
        @NotNull @Size(max=2000) String about,@NotNull @Size(max=20) List<@NotBlank @Size(max=40) String> skills,
        boolean publishProfile,boolean shareAvatar) {}
    public record Input(@NotBlank @Pattern(regexp="UNDECIDED|CLIENT|DEVELOPER|BOTH") String purpose,
        @NotBlank @Pattern(regexp="IN_PROGRESS|DEFERRED|COMPLETED") String status,
        @Min(0) @Max(3) int step,@NotNull @PositiveOrZero Long version,@NotNull @Valid Draft draft) {}
    public record State(UserResponse user,Map<String,Object> draft) {}
    @Transactional(readOnly=true)
    public State get(String id) {
        var user=users.findById(id).filter(User::isEmailVerified).orElseThrow(()->new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        return state(user);
    }
    @Transactional
    public State save(String id,Input input) {
        var user=users.findByIdForUpdate(id).filter(User::isEmailVerified).orElseThrow(()->new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        if(!input.version().equals(user.getVersion()))throw new ResponseStatusException(HttpStatus.CONFLICT,"Thiết lập đã thay đổi. Tải lại dữ liệu trước khi lưu.");
        if(input.purpose().equals("UNDECIDED"))throw new ValidationException("Chọn nhu cầu sử dụng trước khi tiếp tục.");
        if(input.status().equals("COMPLETED")) {
            if(input.step()!=3)throw new ValidationException("Chọn mục đích sử dụng trước khi hoàn tất.");
            if(Set.of("CLIENT","BOTH").contains(input.purpose())&&!input.draft().goals().isBlank()&&input.draft().goals().strip().length()<20)
                throw new ValidationException("Mô tả nhu cầu hợp tác ít nhất 20 ký tự.");
            if(Set.of("DEVELOPER","BOTH").contains(input.purpose())&&(input.draft().headline().isBlank()||input.draft().about().strip().length()<20||input.draft().skills().isEmpty()))
                throw new ValidationException("Bổ sung chuyên môn, giới thiệu và ít nhất một kỹ năng.");
        }
        user.setAccountPurpose(input.purpose());user.setOnboardingStatus(input.status());user.setOnboardingStep(input.step());
        user.setOnboardingDraft(json.writeValueAsString(input.draft()));
        if(input.status().equals("COMPLETED"))user.setAvatarPublic(input.draft().shareAvatar());
        return state(users.saveAndFlush(user));
    }
    @SuppressWarnings("unchecked")
    private State state(User user){return new State(UserResponse.from(user),json.readValue(user.getOnboardingDraft(),Map.class));}
}

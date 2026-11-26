package vn.tasknest.workservice.infrastructure.identity;

import java.util.*;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.*;
import org.springframework.web.context.request.*;
import vn.tasknest.workservice.application.WorkException;

/** Internal service route is not exposed by Gateway. Return display fields only. */
@Component
public class IdentityDirectoryClient {
    private final RestClient client;
    public IdentityDirectoryClient(@Qualifier("identitySessionRestClient") RestClient client) { this.client = client; }
    public Map<String, String> names(Set<String> ids) {
        if (ids.isEmpty()) return Map.of();
        HttpServletRequest request = ((ServletRequestAttributes) RequestContextHolder.currentRequestAttributes()).getRequest();
        Map<String, String> names = new HashMap<>();
        var batch = new ArrayList<>(ids);
        try {
            for (int offset = 0; offset < batch.size(); offset += 100) {
                String values = String.join(",", batch.subList(offset, Math.min(offset + 100, batch.size())));
                DisplayUser[] result = client.get().uri(uri -> uri.path("/internal/identity/profiles").queryParam("ids", values).build())
                    .header("Authorization", request.getHeader("Authorization")).retrieve().body(DisplayUser[].class);
                if (result == null) throw new IllegalStateException();
                for (DisplayUser user : result) names.put(user.id(), user.fullName());
            }
        } catch (RestClientException | IllegalStateException ex) {
            throw new WorkException(HttpStatus.SERVICE_UNAVAILABLE, "DIRECTORY_UNAVAILABLE", "Không thể tải thông tin thành viên. Vui lòng thử lại.");
        }
        return names;
    }
    public Recipient recipient(String email) {
        HttpServletRequest request = ((ServletRequestAttributes) RequestContextHolder.currentRequestAttributes()).getRequest();
        try {
            Recipient result = client.get().uri(uri -> uri.path("/internal/identity/invitation-recipient").queryParam("email", "{email}").build(email))
                .header("Authorization", request.getHeader("Authorization")).retrieve().body(Recipient.class);
            if (result == null) throw new IllegalStateException();
            return result;
        } catch (HttpClientErrorException.NotFound ex) {
            throw new WorkException(HttpStatus.BAD_REQUEST, "INVITEE_NOT_ELIGIBLE", "Chỉ mời được tài khoản đã đăng ký và xác nhận email.");
        } catch (RestClientException | IllegalStateException ex) {
            throw new WorkException(HttpStatus.SERVICE_UNAVAILABLE, "DIRECTORY_UNAVAILABLE", "Không thể kiểm tra tài khoản nhận lời mời. Vui lòng thử lại.");
        }
    }
    public List<InvitationUser> invitationUsers(String search) {
        HttpServletRequest request = ((ServletRequestAttributes) RequestContextHolder.currentRequestAttributes()).getRequest();
        try {
            var result = client.get().uri(uri -> uri.path("/internal/identity/invitation-users").queryParam("search", "{search}").build(search))
                .header("Authorization", request.getHeader("Authorization")).retrieve().body(InvitationUser[].class);
            if (result == null) throw new IllegalStateException();
            return List.of(result);
        } catch (RestClientException | IllegalStateException ex) {
            throw new WorkException(HttpStatus.SERVICE_UNAVAILABLE, "DIRECTORY_UNAVAILABLE", "Không thể tìm tài khoản. Vui lòng thử lại.");
        }
    }
    public InvitationUser invitationUser(String id) {
        HttpServletRequest request = ((ServletRequestAttributes) RequestContextHolder.currentRequestAttributes()).getRequest();
        try {
            var result = client.get().uri("/internal/identity/invitation-users/{id}", id)
                .header("Authorization", request.getHeader("Authorization")).retrieve().body(InvitationUser.class);
            if (result == null) throw new IllegalStateException();
            return result;
        } catch (HttpClientErrorException.NotFound ex) {
            throw new WorkException(HttpStatus.BAD_REQUEST, "INVITEE_NOT_ELIGIBLE", "Chỉ mời được tài khoản đã đăng ký và xác nhận email.");
        } catch (RestClientException | IllegalStateException ex) {
            throw new WorkException(HttpStatus.SERVICE_UNAVAILABLE, "DIRECTORY_UNAVAILABLE", "Không thể kiểm tra tài khoản. Vui lòng thử lại.");
        }
    }
    public record InvitationUser(String id, String fullName) {}
    public record Recipient(String id, String email) {}
    public byte[] avatar(String id) {
        HttpServletRequest request = ((ServletRequestAttributes) RequestContextHolder.currentRequestAttributes()).getRequest();
        try {
            return client.get().uri("/internal/identity/profiles/{id}/avatar", id)
                .header("Authorization",request.getHeader("Authorization")).retrieve().body(byte[].class);
        } catch (HttpClientErrorException.NotFound ex) {
            throw new WorkException(HttpStatus.NOT_FOUND,"AVATAR_NOT_FOUND","Tài khoản chưa có ảnh đại diện.");
        } catch (RestClientException ex) {
            throw new WorkException(HttpStatus.SERVICE_UNAVAILABLE,"AVATAR_UNAVAILABLE","Không thể tải ảnh đại diện.");
        }
    }
    public record DisplayUser(String id, String fullName) {}
}

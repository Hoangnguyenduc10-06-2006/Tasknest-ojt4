package vn.tasknest.identityservice.service;

import java.io.*;
import java.util.Base64;
import java.util.UUID;
import javax.imageio.ImageIO;
import javax.imageio.stream.MemoryCacheImageInputStream;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import vn.tasknest.identityservice.api.dto.user.request.UpdateProfileRequest;
import vn.tasknest.identityservice.api.dto.user.response.UserResponse;
import vn.tasknest.identityservice.domain.User;
import vn.tasknest.identityservice.exception.ValidationException;
import vn.tasknest.identityservice.repository.UserRepository;

@Service
public class ProfileService {
    private final UserRepository users;
    private final JdbcTemplate jdbc;
    public ProfileService(UserRepository users, JdbcTemplate jdbc) { this.users=users; this.jdbc=jdbc; }
    private User account(String id) {
        return users.findByIdForUpdate(id).filter(User::isEmailVerified)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
    }
    @Transactional
    public UserResponse update(String id, UpdateProfileRequest request) {
        String name=request.fullName().trim(), job=request.jobTitle().trim(), bio=request.bio().trim();
        if (length(name)<2 || length(name)>100 || length(job)>100 || length(bio)>500)
            throw new ValidationException("Họ tên cần 2–100 ký tự, chức danh tối đa 100 và giới thiệu tối đa 500 ký tự");
        // Decode before acquiring the user row lock, with strict byte and pixel limits.
        byte[] image=request.avatarBase64()==null ? null : normalizeAvatar(request.avatarBase64());
        User user=account(id);
        if (!request.version().equals(user.getVersion())) throw new ResponseStatusException(HttpStatus.CONFLICT, "Hồ sơ đã thay đổi. Vui lòng tải lại trang trước khi lưu.");
        user.setFullName(name); user.setJobTitle(job); user.setBio(bio);
        if(request.avatarPublic()!=null)user.setAvatarPublic(request.avatarPublic());
        if (image!=null) {
            jdbc.update("INSERT INTO user_avatars(user_id,image_data) VALUES (?,?) ON DUPLICATE KEY UPDATE image_data=VALUES(image_data)", id,image);
            user.setAvatarStorageKey(UUID.randomUUID().toString());
            user.setAvatarMimeType("image/png"); user.setAvatarSizeBytes((long)image.length);
        }
        return UserResponse.from(users.saveAndFlush(user));
    }
    @Transactional(readOnly=true)
    public byte[] avatar(String id) {
        return jdbc.query("SELECT image_data FROM user_avatars WHERE user_id=?", (row,n)->row.getBytes(1),id)
            .stream().findFirst().orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }
    @Transactional(readOnly=true)
    public byte[] publicAvatar(String id) {
        if(users.findById(id).filter(user->user.isEmailVerified()&&user.isAvatarPublic()).isEmpty())
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        return avatar(id);
    }
    @Transactional
    public void saveCover(String id, String encoded, boolean visible) {
        byte[] image = normalizeAvatar(encoded);
        account(id);
        jdbc.update("""
            INSERT INTO user_profile_covers(user_id,image_data,is_public) VALUES (?,?,?) AS incoming
            ON DUPLICATE KEY UPDATE image_data=incoming.image_data,is_public=incoming.is_public
            """, id,image,visible);
    }
    @Transactional
    public void removeCover(String id) {
        account(id);
        jdbc.update("DELETE FROM user_profile_covers WHERE user_id=?", id);
    }
    @Transactional(readOnly=true)
    public byte[] cover(String id, boolean publicOnly) {
        if (publicOnly && users.findById(id).filter(User::isEmailVerified).isEmpty())
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        return jdbc.query("SELECT image_data FROM user_profile_covers WHERE user_id=? AND (?=FALSE OR is_public=TRUE)",
            (row,n)->row.getBytes(1),id,publicOnly).stream().findFirst()
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }
    private static int length(String value) { return value.codePointCount(0,value.length()); }
    static byte[] normalizeAvatar(String encoded) {
        try {
            if (encoded.length()>6990508) throw new IllegalArgumentException();
            byte[] source=Base64.getDecoder().decode(encoded);
            if (source.length==0 || source.length>5*1024*1024) throw new IllegalArgumentException();
            try (var input=new MemoryCacheImageInputStream(new ByteArrayInputStream(source))) {
                var readers=ImageIO.getImageReaders(input);
                if (!readers.hasNext()) throw new IllegalArgumentException();
                var reader=readers.next();
                try {
                    String format=reader.getFormatName();
                    if (!format.equalsIgnoreCase("png") && !format.equalsIgnoreCase("jpeg")) throw new IllegalArgumentException();
                    reader.setInput(input,true,true);
                    int width=reader.getWidth(0),height=reader.getHeight(0);
                    if (width<1 || height<1 || width>4096 || height>4096 || (long)width*height>16000000) throw new IllegalArgumentException();
                    var pixels=reader.read(0);
                    var output=new ByteArrayOutputStream();
                    if (!ImageIO.write(pixels,"png",output) || output.size()>5*1024*1024) throw new IllegalArgumentException();
                    return output.toByteArray();
                } finally { reader.dispose(); }
            }
        } catch (IOException | RuntimeException ex) {
            throw new ValidationException("Ảnh phải là PNG/JPG hợp lệ, tối đa 5 MB, kích thước tối đa 4096 × 4096 và 16 triệu điểm ảnh");
        }
    }
}

package vn.tasknest.identityservice.service;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.Base64;
import java.util.Optional;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;
import vn.tasknest.identityservice.api.dto.user.request.UpdateProfileRequest;
import vn.tasknest.identityservice.domain.User;
import vn.tasknest.identityservice.exception.ValidationException;
import vn.tasknest.identityservice.repository.UserRepository;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ProfileServiceTest {
    @Test void imageIsDecodedAndReencodedRatherThanTrustingExtension() throws Exception {
        var output=new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(2,2,BufferedImage.TYPE_INT_RGB),"png",output);
        byte[] result=ProfileService.normalizeAvatar(Base64.getEncoder().encodeToString(output.toByteArray()));
        assertNotNull(ImageIO.read(new java.io.ByteArrayInputStream(result)));
        assertThrows(ValidationException.class,()->ProfileService.normalizeAvatar(Base64.getEncoder().encodeToString("<svg/>".getBytes())));
        assertThrows(ValidationException.class,()->ProfileService.normalizeAvatar("invalid base64"));
    }
    @Test void rejectsOversizedPixelsBeforeDecoding() throws Exception {
        var output=new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(4097,1,BufferedImage.TYPE_INT_RGB),"png",output);
        assertThrows(ValidationException.class,()->ProfileService.normalizeAvatar(Base64.getEncoder().encodeToString(output.toByteArray())));
    }
    @Test void staleVersionCannotOverwriteAccount() {
        var users=mock(UserRepository.class);var jdbc=mock(JdbcTemplate.class);
        var user=new User("Old Name","user@example.test","hash");user.setEmailVerified(true);user.setVersion(2L);
        when(users.findByIdForUpdate("current-user")).thenReturn(Optional.of(user));
        var service=new ProfileService(users,jdbc);
        assertThrows(ResponseStatusException.class,()->service.update("current-user",new UpdateProfileRequest("New Name","Job","Bio",1L,null)));
        assertEquals("Old Name",user.getFullName());verify(users,never()).saveAndFlush(any());verifyNoInteractions(jdbc);
    }
    @Test void updatesOnlyProfileFieldsOfAuthenticatedAccount() {
        var users=mock(UserRepository.class);var jdbc=mock(JdbcTemplate.class);
        var user=new User("Old Name","user@example.test","hash");user.setEmailVerified(true);user.setVersion(2L);
        when(users.findByIdForUpdate("current-user")).thenReturn(Optional.of(user));
        when(users.saveAndFlush(user)).thenReturn(user);
        new ProfileService(users,jdbc).update("current-user",new UpdateProfileRequest(" New Name "," Job "," Bio ",2L,null));
        assertEquals("New Name",user.getFullName());assertEquals("Job",user.getJobTitle());assertEquals("Bio",user.getBio());
        assertEquals("user@example.test",user.getEmail());assertEquals("hash",user.getPasswordHash());verifyNoInteractions(jdbc);
    }
}

package vn.tasknest.identityservice.service;

import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;
import vn.tasknest.identityservice.domain.User;
import vn.tasknest.identityservice.exception.ValidationException;
import vn.tasknest.identityservice.repository.UserRepository;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class OnboardingServiceTest {
    private User account(){var user=new User("Người dùng","user@example.test","hash");user.setId("current");user.setEmailVerified(true);user.setVersion(2L);return user;}
    private OnboardingService.Draft draft(){return new OnboardingService.Draft("Công ty Việt","Hà Nội","Cần đội phát triển website quản lý lịch hẹn.","React Developer","Có kinh nghiệm phát triển giao diện và phối hợp bàn giao sản phẩm.",List.of("React"),false,true);}
    @Test void deferredDraftSurvivesReadsWithoutPublishingOrChangingAccountCredentials(){
        var users=mock(UserRepository.class);var user=account();
        when(users.findByIdForUpdate("current")).thenReturn(Optional.of(user));when(users.findById("current")).thenReturn(Optional.of(user));when(users.saveAndFlush(user)).thenReturn(user);
        var service=new OnboardingService(users);
        service.save("current",new OnboardingService.Input("BOTH","DEFERRED",2,2L,draft()));
        var resumed=service.get("current");assertEquals("DEFERRED",resumed.user().getOnboardingStatus());assertEquals(2,resumed.user().getOnboardingStep());assertEquals("Công ty Việt",resumed.draft().get("company"));
        assertFalse(user.isAvatarPublic());assertEquals("user@example.test",user.getEmail());assertEquals("hash",user.getPasswordHash());
    }
    @Test void staleDraftCannotOverwriteNewerProgress(){
        var users=mock(UserRepository.class);var user=account();when(users.findByIdForUpdate("current")).thenReturn(Optional.of(user));
        assertThrows(ResponseStatusException.class,()->new OnboardingService(users).save("current",new OnboardingService.Input("CLIENT","DEFERRED",2,1L,draft())));
        assertEquals("UNDECIDED",user.getAccountPurpose());verify(users,never()).saveAndFlush(any());
    }
    @Test void completionValidatesBothPurposesAndPublishesAvatarOnlyByExplicitChoice(){
        var users=mock(UserRepository.class);var user=account();when(users.findByIdForUpdate("current")).thenReturn(Optional.of(user));when(users.saveAndFlush(user)).thenReturn(user);
        var service=new OnboardingService(users);
        assertThrows(ValidationException.class,()->service.save("current",new OnboardingService.Input("UNDECIDED","COMPLETED",3,2L,draft())));
        assertThrows(ValidationException.class,()->service.save("current",new OnboardingService.Input("UNDECIDED","DEFERRED",0,2L,draft())));
        var incomplete=new OnboardingService.Draft("","","","Developer","",List.of(),false,false);
        assertThrows(ValidationException.class,()->service.save("current",new OnboardingService.Input("BOTH","COMPLETED",3,2L,incomplete)));
        service.save("current",new OnboardingService.Input("BOTH","COMPLETED",3,2L,draft()));
        assertEquals("COMPLETED",user.getOnboardingStatus());assertTrue(user.isAvatarPublic());
    }
    @Test void publicAvatarIsCanonicalAndRequiresVerifiedAccountAndOptIn(){
        var users=mock(UserRepository.class);var jdbc=mock(JdbcTemplate.class);var user=account();when(users.findById("current")).thenReturn(Optional.of(user));
        var profiles=spy(new ProfileService(users,jdbc));byte[] avatar={1,2,3};doReturn(avatar).when(profiles).avatar("current");
        assertThrows(ResponseStatusException.class,()->profiles.publicAvatar("current"));
        user.setAvatarPublic(true);assertSame(avatar,profiles.publicAvatar("current"));
        user.setEmailVerified(false);assertThrows(ResponseStatusException.class,()->profiles.publicAvatar("current"));verifyNoInteractions(jdbc);
    }
    @Test void enablingHiringDoesNotRequireAnImmediateProjectBrief() {
        var users=mock(UserRepository.class);var user=account();when(users.findByIdForUpdate("current")).thenReturn(Optional.of(user));when(users.saveAndFlush(user)).thenReturn(user);
        var details=new OnboardingService.Draft("","","","React Developer","Có kinh nghiệm phát triển giao diện và phối hợp bàn giao sản phẩm.",List.of("React"),false,false);
        new OnboardingService(users).save("current",new OnboardingService.Input("BOTH","COMPLETED",3,2L,details));
        assertEquals("BOTH",user.getAccountPurpose());assertEquals("COMPLETED",user.getOnboardingStatus());assertEquals("hash",user.getPasswordHash());assertEquals("user@example.test",user.getEmail());
    }
}

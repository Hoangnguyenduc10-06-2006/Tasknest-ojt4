package vn.tasknest.notificationservice;
import org.junit.jupiter.api.Test;
import vn.tasknest.notificationservice.application.mail.NotificationDestination;
import static org.junit.jupiter.api.Assertions.*;
class NotificationDestinationTest {
    @Test void allowsOnlyInternalApplicationDestinations() {
        for(String path:new String[]{"/messages?conversation=12","/requests/8?proposal=12&discussion=1","/teams/3?opening=9&application=24","/team-management/3?opening=9&application=24","/team-management","/teams?view=applications&application=24","/projects/5?tab=milestones&milestone=9"})assertTrue(NotificationDestination.valid(path),path);
        for(String path:new String[]{"https://evil.test","//evil.test","javascript:alert(1)","/teams/../admin","/team-management/../admin","/requests/1?redirect=https://evil.test","/requests/1%0a","/login"})assertFalse(NotificationDestination.valid(path),path);
        assertTrue(NotificationDestination.valid(null));
    }
}

package vn.tasknest.notificationservice.application.mail;

public final class NotificationDestination {
    private NotificationDestination() {}
    public static boolean valid(String path) {
        return path==null || (path.length()<=512 && path.matches("/(messages|team-management(/[1-9][0-9]*)?|teams(/[1-9][0-9]*)?|requests/[1-9][0-9]*|members/[0-9a-f-]{36}|projects/[1-9][0-9]*)(\\?[a-zA-Z][a-zA-Z0-9]*=[a-zA-Z0-9_-]+(&[a-zA-Z][a-zA-Z0-9]*=[a-zA-Z0-9_-]+)*)?"));
    }
}

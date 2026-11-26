package vn.tasknest.workservice.api.workspace;
import java.time.*;
import java.util.List;
public record WorkspaceResponse(List<Member> members, List<Task> tasks, List<TimeEntry> timeEntries,
        List<Invitation> invitations, List<JoinRequest> joinRequests, List<Progress> customerProgress) {
    public record Progress(Long projectId, long total, long done) {}
    public record Member(Long projectId, String id, String name, String role, String projectName) {}
    public record Task(Long id, Long projectId, String title, String description, String assigneeId,
        String priority, String status, LocalDate startsOn, LocalDate deadlineOn, long estimatedSeconds,
        boolean blocked, String blockedReason, Double spentSeconds, long version, Instant createdAt, Instant completedAt, Instant acceptedSubmittedAt, LocalDate acceptedDeadlineOn) {
        @com.fasterxml.jackson.annotation.JsonProperty("decision")
        public vn.tasknest.workservice.application.workspace.TaskDecision decision() {
            return vn.tasknest.workservice.application.workspace.TaskDecision.evaluate(
                status,priority,deadlineOn,blocked,estimatedSeconds,spentSeconds,
                LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")));
        }
    }
    public record TimeEntry(Long id, Long projectId, Long taskId, String taskTitle, String projectName,
        Instant startedAt, Instant endedAt, String source, long version) {}
    public record Invitation(Long id, Long projectId, String projectName, String inviterId,
        String inviterName, String inviterRole, String status, Instant createdAt, Instant expiresAt,
        boolean projectArchived) {
        public Invitation(Long id, Long projectId, String projectName, String inviterId,
                String inviterName, String inviterRole, String status, Instant createdAt, Instant expiresAt) {
            this(id, projectId, projectName, inviterId, inviterName, inviterRole, status, createdAt, expiresAt, false);
        }
    }
    public record JoinRequest(Long id, Long projectId, String projectName, String reason, String status,
        Instant createdAt, boolean projectArchived) {
        public JoinRequest(Long id, Long projectId, String projectName, String reason, String status, Instant createdAt) {
            this(id, projectId, projectName, reason, status, createdAt, false);
        }
    }
}

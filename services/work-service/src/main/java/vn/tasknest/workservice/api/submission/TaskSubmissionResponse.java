package vn.tasknest.workservice.api.submission;

import java.time.Instant;
import java.time.LocalDate;

public record TaskSubmissionResponse(long id, int number, Participant submittedBy, Participant assignee,
        Instant submittedAt, String resultNote, String resultUrl, ResultFile file, String decision,
        ReviewOutcome reviewOutcome, Participant reviewedBy, Instant reviewedAt, String rejectionReason,
        LocalDate deadlineOnSnapshot) {
    public record Participant(String id, String name) {}
    public record ResultFile(long id, String name, boolean available) {}

    /** REJECTED is the safe fallback for legacy data without an attributable review event. */
    public enum ReviewOutcome { PENDING, ACCEPTED, REWORK_REQUESTED, TASK_CANCELLED, REJECTED }
}

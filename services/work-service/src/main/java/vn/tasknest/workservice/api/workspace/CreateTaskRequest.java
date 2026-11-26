package vn.tasknest.workservice.api.workspace;
import java.time.LocalDate;
import jakarta.validation.constraints.*;
public record CreateTaskRequest(@NotBlank @Size(min=3,max=100) String title,
    @Size(max=10000) String description, @NotBlank @Pattern(regexp="[0-9a-f-]{36}") String assigneeId,
    @NotBlank @Pattern(regexp="LOW|MEDIUM|HIGH") String priority,
    @NotNull LocalDate startsOn,@NotNull LocalDate deadlineOn,@NotNull @Positive Long estimatedSeconds) {
    public CreateTaskRequest { if (title!=null) title=title.strip(); if (description!=null) description=description.strip(); }
}

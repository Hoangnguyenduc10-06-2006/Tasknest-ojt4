package vn.tasknest.workservice.api.project;

import jakarta.validation.constraints.*;
import java.time.LocalDate;

public record CreateProjectRequest(
    @NotBlank @Size(min = 3, max = 100) String name,
    @NotBlank @Size(min = 10, max = 500) String description,
    @NotNull LocalDate startsOn,
    @NotNull LocalDate endsOn
) {
    public CreateProjectRequest {
        name = name == null ? null : name.strip();
        description = description == null ? null : description.strip();
    }
    @AssertTrue(message = "Ngày kết thúc không được trước ngày bắt đầu.")
    public boolean isDateRangeValid() { return startsOn == null || endsOn == null || !endsOn.isBefore(startsOn); }
}

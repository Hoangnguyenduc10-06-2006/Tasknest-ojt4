package vn.tasknest.workservice.api.project;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

public record ProjectStatusChangeRequest(
    @NotNull @PositiveOrZero Long version
) {}

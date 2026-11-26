package vn.tasknest.workservice.application.security;

import vn.tasknest.workservice.domain.project.*;
public record ProjectAccess(Project project, ProjectRole role) {}

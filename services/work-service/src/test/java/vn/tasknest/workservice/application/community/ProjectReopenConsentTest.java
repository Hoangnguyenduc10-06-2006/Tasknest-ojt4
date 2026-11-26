package vn.tasknest.workservice.application.community;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import vn.tasknest.workservice.application.WorkException;
import vn.tasknest.workservice.application.security.ProjectPermissionService;
import vn.tasknest.workservice.application.security.WorkActor;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.*;

class ProjectReopenConsentTest {
    private static final long PROJECT = 7L;
    private static final long TEAM = 3L;
    private static final String REQUEST = "00000000-0000-4000-8000-000000000007";
    private static final String CUSTOMER = "00000000-0000-4000-8000-000000000001";
    private static final String OWNER = "00000000-0000-4000-8000-000000000002";
    private static final String MEMBER = "00000000-0000-4000-8000-000000000003";
    private static final String APPROVE_SQL =
        "UPDATE team_engagements SET status='ACTIVE',reopen_request_id=NULL,reopen_requested_by=NULL WHERE project_id=?";
    private final JdbcTemplate db = mock(JdbcTemplate.class);
    private final CommunityService service = new CommunityService(db, mock(ProjectPermissionService.class),
        null, null, null, mock(DiscoveryNotifications.class));

    private void setup(String requester) {
        when(db.queryForList("SELECT status FROM projects WHERE id=? FOR UPDATE", PROJECT))
            .thenReturn(List.of(new HashMap<>(Map.of("status", "ACTIVE"))));
        var engagement = new HashMap<String, Object>();
        engagement.put("status", "COMPLETED");
        engagement.put("team_id", TEAM);
        engagement.put("customer_user_id", CUSTOMER);
        engagement.put("reopen_request_id", requester == null ? null : REQUEST);
        engagement.put("reopen_requested_by", requester);
        when(db.queryForList("SELECT * FROM team_engagements WHERE project_id=? FOR UPDATE", PROJECT))
            .thenReturn(List.of(engagement));
        when(db.queryForList("SELECT * FROM dev_teams WHERE id=? FOR UPDATE", TEAM))
            .thenReturn(List.of(new HashMap<>(Map.of("owner_user_id", OWNER))));
    }

    @Test void requestingDoesNotUnlockProject() {
        setup(null);
        service.reopen(new WorkActor(CUSTOMER, true), PROJECT, "REQUEST", null);
        verify(db).update(eq("UPDATE team_engagements SET reopen_request_id=?,reopen_requested_by=? WHERE project_id=?"),
            anyString(), eq(CUSTOMER), eq(PROJECT));
        verify(db, never()).update(APPROVE_SQL, PROJECT);
    }

    @Test void onlyCounterpartyCanApproveTheCurrentRequest() {
        setup(CUSTOMER);
        assertThrows(WorkException.class, () -> service.reopen(new WorkActor(CUSTOMER, true), PROJECT, "APPROVE", REQUEST));
        assertThrows(WorkException.class, () -> service.reopen(new WorkActor(MEMBER, true), PROJECT, "APPROVE", REQUEST));
        assertThrows(WorkException.class, () -> service.reopen(new WorkActor(OWNER, true), PROJECT, "APPROVE", "stale"));
        verify(db, never()).update(APPROVE_SQL, PROJECT);

        service.reopen(new WorkActor(OWNER, true), PROJECT, "APPROVE", REQUEST);
        verify(db).update(APPROVE_SQL, PROJECT);
    }

    @Test void decliningClearsRequestAndKeepsProjectLocked() {
        setup(OWNER);
        service.reopen(new WorkActor(CUSTOMER, true), PROJECT, "DECLINE", REQUEST);
        verify(db).update("UPDATE team_engagements SET reopen_request_id=NULL,reopen_requested_by=NULL WHERE project_id=?", PROJECT);
        verify(db, never()).update(APPROVE_SQL, PROJECT);
    }
}

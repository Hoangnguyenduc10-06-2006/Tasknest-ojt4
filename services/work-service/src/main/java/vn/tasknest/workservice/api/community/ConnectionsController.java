package vn.tasknest.workservice.api.community;

import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import vn.tasknest.workservice.api.WorkResponse;
import vn.tasknest.workservice.application.WorkException;
import vn.tasknest.workservice.application.community.DiscoveryNotifications;
import vn.tasknest.workservice.application.security.*;
import vn.tasknest.workservice.infrastructure.identity.IdentityDirectoryClient;

@RestController
@RequestMapping("/api/work/community/connections")
public class ConnectionsController {
    private final JdbcTemplate db;
    private final ProjectPermissionService permissions;
    private final IdentityDirectoryClient directory;
    private final DiscoveryNotifications notifications;
    private final WorkRequestBudget budget;

    public ConnectionsController(JdbcTemplate db, ProjectPermissionService permissions,
            IdentityDirectoryClient directory, DiscoveryNotifications notifications, WorkRequestBudget budget) {
        this.db = db;
        this.permissions = permissions;
        this.directory = directory;
        this.notifications = notifications;
        this.budget = budget;
    }

    private record Pair(String low, String high) {}
    public record Action(String action) {}

    @GetMapping
    public WorkResponse<Map<String,Object>> list(@AuthenticationPrincipal WorkActor actor,
            @RequestParam(defaultValue = "0") int page) {
        permissions.requireVerified(actor);
        if (page < 0 || page > 10000) throw failure(HttpStatus.BAD_REQUEST, "Trang không hợp lệ.");
        String user = actor.userId();
        var rows = db.queryForList("""
            SELECT IF(user_low=?,user_high,user_low) peer, requested_by,status
            FROM account_connections c WHERE (user_low=? OR user_high=?)
              AND NOT EXISTS (SELECT 1 FROM chat_blocks b WHERE
                (b.blocker_user_id=c.user_low AND b.blocked_user_id=c.user_high)
                OR (b.blocker_user_id=c.user_high AND b.blocked_user_id=c.user_low))
            ORDER BY (status='PENDING' AND requested_by<>?) DESC, updated_at DESC, user_low, user_high
            LIMIT 21 OFFSET ?
            """, user,user,user,user,page*20);
        var visible = rows.subList(0, Math.min(rows.size(),20));
        var peers = new HashSet<String>();
        visible.forEach(row -> peers.add(row.get("peer").toString()));
        var names = peers.isEmpty() ? Map.<String,String>of() : directory.names(peers);
        return WorkResponse.read(Map.of("items",visible.stream().map(row -> {
            String peer = row.get("peer").toString();
            return Map.of("userId",peer,"name",names.getOrDefault(peer,"Thành viên TaskNest"),"state",state(user,row));
        }).toList(),"hasMore",rows.size()>20));
    }

    @GetMapping("/{peer}")
    public WorkResponse<String> get(@AuthenticationPrincipal WorkActor actor,@PathVariable UUID peer) {
        var pair = pair(actor,peer);
        return WorkResponse.read(blocked(pair) ? "UNAVAILABLE" : state(actor.userId(), row(pair,false)));
    }

    @PutMapping("/{peer}")
    @Transactional
    public WorkResponse<String> update(@AuthenticationPrincipal WorkActor actor,@PathVariable UUID peer,@RequestBody Action input) {
        var pair = pair(actor,peer);
        String user = actor.userId();
        if (!budget.consume(user,"CONNECTIONS",30)) throw failure(HttpStatus.TOO_MANY_REQUESTS,"Bạn thao tác quá nhanh. Vui lòng thử lại sau.");
        if (blocked(pair)) throw failure(HttpStatus.FORBIDDEN,"Không thể kết nối với tài khoản này.");
        String action = Objects.toString(input.action(),"");
        if (action.equals("REQUEST")) {
            directory.invitationUser(peer.toString());
            int inserted = db.update("INSERT IGNORE INTO account_connections(user_low,user_high,requested_by,status) VALUES(?,?,?,'PENDING')",pair.low(),pair.high(),user);
            if (inserted == 1) notify(user,peer.toString(),"requested","Bạn có lời mời kết bạn");
            return WorkResponse.read(state(user,row(pair,true)));
        }
        var row = row(pair,true);
        String previous = state(user,row);
        switch (action) {
            case "ACCEPT" -> {
                if (previous.equals("ACCEPTED")) return WorkResponse.read(previous);
                if (!previous.equals("INCOMING")) throw failure(HttpStatus.CONFLICT,"Bạn không có lời mời chờ chấp nhận.");
                db.update("UPDATE account_connections SET status='ACCEPTED',updated_at=UTC_TIMESTAMP(6) WHERE user_low=? AND user_high=?",pair.low(),pair.high());
                notify(user,peer.toString(),"accepted","Lời mời kết bạn đã được chấp nhận");
                return WorkResponse.read("ACCEPTED");
            }
            case "DECLINE", "CANCEL", "REMOVE" -> {
                String expected = switch(action) {
                    case "DECLINE" -> "INCOMING";
                    case "CANCEL" -> "OUTGOING";
                    default -> "ACCEPTED";
                };
                if (!previous.equals(expected)) throw failure(HttpStatus.CONFLICT,"Trạng thái kết bạn đã thay đổi.");
                db.update("DELETE FROM account_connections WHERE user_low=? AND user_high=?",pair.low(),pair.high());
                return WorkResponse.read("NONE");
            }
            default -> throw failure(HttpStatus.BAD_REQUEST,"Thao tác kết bạn không hợp lệ.");
        }
    }

    private Pair pair(WorkActor actor, UUID peer) {
        permissions.requireVerified(actor);
        String user = actor.userId(), other = peer.toString();
        if (user.equals(other)) throw failure(HttpStatus.BAD_REQUEST,"Không thể kết bạn với chính mình.");
        return user.compareTo(other)<0 ? new Pair(user,other) : new Pair(other,user);
    }

    private Map<String,Object> row(Pair pair, boolean lock) {
        var rows = db.queryForList("SELECT requested_by,status FROM account_connections WHERE user_low=? AND user_high=?" + (lock?" FOR UPDATE":""),pair.low(),pair.high());
        return rows.isEmpty() ? Map.of() : rows.getFirst();
    }

    private boolean blocked(Pair pair) {
        return db.queryForObject("""
            SELECT COUNT(*) FROM chat_blocks WHERE (blocker_user_id=? AND blocked_user_id=?)
              OR (blocker_user_id=? AND blocked_user_id=?)
            """,Long.class,pair.low(),pair.high(),pair.high(),pair.low()) > 0;
    }

    private String state(String user, Map<String,Object> row) {
        if (row.isEmpty()) return "NONE";
        if ("ACCEPTED".equals(row.get("status"))) return "ACCEPTED";
        return user.equals(row.get("requested_by")) ? "OUTGOING" : "INCOMING";
    }

    private void notify(String actor,String recipient,String type,String title) {
        notifications.send(actor,recipient,"discovery.connection."+type,"MEMBER",actor,UUID.randomUUID().toString(),title,
            "Mở hồ sơ để xem kết nối.","/members/"+actor);
    }

    private WorkException failure(HttpStatus status,String message) {
        return new WorkException(status,"CONNECTION_ACTION",message);
    }
}

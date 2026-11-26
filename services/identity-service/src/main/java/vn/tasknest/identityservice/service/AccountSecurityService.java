package vn.tasknest.identityservice.service;

import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import vn.tasknest.identityservice.repository.UserRepository;
import vn.tasknest.identityservice.security.*;

/** Account recovery and session ownership; user row serializes password changes and new logins. */
@Service
public class AccountSecurityService {
    private final JdbcTemplate db;
    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final OutboxService outbox;
    private final Clock clock;
    public AccountSecurityService(JdbcTemplate db, UserRepository users, PasswordEncoder encoder, OutboxService outbox, Clock clock) {
        this.db=db; this.users=users; this.encoder=encoder; this.outbox=outbox; this.clock=clock;
    }
    @Transactional
    public void requestReset(String email) {
        String normalized=email==null?"":email.strip().toLowerCase(Locale.ROOT);
        if(!CredentialPolicy.validEmail(normalized)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Email không hợp lệ.");
        var user=users.findByEmailForUpdate(normalized).orElse(null);
        // Same successful response for unknown/unverified/throttled accounts.
        if(user==null || !user.isEmailVerified()) return;
        var now=Timestamp.from(clock.instant());
        Long count=db.queryForObject("SELECT COUNT(*) FROM account_tokens WHERE user_id=? AND purpose='PASSWORD_RESET' AND created_at>DATE_SUB(?,INTERVAL 1 HOUR)",Long.class,user.getId(),now);
        Long recent=db.queryForObject("SELECT COUNT(*) FROM account_tokens WHERE user_id=? AND purpose='PASSWORD_RESET' AND created_at>DATE_SUB(?,INTERVAL 60 SECOND)",Long.class,user.getId(),now);
        if(count>=5 || recent>0) return;
        db.update("UPDATE account_tokens SET revoked_at=? WHERE user_id=? AND purpose='PASSWORD_RESET' AND used_at IS NULL AND revoked_at IS NULL",now,user.getId());
        String token=TokenHasher.generateOpaqueToken();
        var expiry=clock.instant().plus(Duration.ofMinutes(15));
        db.update("INSERT INTO account_tokens(user_id,purpose,issue_source,token_hash,created_at,expires_at) VALUES(?,'PASSWORD_RESET','OTHER',?,?,?)",user.getId(),TokenHasher.sha256(token),now,Timestamp.from(expiry));
        outbox.enqueuePasswordReset(user,token,expiry);
    }
    @Transactional
    public void reset(String token,String password,String confirm) {
        validate(password,confirm);
        if(token==null || !token.matches("[A-Za-z0-9_-]{32,200}")) throw invalidToken();
        var rows=db.queryForList("SELECT user_id FROM account_tokens WHERE purpose='PASSWORD_RESET' AND token_hash=?",TokenHasher.sha256(token));
        if(rows.isEmpty()) throw invalidToken();
        String id=(String)rows.getFirst().get("user_id");
        var user=users.findByIdForUpdate(id).orElseThrow(this::invalidToken);
        var now=Timestamp.from(clock.instant());
        int consumed=db.update("UPDATE account_tokens SET used_at=? WHERE user_id=? AND purpose='PASSWORD_RESET' AND token_hash=? AND used_at IS NULL AND revoked_at IS NULL AND expires_at>?",now,id,TokenHasher.sha256(token),now);
        if(consumed!=1) throw invalidToken();
        user.setPasswordHash(encoder.encode(password));
        revokeAll(id,"PASSWORD_RESET");
    }
    @Transactional
    public void change(String id,String current,String password,String confirm) {
        validate(password,confirm);
        var user=users.findByIdForUpdate(id).orElseThrow(this::invalidToken);
        if(current==null || !CredentialPolicy.validPassword(current) || !encoder.matches(current,user.getPasswordHash()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Mật khẩu hiện tại không chính xác.");
        if(encoder.matches(password,user.getPasswordHash())) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Mật khẩu mới phải khác mật khẩu hiện tại.");
        user.setPasswordHash(encoder.encode(password));
        db.update("UPDATE account_tokens SET revoked_at=? WHERE user_id=? AND purpose='PASSWORD_RESET' AND used_at IS NULL AND revoked_at IS NULL",Timestamp.from(clock.instant()),id);
        revokeAll(id,"PASSWORD_CHANGED");
    }
    public List<Map<String,Object>> sessions(String id) {
        var rows=db.queryForList("SELECT id,user_agent,created_at,expires_at,last_seen_at,revoked_at FROM auth_sessions WHERE user_id=? ORDER BY created_at DESC LIMIT 100",id);
        for(var row:rows)row.replaceAll((key,value)->value instanceof java.sql.Timestamp timestamp?timestamp.toInstant():value instanceof java.time.LocalDateTime timestamp?timestamp.toInstant(java.time.ZoneOffset.UTC):value);return rows;
    }
    @Transactional public void revoke(String user,String session) {
        var rows=db.queryForList("SELECT id FROM auth_sessions WHERE id=? AND user_id=? FOR UPDATE",session,user);
        if(rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Không tìm thấy phiên của bạn.");
        var now=Timestamp.from(clock.instant());
        db.update("UPDATE auth_sessions SET revoked_at=COALESCE(revoked_at,?),revocation_reason=COALESCE(revocation_reason,'USER_REVOKED') WHERE id=?",now,session);
        db.update("UPDATE refresh_tokens SET revoked_at=COALESCE(revoked_at,?) WHERE session_id=? AND consumed_at IS NULL",now,session);
    }
    @Transactional public void revokeAll(String id,String reason) {
        // Lock user first, as startSession does, so an old-password login cannot escape revocation.
        users.findByIdForUpdate(id).orElseThrow(this::invalidToken);
        var now=Timestamp.from(clock.instant());
        db.update("UPDATE auth_sessions SET revoked_at=?,revocation_reason=? WHERE user_id=? AND revoked_at IS NULL",now,reason,id);
        db.update("UPDATE refresh_tokens r JOIN auth_sessions s ON s.id=r.session_id SET r.revoked_at=COALESCE(r.revoked_at,?) WHERE s.user_id=? AND r.consumed_at IS NULL",now,id);
    }
    private void validate(String password,String confirm) {
        if(!CredentialPolicy.validPassword(password) || !Objects.equals(password,confirm)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Mật khẩu cần ít nhất 8 ký tự, tối đa 72 byte UTF-8 và xác nhận phải khớp.");
    }
    private ResponseStatusException invalidToken() { return new ResponseStatusException(HttpStatus.BAD_REQUEST,"Liên kết không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu liên kết mới."); }
}

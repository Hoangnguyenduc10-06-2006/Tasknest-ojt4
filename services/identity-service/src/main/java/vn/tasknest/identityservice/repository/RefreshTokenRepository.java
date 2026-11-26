package vn.tasknest.identityservice.repository;

import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vn.tasknest.identityservice.domain.RefreshToken;

@Repository
public interface RefreshTokenRepository extends JpaRepository<RefreshToken, String> {

    /** Chỉ đọc session_id (không nạp entity) để khóa phiên TRƯỚC khi khóa token. */
    @Query("select t.sessionId from RefreshToken t where t.tokenHash = :hash")
    Optional<String> findSessionIdByTokenHash(@Param("hash") byte[] hash);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from RefreshToken t where t.tokenHash = :hash")
    Optional<RefreshToken> findByTokenHashForUpdate(@Param("hash") byte[] hash);

    /** Thu hồi token đang sống của phiên (chưa dùng, chưa thu hồi). */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update RefreshToken t set t.revokedAt = :now "
        + "where t.sessionId = :sessionId and t.consumedAt is null and t.revokedAt is null")
    int revokeLiveTokensOfSession(@Param("sessionId") String sessionId, @Param("now") Instant now);
}

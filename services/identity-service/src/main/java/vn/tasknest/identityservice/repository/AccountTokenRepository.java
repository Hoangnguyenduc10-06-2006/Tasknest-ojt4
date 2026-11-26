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
import vn.tasknest.identityservice.domain.AccountToken;

@Repository
public interface AccountTokenRepository extends JpaRepository<AccountToken, Long> {

    @Query("select t.userId from AccountToken t where t.tokenHash = :hash and t.purpose = :purpose")
    Optional<String> findUserIdByTokenHash(@Param("hash") byte[] hash, @Param("purpose") String purpose);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from AccountToken t where t.tokenHash = :hash and t.purpose = :purpose")
    Optional<AccountToken> findByTokenHashForUpdate(@Param("hash") byte[] hash, @Param("purpose") String purpose);

    /** Token phát hành gần nhất (kể cả đã thu hồi) — dùng cho cooldown 60 giây. */
    Optional<AccountToken> findTopByUserIdAndPurposeOrderByCreatedAtDesc(String userId, String purpose);

    /** Đếm lịch sử phát hành trong cửa sổ — giới hạn 5 lần/giờ. */
    long countByUserIdAndPurposeAndIssueSourceAndCreatedAtAfter(String userId, String purpose, String issueSource, Instant after);

    /**
     * Thu hồi mọi token còn "active" theo DB (chưa dùng, chưa thu hồi) — kể cả token đã quá hạn nhưng chưa
     * được đánh dấu — để uq_account_token_current cho phép phát hành token mới.
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update AccountToken t set t.revokedAt = :now "
        + "where t.userId = :userId and t.purpose = :purpose and t.usedAt is null and t.revokedAt is null")
    int revokeActive(@Param("userId") String userId, @Param("purpose") String purpose, @Param("now") Instant now);
}

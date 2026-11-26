package vn.tasknest.identityservice.repository;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vn.tasknest.identityservice.domain.AuthSession;

@Repository
public interface AuthSessionRepository extends JpaRepository<AuthSession, String> {

    /** Khóa hàng phiên: tuần tự hóa xoay/thu hồi trên cùng một phiên (AUTH-05). */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from AuthSession s where s.id = :id")
    Optional<AuthSession> findByIdForUpdate(@Param("id") String id);
}

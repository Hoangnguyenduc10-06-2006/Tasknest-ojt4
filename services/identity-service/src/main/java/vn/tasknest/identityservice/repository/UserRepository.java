package vn.tasknest.identityservice.repository;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vn.tasknest.identityservice.domain.User;

@Repository
public interface UserRepository extends JpaRepository<User, String> {

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    @Query("select u from User u where u.emailVerified = true and (locate(lower(:search), lower(u.fullName)) > 0 or lower(u.email) = lower(:search)) order by u.fullName, u.id")
    java.util.List<User> findInvitationCandidates(@Param("search") String search, org.springframework.data.domain.Pageable page);


    /** Khóa hàng người dùng (SELECT ... FOR UPDATE) để tuần tự hóa gửi lại email xác nhận. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where u.email = :email")
    Optional<User> findByEmailForUpdate(@Param("email") String email);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where u.id = :id")
    Optional<User> findByIdForUpdate(@Param("id") String id);
}

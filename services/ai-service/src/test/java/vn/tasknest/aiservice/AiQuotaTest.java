package vn.tasknest.aiservice;

import vn.tasknest.aiservice.config.AiProperties;
import vn.tasknest.aiservice.application.AiException;
import vn.tasknest.aiservice.infrastructure.persistence.AiQuota;

import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.*;
import org.springframework.transaction.support.TransactionTemplate;
import static org.assertj.core.api.Assertions.*;

class AiQuotaTest {
    JdbcTemplate jdbc;
    TransactionTemplate tx;
    Clock clock = Clock.fixed(Instant.parse("2026-11-04T12:00:00Z"), ZoneOffset.UTC);
    @BeforeEach void setup() {
        String mysql = System.getenv("AI_TEST_JDBC_URL");
        var ds = new DriverManagerDataSource(mysql == null ? "jdbc:h2:mem:" + UUID.randomUUID() + ";MODE=MySQL;DB_CLOSE_DELAY=-1" : mysql,
            mysql == null ? "sa" : "root", mysql == null ? "" : System.getenv("DB_PASSWORD"));
        jdbc = new JdbcTemplate(ds); tx = new TransactionTemplate(new DataSourceTransactionManager(ds));
        jdbc.execute("DROP TABLE IF EXISTS ai_usage_buckets");
        jdbc.execute("CREATE TABLE ai_usage_buckets (bucket_key VARCHAR(120) PRIMARY KEY, request_count INT DEFAULT 0 NOT NULL, reserved_tokens INT DEFAULT 0 NOT NULL, expires_at TIMESTAMP NOT NULL)");
    }
    AiQuota quota(int userLimit, int globalLimit, int rpm, int tpm) {
        return new AiQuota(jdbc, tx, clock, new AiProperties(true, "key", "groq", "openai/gpt-oss-120b", userLimit, globalLimit, rpm, tpm, 200000, 1500));
    }
    @Test void rollsBackAllBucketsWhenUserQuotaExceeded() {
        var quota = quota(1, 100, 10, 8000);
        quota.reserve("u", 1000);
        assertThatThrownBy(() -> quota.reserve("u", 1000)).isInstanceOf(AiException.class);
        assertThat(jdbc.queryForObject("SELECT request_count FROM ai_usage_buckets WHERE bucket_key LIKE 'day:%'", Integer.class)).isEqualTo(1);
    }
    @Test void dailyGlobalQuotaCoversDifferentUsers() {
        var quota = quota(20, 1, 10, 8000); quota.reserve("u", 1000);
        assertThatThrownBy(() -> quota.reserve("v", 1000)).isInstanceOf(AiException.class);
    }
    @Test void tokenBudgetCanRejectBeforeRequestCount() {
        var quota = quota(20, 100, 10, 1500); quota.reserve("u", 1000);
        assertThatThrownBy(() -> quota.reserve("v", 1000)).isInstanceOf(AiException.class);
    }
    @Test void restartDoesNotResetCounters() {
        quota(1, 100, 10, 8000).reserve("u", 100);
        assertThatThrownBy(() -> quota(1, 100, 10, 8000).reserve("u", 100)).isInstanceOf(AiException.class);
    }
    @Test void countersResetOnVietnameseDayBoundary() {
        clock = Clock.fixed(Instant.parse("2026-11-04T16:59:59Z"), ZoneOffset.UTC);
        quota(1, 100, 10, 8000).reserve("u", 100);
        clock = Clock.fixed(Instant.parse("2026-11-04T17:00:00Z"), ZoneOffset.UTC);
        quota(1, 100, 10, 8000).reserve("u", 100);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM ai_usage_buckets WHERE bucket_key LIKE 'user:%'", Integer.class)).isEqualTo(2);
    }
    @Test void concurrentRequestsCannotExceedBudget() throws Exception {
        var quota = quota(20, 100, 2, 8000);
        try (var pool = Executors.newFixedThreadPool(6)) {
            var start = new CountDownLatch(1);
            var futures = new ArrayList<Future<Boolean>>();
            for (int i = 0; i < 6; i++) futures.add(pool.submit(() -> { start.await(); try { quota.reserve("u", 100); return true; } catch (AiException ex) { return false; } }));
            start.countDown(); int accepted = 0;
            for (var f : futures) if (f.get(10, TimeUnit.SECONDS)) accepted++;
            assertThat(accepted).isEqualTo(2);
        }
    }
}

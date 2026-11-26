package vn.tasknest.aiservice.infrastructure.persistence;

import vn.tasknest.aiservice.config.AiProperties;
import vn.tasknest.aiservice.application.AiException;

import java.time.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.http.HttpStatus;

/** Reservations are durable, atomic across replicas, and count failed upstream attempts too. */
@Component
public class AiQuota {
    private final JdbcTemplate jdbc;
    private final TransactionTemplate transactions;
    private final Clock clock;
    private final AiProperties properties;
    public AiQuota(JdbcTemplate jdbc, TransactionTemplate transactions, Clock clock, AiProperties properties) {
        this.jdbc = jdbc; this.transactions = transactions; this.clock = clock; this.properties = properties;
    }
    public void reserve(String userId, int tokens) {
        var now = clock.instant();
        var day = now.atZone(ZoneId.of("Asia/Ho_Chi_Minh")).toLocalDate();
        var dayEnd = day.plusDays(1).atStartOfDay(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant();
        // Global minute buckets serialize all reservations, then daily/global and user/day.
        var minuteEnd = Instant.ofEpochSecond((now.getEpochSecond() / 60 + 1) * 60);
        transactions.executeWithoutResult(status -> {
            claim("minute:" + now.getEpochSecond() / 60, properties.requestsPerMinute(), properties.tokensPerMinute(), tokens, minuteEnd);
            claim("day:" + day, properties.globalDailyLimit(), properties.tokensPerDay(), tokens, dayEnd);
            claim("user:" + userId + ":" + day, properties.userDailyLimit(), properties.tokensPerDay(), tokens, dayEnd);
            jdbc.update("DELETE FROM ai_usage_buckets WHERE expires_at < ?", java.sql.Timestamp.from(now.minus(Duration.ofDays(2))));
        });
    }
    private void claim(String key, int requests, int tokenLimit, int tokens, Instant end) {
        jdbc.update("INSERT INTO ai_usage_buckets (bucket_key, expires_at) VALUES (?, ?) ON DUPLICATE KEY UPDATE bucket_key = bucket_key", key, java.sql.Timestamp.from(end));
        int changed = jdbc.update("UPDATE ai_usage_buckets SET request_count = request_count + 1, reserved_tokens = reserved_tokens + ? WHERE bucket_key = ? AND request_count < ? AND reserved_tokens <= ?", tokens, key, requests, tokenLimit - tokens);
        if (changed != 1) throw new AiException(HttpStatus.TOO_MANY_REQUESTS, "AI_QUOTA_EXCEEDED", "Đã đạt hạn mức AI. Vui lòng thử lại sau.", Math.max(1, (int) Duration.between(clock.instant(), end).toSeconds()));
    }
}

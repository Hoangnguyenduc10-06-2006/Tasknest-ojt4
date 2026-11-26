package vn.tasknest.aiservice.application;

import vn.tasknest.aiservice.config.AiProperties;
import vn.tasknest.aiservice.application.AiException;
import vn.tasknest.aiservice.application.AiProvider;
import vn.tasknest.aiservice.infrastructure.persistence.AiQuota;
import vn.tasknest.aiservice.infrastructure.groq.GroqProvider;

import java.nio.charset.StandardCharsets;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class AiChatService {
    private final AiProperties properties;
    private final AiQuota quota;
    private final AiProvider provider;
    public AiChatService(AiProperties properties, AiQuota quota, AiProvider provider) {
        this.properties = properties; this.quota = quota; this.provider = provider;
    }
    public AiProvider.Answer chat(String user, String message) {
        if (!properties.configured()) throw new AiException(HttpStatus.SERVICE_UNAVAILABLE, "AI_NOT_CONFIGURED", "AI chưa được bật hoặc chưa có API key.");
        // Conservative byte upper bound plus overhead, rather than pretending characters equal tokens.
        quota.reserve(user, reservedTokens(message));
        return provider.complete(message);
    }
    public int contextBudget(String prompt) {
        return Math.max(0, Math.min(properties.tokensPerMinute(), properties.tokensPerDay()) - reservedTokens(prompt));
    }
    private int reservedTokens(String prompt) {
        return (GroqProvider.SYSTEM + prompt).getBytes(StandardCharsets.UTF_8).length + 256 + properties.maxCompletionTokens();
    }
}

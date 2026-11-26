package vn.tasknest.aiservice.config;



import jakarta.validation.constraints.*;
import org.springframework.boot.context.properties.bind.ConstructorBinding;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties("tasknest.ai")
public record AiProperties(boolean enabled, String apiKey,
        @NotBlank @Pattern(regexp = "groq|openrouter") String provider,
        @NotBlank @Pattern(regexp = "[A-Za-z0-9._:/-]{1,120}") String model,
        String fallbackApiKey,
        @Pattern(regexp = "groq|openrouter") String fallbackProvider,
        @Pattern(regexp = "[A-Za-z0-9._:/-]{1,120}") String fallbackModel,
        @Min(1) @Max(200) int userDailyLimit,
        @Min(1) @Max(1000) int globalDailyLimit,
        @Min(1) @Max(10) int requestsPerMinute,
        @Min(1) @Max(8000) int tokensPerMinute,
        @Min(1) @Max(200000) int tokensPerDay,
        @Min(256) @Max(1500) int maxCompletionTokens) {
    @ConstructorBinding
    public AiProperties {
        if (fallbackProvider == null || fallbackProvider.isBlank()) fallbackProvider = "openrouter";
        if (fallbackModel == null || fallbackModel.isBlank()) fallbackModel = "openrouter/free";
    }

    public AiProperties(boolean enabled, String apiKey, String provider, String model,
            int userDailyLimit, int globalDailyLimit, int requestsPerMinute,
            int tokensPerMinute, int tokensPerDay, int maxCompletionTokens) {
        this(enabled, apiKey, provider, model, "", "openrouter", "openrouter/free",
            userDailyLimit, globalDailyLimit, requestsPerMinute, tokensPerMinute,
            tokensPerDay, maxCompletionTokens);
    }
    public boolean configured() { return enabled && apiKey != null && !apiKey.isBlank(); }
    public boolean fallbackConfigured() {
        return enabled && fallbackApiKey != null && !fallbackApiKey.isBlank()
            && (!provider.equals(fallbackProvider) || !model.equals(fallbackModel));
    }
    @Override public String toString() {
        return "AiProperties[enabled=" + enabled + ", provider=" + provider + ", model=" + model
            + ", fallbackProvider=" + fallbackProvider + ", fallbackModel=" + fallbackModel + "]";
    }
}

package vn.tasknest.aiservice.config;



import java.time.*;
import org.springframework.cloud.client.loadbalancer.LoadBalanced;
import org.springframework.context.annotation.*;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

@Configuration
public class AiConfiguration {
    @Bean Clock aiClock() { return Clock.systemUTC(); }
    @Bean @Primary RestClient.Builder directRestClientBuilder() { return RestClient.builder(); }
    @Bean @LoadBalanced RestClient.Builder aiIdentityBuilder() { return RestClient.builder().requestFactory(factory(3)); }
    @Bean RestClient aiIdentityClient(@org.springframework.beans.factory.annotation.Qualifier("aiIdentityBuilder") RestClient.Builder builder) {
        return builder.baseUrl("http://identity-service").build();
    }
    @Bean RestClient aiWorkClient(@org.springframework.beans.factory.annotation.Qualifier("aiIdentityBuilder") RestClient.Builder builder) {
        return builder.clone().baseUrl("http://work-service").build();
    }
    @Bean RestClient aiProviderClient(AiProperties properties) {
        return providerClient(properties.provider());
    }
    @Bean RestClient aiFallbackProviderClient(AiProperties properties) {
        return providerClient(properties.fallbackProvider());
    }
    private static RestClient providerClient(String provider) {
        // Providers are an allowlist, never a user-controlled URL.
        String origin = switch (provider) {
            case "groq" -> "https://api.groq.com/openai/v1";
            case "openrouter" -> "https://openrouter.ai/api/v1";
            default -> throw new IllegalStateException("Unsupported AI provider");
        };
        return RestClient.builder().baseUrl(origin).requestFactory(factory(40)).build();
    }
    private static JdkClientHttpRequestFactory factory(int seconds) {
        var factory = new JdkClientHttpRequestFactory(java.net.http.HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(3)).build());
        factory.setReadTimeout(Duration.ofSeconds(seconds));
        return factory;
    }
}

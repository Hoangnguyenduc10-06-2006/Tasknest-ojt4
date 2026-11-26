package vn.tasknest.notificationservice.application.mail;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

@Configuration
@ConditionalOnProperty(name="tasknest.mail.enabled", havingValue="true")
public class MailConfiguration {
    @Bean
    RestClient brevoClient(@Value("${tasknest.mail.api-key}") String key,
                          @Value("${tasknest.mail.api-base:https://api.brevo.com/v3}") String base) {
        if (key.isBlank()) throw new IllegalStateException("BREVO_API_KEY is required when mail is enabled");
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5000); factory.setReadTimeout(10000);
        return RestClient.builder().baseUrl(base).requestFactory(factory).defaultHeader("api-key", key).build();
    }
}

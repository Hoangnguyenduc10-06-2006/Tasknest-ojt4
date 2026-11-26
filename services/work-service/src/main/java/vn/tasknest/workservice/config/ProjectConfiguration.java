package vn.tasknest.workservice.config;

import java.time.Clock;
import java.time.Duration;
import org.springframework.cloud.client.loadbalancer.LoadBalanced;
import org.springframework.context.annotation.*;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

@Configuration
public class ProjectConfiguration {
    @Bean Clock workClock() { return Clock.systemUTC(); }
    // Eureka/config/bootstrap clients use physical URLs and must not receive a load-balanced builder.
    @Bean @Primary RestClient.Builder directRestClientBuilder() { return RestClient.builder(); }
    @Bean @LoadBalanced RestClient.Builder identitySessionClientBuilder() {
        var factory = new JdkClientHttpRequestFactory(java.net.http.HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(2)).build());
        factory.setReadTimeout(Duration.ofSeconds(3));
        return RestClient.builder().requestFactory(factory);
    }
    @Bean RestClient identitySessionRestClient(@org.springframework.beans.factory.annotation.Qualifier("identitySessionClientBuilder") RestClient.Builder builder) {
        return builder.baseUrl("http://identity-service").build();
    }
}

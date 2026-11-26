package vn.tasknest.notificationservice.config;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.time.Duration;
import java.util.List;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.cloud.client.loadbalancer.LoadBalanced;
import org.springframework.context.annotation.*;
import org.springframework.core.annotation.Order;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.AnonymousAuthenticationFilter;
import org.springframework.web.client.*;
import org.springframework.web.filter.OncePerRequestFilter;

@Configuration
public class InboxSecurityConfiguration {
    @Bean @Primary RestClient.Builder directNotificationBuilder() { return RestClient.builder(); }
    @Bean @LoadBalanced RestClient.Builder notificationIdentityBuilder() {
        var factory = new JdkClientHttpRequestFactory(java.net.http.HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build());
        factory.setReadTimeout(Duration.ofSeconds(3));
        return RestClient.builder().requestFactory(factory);
    }
    @Bean RestClient notificationIdentityClient(@Qualifier("notificationIdentityBuilder") RestClient.Builder builder) {
        return builder.baseUrl("http://identity-service").build();
    }
    @Bean @Order(1) SecurityFilterChain inboxSecurity(HttpSecurity http,@Qualifier("notificationIdentityClient") RestClient client) throws Exception {
        return http.securityMatcher("/api/notifications/inbox", "/api/notifications/inbox/**")
            .authorizeHttpRequests(auth -> auth.anyRequest().authenticated())
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .requestCache(cache -> cache.disable()).httpBasic(basic -> basic.disable()).formLogin(form -> form.disable())
            .csrf(csrf -> csrf.ignoringRequestMatchers("/api/notifications/inbox", "/api/notifications/inbox/**"))
            .addFilterBefore(new InboxFilter(client), AnonymousAuthenticationFilter.class).build();
    }
    static final class InboxFilter extends OncePerRequestFilter {
        private final RestClient client;
        InboxFilter(RestClient client) { this.client=client; }
        @Override protected void doFilterInternal(jakarta.servlet.http.HttpServletRequest request,jakarta.servlet.http.HttpServletResponse response,jakarta.servlet.FilterChain chain) throws java.io.IOException,jakarta.servlet.ServletException {
            var headers=java.util.Collections.list(request.getHeaders("Authorization"));
            if(headers.size()!=1 || !headers.getFirst().matches("(?i)Bearer [A-Za-z0-9._~-]+")) { fail(response,401); return; }
            try {
                Envelope envelope=client.get().uri("/api/identity/auth/session").header("Authorization",headers.getFirst()).retrieve().body(Envelope.class);
                if(envelope==null || !Boolean.TRUE.equals(envelope.success()) || envelope.data()==null) { fail(response,503); return; }
                if(!envelope.data().emailVerified()) { fail(response,403); return; }
                String id=envelope.data().id();
                if(id==null || !java.util.UUID.fromString(id).toString().equals(id)) { fail(response,503); return; }
                var context=SecurityContextHolder.createEmptyContext();
                context.setAuthentication(UsernamePasswordAuthenticationToken.authenticated(id,null,List.of()));
                SecurityContextHolder.setContext(context);
            } catch(HttpClientErrorException.Unauthorized ex) { fail(response,401); return; }
            catch(RestClientException | IllegalArgumentException ex) { fail(response,503); return; }
            chain.doFilter(request,response);
        }
        private void fail(jakarta.servlet.http.HttpServletResponse response,int status) throws java.io.IOException {
            SecurityContextHolder.clearContext(); response.setStatus(status);response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"message\":\"Không thể xác thực quyền xem thông báo.\"}");
        }
    }
    @JsonIgnoreProperties(ignoreUnknown=true) public record Envelope(Boolean success, User data) {}
    @JsonIgnoreProperties(ignoreUnknown=true) public record User(String id,boolean emailVerified) {}
}

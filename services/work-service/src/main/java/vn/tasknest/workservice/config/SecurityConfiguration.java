package vn.tasknest.workservice.config;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.authentication.AnonymousAuthenticationFilter;
import tools.jackson.databind.ObjectMapper;
import vn.tasknest.workservice.application.security.IdentitySessionVerifier;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
@Configuration
public class SecurityConfiguration {
    @Bean
    SecurityFilterChain security(HttpSecurity http, IdentitySessionVerifier verifier, ObjectMapper mapper) throws Exception {
        return http.authorizeHttpRequests(auth -> auth
                .requestMatchers(org.springframework.http.HttpMethod.GET,
                    "/api/work/community/teams", "/api/work/community/teams/{id}", "/api/work/community/members/{id}",
                    "/api/work/community/requests", "/api/work/community/requests/{id}",
                    "/api/work/community/feed", "/api/work/community/post-images/*/*/*", "/api/work/community/openings", "/api/work/community/teams/{id}/openings", "/api/work/community/teams/{id}/cover").permitAll()
                .requestMatchers("/ws/work", "/api/work/status", "/actuator/health", "/actuator/health/**").permitAll()
                .requestMatchers("/api/work/projects", "/api/work/projects/**", "/api/work/community/**").authenticated()
                .anyRequest().denyAll())
            .exceptionHandling(errors -> errors.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .requestCache(cache -> cache.disable())
            .httpBasic(basic -> basic.disable()).formLogin(form -> form.disable())
            .addFilterBefore(new WorkBearerFilter(verifier, mapper), AnonymousAuthenticationFilter.class)
            // Project APIs accept Authorization only; cookie-based Identity endpoints retain CSRF.
            .csrf(csrf -> csrf.ignoringRequestMatchers("/api/work/projects", "/api/work/projects/**", "/api/work/community/**"))
            .build();
    }
}

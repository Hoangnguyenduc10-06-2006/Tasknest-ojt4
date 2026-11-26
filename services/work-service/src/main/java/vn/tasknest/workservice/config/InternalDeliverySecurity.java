package vn.tasknest.workservice.config;
import org.springframework.context.annotation.*;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;
@Configuration
public class InternalDeliverySecurity {
    @Bean @Order(0) SecurityFilterChain internalDelivery(HttpSecurity http, @org.springframework.beans.factory.annotation.Value("${SCAFFOLD_SECURITY_PASSWORD}") String password) throws Exception {
        return http.securityMatcher("/internal/work/delivery").authorizeHttpRequests(a->a.anyRequest().authenticated()).authenticationManager(authentication -> { if (!"disabled-scaffold-user".equals(authentication.getName()) || !java.security.MessageDigest.isEqual(password.getBytes(java.nio.charset.StandardCharsets.UTF_8),authentication.getCredentials().toString().getBytes(java.nio.charset.StandardCharsets.UTF_8))) throw new org.springframework.security.authentication.BadCredentialsException("Invalid service credentials"); return org.springframework.security.authentication.UsernamePasswordAuthenticationToken.authenticated(authentication.getName(), null, java.util.List.of()); }).httpBasic(org.springframework.security.config.Customizer.withDefaults()).csrf(c->c.disable()).sessionManagement(s->s.sessionCreationPolicy(org.springframework.security.config.http.SessionCreationPolicy.STATELESS)).build();
    }
}

package vn.tasknest.aiservice.config;

import vn.tasknest.aiservice.application.AiException;
import vn.tasknest.aiservice.infrastructure.identity.IdentitySessions;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.util.*;
import org.springframework.context.annotation.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.*;
import org.springframework.security.web.authentication.AnonymousAuthenticationFilter;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.http.HttpStatus;
import org.springframework.web.filter.OncePerRequestFilter;
import tools.jackson.databind.ObjectMapper;

@Configuration
public class AiSecurity {
    @Bean SecurityFilterChain security(HttpSecurity http, IdentitySessions sessions, ObjectMapper mapper) throws Exception {
        return http.authorizeHttpRequests(a -> a
                .requestMatchers("/actuator/health", "/actuator/health/**").permitAll()
                .requestMatchers("/api/ai/**").authenticated().anyRequest().denyAll())
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .requestCache(c -> c.disable()).httpBasic(c -> c.disable()).formLogin(c -> c.disable())
            .exceptionHandling(e -> e.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
            .csrf(c -> c.ignoringRequestMatchers("/api/ai/**"))
            .addFilterBefore(new BearerFilter(sessions, mapper), AnonymousAuthenticationFilter.class).build();
    }
    static final class BearerFilter extends OncePerRequestFilter {
        private final IdentitySessions sessions;
        private final ObjectMapper mapper;
        BearerFilter(IdentitySessions sessions, ObjectMapper mapper) { this.sessions = sessions; this.mapper = mapper; }
        @Override protected boolean shouldNotFilter(HttpServletRequest r) { return !r.getRequestURI().startsWith("/api/ai/"); }
        @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
            try {
                var headers = Collections.list(request.getHeaders("Authorization"));
                if (headers.size() != 1 || !headers.getFirst().matches("(?i)Bearer [A-Za-z0-9._~-]+"))
                    throw new AiException(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "Vui lòng đăng nhập.");
                String user = sessions.verify(headers.getFirst().substring(7));
                var context = SecurityContextHolder.createEmptyContext();
                context.setAuthentication(UsernamePasswordAuthenticationToken.authenticated(user, null, List.of()));
                SecurityContextHolder.setContext(context);
            } catch (AiException ex) {
                SecurityContextHolder.clearContext();
                response.setStatus(ex.status().value()); response.setContentType("application/json;charset=UTF-8");
                mapper.writeValue(response.getOutputStream(), Map.of("success", false, "code", ex.code(), "message", ex.getMessage()));
                return;
            }
            // Bound JSON before deserialization, including chunked requests.
            if ("POST".equals(request.getMethod())) {
                byte[] body = request.getInputStream().readNBytes(8193);
                if (body.length > 8192) {
                    response.setStatus(413); response.setContentType("application/json;charset=UTF-8");
                    mapper.writeValue(response.getOutputStream(), Map.of("success", false, "code", "PAYLOAD_TOO_LARGE", "message", "Nội dung yêu cầu quá lớn."));
                    return;
                }
                request = new HttpServletRequestWrapper(request) {
                    @Override public ServletInputStream getInputStream() {
                        var input = new java.io.ByteArrayInputStream(body);
                        return new ServletInputStream() {
                            @Override public int read() { return input.read(); }
                            @Override public boolean isFinished() { return input.available() == 0; }
                            @Override public boolean isReady() { return true; }
                            @Override public void setReadListener(ReadListener listener) { throw new UnsupportedOperationException(); }
                        };
                    }
                };
            }
            response.setHeader("Cache-Control", "no-store");
            chain.doFilter(request, response);
        }
    }
}

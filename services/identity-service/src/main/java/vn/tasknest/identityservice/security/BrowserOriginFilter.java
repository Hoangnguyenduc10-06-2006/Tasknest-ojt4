package vn.tasknest.identityservice.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.http.HttpMethod;
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher;
import org.springframework.security.web.util.matcher.RequestMatcher;
import org.springframework.web.filter.OncePerRequestFilter;
import vn.tasknest.identityservice.config.IdentityProperties;

/** Origin policy complements CSRF; it is not a replacement for a valid CSRF token. */
public class BrowserOriginFilter extends OncePerRequestFilter {
    private static final List<RequestMatcher> REQUESTS = List.of(
        PathPatternRequestMatcher.withDefaults().matcher(HttpMethod.PUT, "/api/identity/profile"),
        PathPatternRequestMatcher.withDefaults().matcher(HttpMethod.PUT, "/api/identity/profile/cover"),
        PathPatternRequestMatcher.withDefaults().matcher(HttpMethod.DELETE, "/api/identity/profile/cover"),
        PathPatternRequestMatcher.withDefaults().matcher(HttpMethod.PUT, "/api/identity/onboarding"),
        PathPatternRequestMatcher.withDefaults().matcher(HttpMethod.POST, "/api/identity/auth/login"),
        PathPatternRequestMatcher.withDefaults().matcher(HttpMethod.POST, "/api/identity/auth/refresh-token"),
        PathPatternRequestMatcher.withDefaults().matcher(HttpMethod.POST, "/api/identity/auth/logout"));
    private final IdentityProperties properties;
    public BrowserOriginFilter(IdentityProperties properties) { this.properties = properties; }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
        throws ServletException, IOException {
        if (REQUESTS.stream().anyMatch(matcher -> matcher.matches(request)) || (request.getMethod().equals("POST") && (request.getRequestURI().startsWith("/api/identity/auth/sessions/") || List.of("/api/identity/auth/change-password","/api/identity/auth/logout-all","/api/identity/auth/forgot-password","/api/identity/auth/reset-password").contains(request.getRequestURI())))) {
            String origin = request.getHeader("Origin");
            if (origin == null || !properties.getAllowedOrigins().contains(origin)) {
                response.setStatus(403);
                response.setCharacterEncoding("UTF-8");
                response.setContentType("application/json");
                response.getWriter().write("{\"success\":false,\"message\":\"Origin không được phép\",\"status\":\"FORBIDDEN\"}");
                return;
            }
        }
        String path=request.getRequestURI();
        if(request.getMethod().equals("POST") && (path.startsWith("/api/identity/auth/sessions/") || List.of("/api/identity/auth/change-password","/api/identity/auth/logout-all").contains(path))) {
            String supplied=request.getHeader("X-XSRF-TOKEN"),cookie=null;
            if(request.getCookies()!=null)for(var item:request.getCookies())if(item.getName().equals("XSRF-TOKEN"))cookie=item.getValue();
            if(supplied==null||cookie==null||supplied.length()>200||!java.security.MessageDigest.isEqual(supplied.getBytes(java.nio.charset.StandardCharsets.UTF_8),cookie.getBytes(java.nio.charset.StandardCharsets.UTF_8))) { response.setStatus(403);response.setContentType("application/json;charset=UTF-8");response.getWriter().write("{\"message\":\"Yêu cầu thiếu bảo vệ CSRF hợp lệ.\"}");return; }
        }
        chain.doFilter(request, response);
    }
}

package vn.tasknest.workservice.config;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;
import tools.jackson.databind.ObjectMapper;
import vn.tasknest.workservice.api.WorkResponse;
import vn.tasknest.workservice.application.WorkException;
import vn.tasknest.workservice.application.security.IdentitySessionVerifier;

/** Deliberately not a servlet bean: installed only inside Spring Security's filter chain. */
public class WorkBearerFilter extends OncePerRequestFilter {
    private final IdentitySessionVerifier verifier;
    private final ObjectMapper mapper;
    public WorkBearerFilter(IdentitySessionVerifier verifier, ObjectMapper mapper) { this.verifier = verifier; this.mapper = mapper; }
    @Override protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI().substring(request.getContextPath().length());
        if (path.startsWith("/api/work/community/")) {
            boolean publicRead = request.getMethod().equals("GET") && (
                path.equals("/api/work/community/teams")
                || path.equals("/api/work/community/requests")
                || path.equals("/api/work/community/feed")
                || path.matches("/api/work/community/post-images/(REQUEST|OPENING)/[1-9][0-9]*/[1-4]")
                || path.equals("/api/work/community/openings")
                || path.matches("/api/work/community/teams/[1-9][0-9]*/(openings|cover)")
                || path.matches("/api/work/community/requests/[1-9][0-9]*")
                || path.matches("/api/work/community/teams/[1-9][0-9]*")
                || path.matches("/api/work/community/members/[0-9a-f-]{36}"));
            return publicRead && request.getHeader("Authorization") == null;
        }
        return !path.equals("/api/work/projects") && !path.startsWith("/api/work/projects/");
    }
    @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        try {
            List<String> headers = java.util.Collections.list(request.getHeaders("Authorization"));
            if (headers.size() != 1 || !headers.getFirst().matches("(?i)Bearer [A-Za-z0-9._~-]+"))
                throw new WorkException(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "Vui lòng gửi Access Token hợp lệ.");
            var actor = verifier.verify(headers.getFirst().substring(7));
            if (!actor.emailVerified()) throw new WorkException(HttpStatus.FORBIDDEN, "EMAIL_NOT_VERIFIED", "Vui lòng xác nhận email.");
            var context = SecurityContextHolder.createEmptyContext();
            context.setAuthentication(UsernamePasswordAuthenticationToken.authenticated(actor, null, List.of()));
            SecurityContextHolder.setContext(context);
        } catch (WorkException ex) {
            SecurityContextHolder.clearContext(); response.setStatus(ex.status().value());
            response.setContentType("application/json;charset=UTF-8");
            mapper.writeValue(response.getOutputStream(), WorkResponse.error(ex.status(), ex.code(), ex.getMessage(), null));
            return;
        }
        chain.doFilter(request, response);
    }
}

package vn.tasknest.apigateway.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.web.server.SecurityWebFilterChain;
import org.springframework.security.web.server.authentication.HttpStatusServerEntryPoint;
import org.springframework.security.web.server.csrf.CsrfWebFilter;
import org.springframework.security.web.server.util.matcher.AndServerWebExchangeMatcher;
import org.springframework.security.web.server.util.matcher.NegatedServerWebExchangeMatcher;
import org.springframework.security.web.server.util.matcher.ServerWebExchangeMatchers;

@Configuration
public class SecurityConfiguration {

    @Bean
    SecurityWebFilterChain security(ServerHttpSecurity http,
            @org.springframework.beans.factory.annotation.Qualifier("projectSessionAuthorization")
            org.springframework.security.authorization.ReactiveAuthorizationManager<org.springframework.security.web.server.authorization.AuthorizationContext> projects) {
        return http.authorizeExchange(auth -> auth
                .pathMatchers(org.springframework.http.HttpMethod.GET,
                    "/api/work/community/teams", "/api/work/community/teams/{id}", "/api/work/community/members/{id}",
                    "/api/work/community/requests", "/api/work/community/requests/{id}",
                    "/api/work/community/feed", "/api/work/community/post-images/*/*/*", "/api/work/community/openings", "/api/work/community/teams/{id}/openings", "/api/work/community/teams/{id}/cover").permitAll()
                .pathMatchers("/api/work/community/**").access(projects)
                .pathMatchers("/api/ai/**", "/api/work/projects", "/api/work/projects/**", "/api/notifications/inbox", "/api/notifications/inbox/**").access(projects)
                .pathMatchers(
                        "/actuator/health",
                        "/actuator/health/**",
                        "/ws/work",
                        "/api/status",
                        "/api/identity/status",
                        "/api/identity/register",
                        "/api/identity/auth/forgot-password", "/api/identity/auth/reset-password",
                        "/api/identity/auth/change-password", "/api/identity/auth/sessions", "/api/identity/auth/sessions/*/revoke", "/api/identity/auth/logout-all",
                        "/api/identity/auth/register",
                        "/api/identity/login",
                        "/api/identity/auth/login",
                        "/api/identity/auth/session",
                        "/api/identity/profile",
                        "/api/identity/profile/avatar", "/api/identity/profile/cover", "/api/identity/public/covers/*",
                        "/api/identity/onboarding", "/api/identity/public/avatars/*",
                        "/api/identity/refresh-token",
                        "/api/identity/auth/refresh-token",
                        "/api/identity/logout",
                        "/api/identity/auth/logout",
                        "/api/identity/verify-email",
                        "/api/identity/auth/verify-email",
                        "/api/identity/resend-verification",
                        "/api/identity/auth/resend-verification",
                        "/api/identity/.well-known/**",
                        "/.well-known/**",
                        "/api/v1/auth/**",
                        "/api/work/status",
                        "/api/notifications/status")
                .permitAll()
                .anyExchange().denyAll())
                .exceptionHandling(errors -> errors
                        .authenticationEntryPoint(new HttpStatusServerEntryPoint(HttpStatus.UNAUTHORIZED)))
                .csrf(csrf -> csrf.requireCsrfProtectionMatcher(
                        new AndServerWebExchangeMatcher(
                                CsrfWebFilter.DEFAULT_CSRF_MATCHER,
                                new NegatedServerWebExchangeMatcher(
                                        ServerWebExchangeMatchers.pathMatchers(
                                                "/api/ai/**", "/api/identity/**", "/api/work/projects", "/api/work/projects/**", "/api/work/community/**",
                                                "/api/notifications/inbox", "/api/notifications/inbox/**",
                                                "/.well-known/**",
                                                "/api/v1/auth/**")))))
                .build();
    }
}

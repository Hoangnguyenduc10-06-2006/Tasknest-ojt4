package vn.tasknest.identityservice.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;

/**
 * Cấu hình an ninh mạng và chuỗi lọc bảo mật cho {@code identity-service}.
 * 
 * <p>Nguyên tắc phân quyền & CSRF (SEC-07):
 * <ul>
 *   <li>Chỉ mở (permitAll) các endpoint công khai theo đúng phương thức HTTP được chỉ định (Method-specific).</li>
 *   <li>Tất cả các endpoint khác đều bị chặn mặc định bằng {@code anyRequest().denyAll()}.</li>
 *   <li>Các endpoint không xác thực qua cookie (register, login, resend) được miễn kiểm tra CSRF (CSRF exempt).</li>
 *   <li>Các endpoint thay đổi trạng thái xác thực qua Cookie HttpOnly (refresh-token, logout) <b>bắt buộc</b>
 *       phải có CSRF token hợp lệ thông qua header {@code X-XSRF-TOKEN} và cookie {@code XSRF-TOKEN}.</li>
 * </ul>
 */
@Configuration
@EnableConfigurationProperties(IdentityProperties.class)
public class SecurityConfiguration {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    SecurityFilterChain security(HttpSecurity http, IdentityProperties properties) throws Exception {
        CsrfTokenRequestAttributeHandler requestHandler = new CsrfTokenRequestAttributeHandler();
        // Cho phép đọc CSRF token từ cả request header X-XSRF-TOKEN lẫn request attribute
        requestHandler.setCsrfRequestAttributeName(null);

        return http
            .authorizeHttpRequests(auth -> auth
                .dispatcherTypeMatchers(jakarta.servlet.DispatcherType.ERROR).permitAll()
                .requestMatchers(HttpMethod.GET, "/api/identity/auth/session", "/internal/identity/profiles", "/internal/identity/profiles/*/avatar", "/internal/identity/invitation-recipient", "/internal/identity/invitation-users", "/internal/identity/invitation-users/*").authenticated()
                .requestMatchers(HttpMethod.GET, "/api/identity/auth/sessions").authenticated()
                .requestMatchers(HttpMethod.POST, "/api/identity/auth/change-password", "/api/identity/auth/logout-all", "/api/identity/auth/sessions/*/revoke").authenticated()
                .requestMatchers(HttpMethod.PUT, "/api/identity/profile", "/api/identity/onboarding").authenticated()
                .requestMatchers(HttpMethod.GET, "/api/identity/onboarding").authenticated()
                .requestMatchers(HttpMethod.GET, "/api/identity/public/avatars/*", "/api/identity/public/covers/*").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/identity/profile/avatar", "/api/identity/profile/cover").authenticated()
                .requestMatchers(HttpMethod.PUT, "/api/identity/profile/cover").authenticated()
                .requestMatchers(HttpMethod.DELETE, "/api/identity/profile/cover").authenticated()
                // Endpoint GET công khai
                .requestMatchers(HttpMethod.GET,
                    "/api/identity/status",
                    "/api/identity/auth/verify-email",
                    "/api/identity/.well-known/**",
                    "/api/identity/auth/.well-known/**",
                    "/actuator/health",
                    "/actuator/health/**"
                ).permitAll()
                // Endpoint POST xác thực công khai
                .requestMatchers(HttpMethod.POST,
                    "/api/identity/auth/forgot-password",
                    "/api/identity/auth/reset-password",
                    "/api/identity/auth/register",
                    "/api/identity/auth/login",
                    "/api/identity/auth/resend-verification",
                    "/api/identity/auth/refresh-token",
                    "/api/identity/auth/logout"
                ).permitAll()
                // Chặn toàn bộ các request không nằm trong danh sách cho phép
                .anyRequest().denyAll()
            )
            .addFilterBefore(new vn.tasknest.identityservice.security.BrowserOriginFilter(properties), org.springframework.security.web.csrf.CsrfFilter.class)
            .oauth2ResourceServer(resource -> resource.jwt(org.springframework.security.config.Customizer.withDefaults()))
            .exceptionHandling(errors -> errors.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
            .csrf(csrf -> csrf
                // Lưu CSRF token vào cookie XSRF-TOKEN để phía Frontend (hoặc Postman) đọc được và gửi lại qua header X-XSRF-TOKEN
                .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
                .csrfTokenRequestHandler(requestHandler)
                // Các endpoint chỉ nhận JSON body không dùng cookie thì không cần CSRF token
                .ignoringRequestMatchers(
                    "/api/identity/auth/forgot-password",
                    "/api/identity/auth/reset-password",
                    "/api/identity/auth/register",
                    "/api/identity/auth/login",
                    "/api/identity/auth/resend-verification",
                    "/api/identity/status",
                    "/actuator/**"
                )
            )
            .build();
    }
}

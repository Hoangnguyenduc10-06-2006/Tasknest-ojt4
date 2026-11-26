package vn.tasknest.apigateway.config;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.core.Ordered;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;
@Component
public class CorrelationFilter implements WebFilter, Ordered {
    private static final Pattern SAFE_ID = Pattern.compile("[A-Za-z0-9_-]{1,64}");
    @Override public int getOrder() { return Ordered.HIGHEST_PRECEDENCE; }
    @Override public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
        String incoming = exchange.getRequest().getHeaders().getFirst("X-Correlation-ID");
        String id = incoming != null && SAFE_ID.matcher(incoming).matches() ? incoming : UUID.randomUUID().toString();
        var request = exchange.getRequest().mutate().headers(headers -> {
            headers.remove("X-User-Id"); headers.remove("X-Role"); headers.remove("X-Session-Id");
            headers.set("X-Correlation-ID", id);
        }).build();
        exchange.getResponse().getHeaders().set("X-Correlation-ID", id);
        return chain.filter(exchange.mutate().request(request).build());
    }
}

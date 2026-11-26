package vn.tasknest.workservice.config;
import java.util.*;
import org.springframework.context.annotation.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.http.server.*;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;
import org.springframework.web.socket.config.annotation.*;
import vn.tasknest.workservice.infrastructure.realtime.WorkspaceSocket;
@Configuration @EnableWebSocket
public class RealtimeConfiguration implements WebSocketConfigurer {
    private final WorkspaceSocket socket;private final String[] origins;
    public RealtimeConfiguration(WorkspaceSocket socket,@Value("${IDENTITY_ALLOWED_ORIGINS:http://localhost:3000}") String origins){this.socket=socket;this.origins=Arrays.stream(origins.split(",")).map(String::strip).filter(value->!value.isEmpty()).toArray(String[]::new);}
    @Override public void registerWebSocketHandlers(WebSocketHandlerRegistry registry){
        registry.addHandler(socket,"/ws/work").addInterceptors(new HandshakeInterceptor(){
            @Override public boolean beforeHandshake(ServerHttpRequest request,ServerHttpResponse response,WebSocketHandler handler,Map<String,Object> attributes){
                if(request.getURI().getRawQuery()!=null||!Arrays.asList(origins).contains(request.getHeaders().getFirst(HttpHeaders.ORIGIN))){response.setStatusCode(HttpStatus.FORBIDDEN);return false;}return true;
            }
            @Override public void afterHandshake(ServerHttpRequest request,ServerHttpResponse response,WebSocketHandler handler,Exception exception){}
        }).setAllowedOrigins(origins);
    }
}

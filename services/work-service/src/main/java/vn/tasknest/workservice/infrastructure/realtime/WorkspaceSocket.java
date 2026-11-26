package vn.tasknest.workservice.infrastructure.realtime;

import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import tools.jackson.databind.json.JsonMapper;
import vn.tasknest.workservice.application.security.IdentitySessionVerifier;

/** Only authenticated, user-scoped invalidation frames; data remains behind current API authorization. */
@Component
public class WorkspaceSocket extends TextWebSocketHandler {
    private final IdentitySessionVerifier verifier;private final JdbcTemplate db;private final JsonMapper json=new JsonMapper();
    private final Map<String,Connection> connections=new ConcurrentHashMap<>();
    public WorkspaceSocket(IdentitySessionVerifier verifier,JdbcTemplate db){this.verifier=verifier;this.db=db;}
    private static class Connection {final WebSocketSession socket;final long opened=System.currentTimeMillis();String token,user,stamp;long inboxRevision,expires,window=System.currentTimeMillis(),lastVerified,lastPing;int messages;Connection(WebSocketSession socket){this.socket=socket;}}
    @Override public void afterConnectionEstablished(WebSocketSession socket) throws Exception {if(connections.size()>=200){socket.close(CloseStatus.SERVICE_OVERLOAD);return;}socket.setTextMessageSizeLimit(4096);connections.put(socket.getId(),new Connection(socket));}
    @Override protected void handleTextMessage(WebSocketSession socket,TextMessage frame) throws Exception {
        Connection connection=connections.get(socket.getId());if(connection==null)return;
        synchronized(connection){if(System.currentTimeMillis()-connection.window>=60000){connection.window=System.currentTimeMillis();connection.messages=0;}if(++connection.messages>10){socket.close(CloseStatus.POLICY_VIOLATION);return;}
            try{var message=json.readTree(frame.getPayload());String token=message.path("accessToken").asText();if(!message.path("type").asText().equals("authenticate")||!token.matches("[A-Za-z0-9._~-]{1,3500}"))throw new IllegalArgumentException();
                var actor=verifier.verify(token);if(!actor.emailVerified())throw new IllegalArgumentException();
                if(connection.user!=null&&!connection.user.equals(actor.userId()))throw new IllegalArgumentException();
                if(connections.values().stream().filter(c->actor.userId().equals(c.user)&&c!=connection).count()>=4)throw new IllegalArgumentException();
                var claims=json.readTree(Base64.getUrlDecoder().decode(token.split("\\.")[1]));long expiry=claims.path("exp").asLong()*1000;
                if(expiry<=System.currentTimeMillis())throw new IllegalArgumentException();connection.user=actor.userId();connection.token=token;connection.expires=expiry;connection.lastVerified=System.currentTimeMillis();connection.lastPing=connection.lastVerified;socket.sendMessage(new TextMessage("{\"type\":\"authenticated\"}"));
            }catch(Exception ex){socket.close(new CloseStatus(4401,"Authentication required"));}
        }
    }
    public void inboxChanged(String user){for(Connection connection:connections.values())if(java.util.Objects.equals(user,connection.user))synchronized(connection){connection.inboxRevision++;}}
    @Scheduled(fixedDelay=250,scheduler="realtimeScheduler") public void tick(){for(Connection connection:connections.values())synchronized(connection){try{
        long now=System.currentTimeMillis();if(!connection.socket.isOpen()){connections.remove(connection.socket.getId());continue;}
        if(connection.user!=null&&now-connection.lastPing>=30000){connection.socket.sendMessage(new PingMessage());connection.lastPing=now;}
        if(connection.user==null){if(now-connection.opened>5000)connection.socket.close(CloseStatus.POLICY_VIOLATION);continue;}
        if(now>=connection.expires){connection.socket.close(new CloseStatus(4401,"Token expired"));continue;}
        if(now-connection.lastVerified>=1000){verifier.verify(connection.token);connection.lastVerified=now;}
        String stamp=stamp(connection.user)+"/"+connection.inboxRevision;
        if(!stamp.equals(connection.stamp)){verifier.verify(connection.token);connection.stamp=stamp;connection.socket.sendMessage(new TextMessage("{\"type\":\"sync\"}"));}
    }catch(Exception ex){try{connection.socket.close(new CloseStatus(4401,"Session unavailable"));}catch(Exception ignored){/* Closed connection. */}connections.remove(connection.socket.getId());}}}
    private String stamp(String user){
        var member=db.queryForList("SELECT m.project_id,m.status,p.version,p.manager_user_id FROM project_memberships m JOIN projects p ON p.id=m.project_id WHERE m.user_id=? ORDER BY m.project_id",user);
        Long activity=db.queryForObject("SELECT COALESCE(MAX(a.id),0) FROM activity_logs a JOIN project_memberships m ON m.project_id=a.project_id AND m.user_id=? AND m.status='ACTIVE'",Long.class,user);
        var invites=db.queryForList("SELECT id,status FROM project_invitations WHERE invitee_user_id=? ORDER BY id",user);
        var joins=db.queryForList("SELECT id,status FROM project_join_requests WHERE user_id=? ORDER BY id",user);
        return member.toString()+activity+invites+joins;
    }
    @Override public void afterConnectionClosed(WebSocketSession socket,CloseStatus status){connections.remove(socket.getId());}
    @Override public void handleTransportError(WebSocketSession socket,Throwable exception) throws Exception{connections.remove(socket.getId());socket.close();}
}

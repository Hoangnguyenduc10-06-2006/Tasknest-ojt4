package vn.tasknest.notificationservice.application.mail;
import java.util.*;
import org.springframework.beans.factory.annotation.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
/** Recheck current membership immediately before delivery; infrastructure failures never grant access. */
@Component
public class DeliveryAccess {
    private final RestClient identity,work;private final String password;
    public DeliveryAccess(@Qualifier("notificationIdentityBuilder") RestClient.Builder builder,@Value("${SCAFFOLD_SECURITY_PASSWORD}") String password){this.identity=builder.clone().baseUrl("http://identity-service").build();this.work=builder.clone().baseUrl("http://work-service").build();this.password=password;}
    public String email(String user){try{var result=identity.get().uri("/internal/identity/mail-contact/{id}",user).headers(h->h.setBasicAuth("disabled-scaffold-user",password)).retrieve().body(Contact.class);return result==null?null:result.email();}catch(HttpClientErrorException.NotFound ex){return null;}}
    public boolean allowed(long project,String user,Long task){try{return Boolean.TRUE.equals(work.get().uri(builder->{var uri=builder.path("/internal/work/delivery").queryParam("project",project).queryParam("user",user);if(task!=null)uri.queryParam("task",task);return uri.build();}).headers(h->h.setBasicAuth("disabled-scaffold-user",password)).retrieve().body(Boolean.class));}catch(HttpClientErrorException.NotFound ex){return false;}}
    public record Contact(String email){}
}

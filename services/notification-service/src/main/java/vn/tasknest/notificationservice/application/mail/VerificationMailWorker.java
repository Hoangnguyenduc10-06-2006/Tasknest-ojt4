package vn.tasknest.notificationservice.application.mail;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Base64;
import java.util.Map;
import java.util.List;
import java.util.UUID;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import tools.jackson.databind.json.JsonMapper;

@Component
@ConditionalOnProperty(name="tasknest.mail.enabled", havingValue="true")
public class VerificationMailWorker {
    private final JdbcTemplate jdbc;
    private final TransactionTemplate tx;
    private final RestClient brevo;
    private final JsonMapper json=new JsonMapper();
    private final SecretKeySpec key;
    private final String keyId, senderEmail, senderName, publicOrigin;
    private final DeliveryAccess delivery;
    private final String worker=UUID.randomUUID().toString();

    public VerificationMailWorker(JdbcTemplate jdbc, TransactionTemplate tx, @org.springframework.beans.factory.annotation.Qualifier("brevoClient") RestClient brevo,
        DeliveryAccess delivery, @Value("${tasknest.mail.key-base64}") String encodedKey, @Value("${tasknest.mail.key-id}") String keyId,
        @Value("${tasknest.mail.from-email}") String email, @Value("${tasknest.mail.from-name:TaskNest}") String name,
        @Value("${tasknest.mail.public-origin}") String origin) {
        this.delivery=delivery; this.jdbc=jdbc; this.tx=tx; this.brevo=brevo; this.keyId=keyId;
        byte[] bytes=Base64.getDecoder().decode(encodedKey);
        URI uri=URI.create(origin);
        if (bytes.length!=32 || keyId.isBlank() || !email.contains("@") || uri.getHost()==null
            || uri.getRawUserInfo()!=null || uri.getRawQuery()!=null || uri.getRawFragment()!=null
            || !("https".equals(uri.getScheme()) || ("http".equals(uri.getScheme()) &&
                List.of("localhost","127.0.0.1").contains(uri.getHost())))
            || !(uri.getPath().isEmpty() || uri.getPath().equals("/")))
            throw new IllegalStateException("Invalid mail key, sender or public origin");
        this.key=new SecretKeySpec(bytes,"AES"); this.senderEmail=email; this.senderName=name;
        this.publicOrigin=origin.replaceAll("/+$", "");
    }

    @Scheduled(fixedDelayString="${tasknest.mail.poll-ms:2000}")
    public void dispatch() {
        // An expired SENDING lease means delivery may have happened. Do NOT auto-send it again.
        tx.executeWithoutResult(status -> {
            jdbc.update("""
                UPDATE email_delivery_attempts a JOIN email_jobs j ON j.id=a.email_job_id
                SET a.finished_at=UTC_TIMESTAMP(6),a.result='UNKNOWN',a.error_safe='WORKER_INTERRUPTED'
                WHERE j.status='SENDING' AND j.locked_until<UTC_TIMESTAMP(6) AND a.finished_at IS NULL
                """);
            jdbc.update("""
                UPDATE email_jobs SET status='FAILED',last_error_safe='DELIVERY_UNKNOWN_REVIEW_REQUIRED',
                locked_by=NULL,locked_until=NULL WHERE status='SENDING' AND locked_until<UTC_TIMESTAMP(6)
                """);
            jdbc.update("""
                UPDATE email_jobs SET status='SUPPRESSED',last_error_safe='TOKEN_EXPIRED',sensitive_data=NULL,
                encryption_key_id=NULL WHERE status='QUEUED' AND expires_at<=UTC_TIMESTAMP(6)
                """);
        });
        for(int i=0;i<10;i++) {
            Map<String,Object> job=tx.execute(status -> {
                var rows=jdbc.queryForList("""
                    SELECT * FROM email_jobs WHERE status='QUEUED' AND purpose IN ('EMAIL_VERIFICATION','PASSWORD_RESET','PROJECT_EVENT','TASK_EVENT','SECURITY_EVENT')
                    AND next_attempt_at<=UTC_TIMESTAMP(6) AND expires_at>UTC_TIMESTAMP(6)
                    ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED
                    """);
                if(rows.isEmpty()) return null;
                var row=rows.getFirst();
                jdbc.update("""
                    UPDATE email_jobs SET status='SENDING',attempt_count=attempt_count+1,locked_by=?,
                    locked_until=DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 60 SECOND) WHERE id=?
                    """,worker,row.get("id"));
                jdbc.update("""
                    INSERT INTO email_delivery_attempts(email_job_id,attempt_no,started_at)
                    VALUES (?,?,UTC_TIMESTAMP(6))
                    """,row.get("id"),((Number)row.get("attempt_count")).intValue()+1);
                return row;
            });
            if(job==null) return;
            send(job);
        }
    }

    private void send(Map<String,Object> job) {
        String recipient;
        String link;
        String subject="Xác nhận tài khoản TaskNest";
        String content;
        try {
            if ("work-event".equals(job.get("template_key"))) {
                var data=json.readTree(job.get("template_data").toString());
                Long task=data.path("taskId").isNull()?null:data.path("taskId").asLong();
                if(!data.path("allowNonMember").asBoolean()&&!delivery.allowed(data.path("projectId").asLong(),data.path("userId").asText(),task)){finish(job,"SUPPRESSED","PERMANENT_FAILURE","RECIPIENT_ACCESS_REVOKED",null,null);return;}
                recipient=delivery.email(data.path("userId").asText());
                if(recipient==null){finish(job,"SUPPRESSED","PERMANENT_FAILURE","RECIPIENT_NOT_VERIFIED",null,null);return;}
                subject=data.path("title").asText();
                link=publicOrigin+(task!=null?"/tasks/"+task:"/invitations");
                content=subject+"\n\n"+data.path("body").asText()+"\n\n"+link;
            } else if ("PROJECT_EVENT".equals(job.get("purpose"))) {
                if (!"project-invitation".equals(job.get("template_key"))) throw new IllegalStateException();
                var data=json.readTree(job.get("template_data").toString());
                recipient=job.get("recipient_email").toString();
                if(!recipient.contains("@")) throw new IllegalStateException();
                link=publicOrigin+"/invitations";
                subject="Lời mời tham gia dự án TaskNest";
                content="Bạn được mời tham gia dự án "+data.path("projectName").asText()+".\n\nĐăng nhập đúng tài khoản nhận thư và chọn Chấp nhận hoặc Từ chối tại:\n"+link+"\n\nLời mời có hiệu lực 7 ngày. Mở liên kết không tự động tham gia dự án.";
            } else {
            if(!keyId.equals(job.get("encryption_key_id"))) throw new IllegalStateException();
            byte[] encrypted=(byte[])job.get("sensitive_data");
            Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE,key,new GCMParameterSpec(128,Arrays.copyOfRange(encrypted,0,12)));
            var data=json.readTree(cipher.doFinal(encrypted,12,encrypted.length-12));
            recipient=data.path("email").asText(); String token=data.path("token").asText();
            if(!recipient.contains("@") || !token.matches("[A-Za-z0-9_-]{32,200}")) throw new IllegalStateException();
            boolean reset="PASSWORD_RESET".equals(job.get("purpose"));
            link=publicOrigin+(reset?"/reset-password?token=":"/verify-email?token=")+URLEncoder.encode(token,StandardCharsets.UTF_8);
            if(reset) subject="Đặt lại mật khẩu TaskNest";
            content=reset ? "Đặt lại mật khẩu bằng liên kết sau:\n"+link+"\n\nLiên kết dùng một lần, có hiệu lực 15 phút. Nếu không yêu cầu, bạn có thể bỏ qua email này." : "Chào bạn,\n\nXác nhận tài khoản TaskNest bằng liên kết sau:\n"+link+
                "\n\nLiên kết có hiệu lực 24 giờ và chỉ dùng một lần. Nếu không đăng ký, bạn có thể bỏ qua email này.";
            }
        } catch(org.springframework.web.client.RestClientException ex) {
            boolean retry=((Number)job.get("attempt_count")).intValue()<4;
            finish(job,retry?"QUEUED":"FAILED",retry?"TRANSIENT_FAILURE":"PERMANENT_FAILURE","DELIVERY_AUTHORIZATION_UNAVAILABLE",null,null);return;
        } catch(Exception ex) { finish(job,"FAILED","PERMANENT_FAILURE","INVALID_ENCRYPTED_PAYLOAD",null,null); return; }
        String messageId;
        try {
            var response=brevo.post().uri("/smtp/email").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("sender",Map.of("email",senderEmail,"name",senderName),
                    "to",List.of(Map.of("email",recipient)),"subject",subject,
                    "textContent",content))
                .retrieve().body(String.class);
            messageId=json.readTree(response).path("messageId").asText();
            if(messageId.isBlank()) throw new IllegalStateException();
        } catch(RestClientResponseException ex) {
            int code=ex.getStatusCode().value();
            boolean retry=code==429 && ((Number)job.get("attempt_count")).intValue()<4;
            // Only explicit throttling is retried. Timeouts/5xx can follow provider acceptance.
            String result=retry?"TRANSIENT_FAILURE":(code>=500?"UNKNOWN":"PERMANENT_FAILURE");
            finish(job,retry?"QUEUED":"FAILED",result,"BREVO_HTTP_"+code,null,recipient); return;
        } catch(Exception ex) {
            finish(job,"FAILED","UNKNOWN","DELIVERY_UNKNOWN_REVIEW_REQUIRED",null,recipient); return;
        }
        // A DB failure after provider acceptance must NOT be handled as a retryable send failure.
        finish(job,"ACCEPTED","ACCEPTED",null,messageId,recipient);
    }

    private void finish(Map<String,Object> job,String state,String result,String error,String messageId,String recipient) {
        tx.executeWithoutResult(status -> {
            int changed=jdbc.update("""
                UPDATE email_jobs SET status=?,recipient_email=COALESCE(?,recipient_email),provider_message_id=?,
                accepted_at=IF(?='ACCEPTED',UTC_TIMESTAMP(6),accepted_at),last_error_safe=?,
                next_attempt_at=DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 60 SECOND),locked_by=NULL,locked_until=NULL,
                sensitive_data=IF(?='QUEUED',sensitive_data,NULL),encryption_key_id=IF(?='QUEUED',encryption_key_id,NULL)
                WHERE id=? AND status='SENDING' AND locked_by=?
                """,state,recipient,messageId,state,error,state,state,job.get("id"),worker);
            if(changed!=1) throw new IllegalStateException("Mail lease lost");
            jdbc.update("""
                UPDATE email_delivery_attempts SET finished_at=UTC_TIMESTAMP(6),result=?,provider_message_id=?,error_safe=?
                WHERE email_job_id=? AND attempt_no=? AND finished_at IS NULL
                """,result,messageId,error,job.get("id"),((Number)job.get("attempt_count")).intValue()+1);
        });
    }
}

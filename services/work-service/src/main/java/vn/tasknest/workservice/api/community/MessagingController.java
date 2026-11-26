package vn.tasknest.workservice.api.community;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.io.IOException;
import java.util.*;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import vn.tasknest.workservice.api.WorkResponse;
import vn.tasknest.workservice.application.WorkException;
import vn.tasknest.workservice.application.community.MessagingService;
import vn.tasknest.workservice.application.security.*;
import vn.tasknest.workservice.infrastructure.identity.IdentityDirectoryClient;
@RestController
@RequestMapping("/api/work/community/chat")
public class MessagingController {
    private static final String CLIENT_ID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
    private final MessagingService chat;private final WorkRequestBudget budget;private final ProjectPermissionService permissions;
    public MessagingController(MessagingService chat,WorkRequestBudget budget,ProjectPermissionService permissions){this.chat=chat;this.budget=budget;this.permissions=permissions;}
    public record Open(@NotBlank @Pattern(regexp="DIRECT|TEAM|PROJECT") String kind,@NotBlank @Size(max=80) String target){}
    public record Message(@NotBlank @Size(max=4000) String body,@NotBlank @Pattern(regexp=CLIENT_ID) String clientId,@Positive Long replyToMessageId){}
    public record Read(@Positive long messageId){}
    public record Block(boolean blocked){}
    public record Reaction(@NotBlank @Size(max=8) String emoji){}
    @GetMapping public WorkResponse<Map<String,Object>> list(@AuthenticationPrincipal WorkActor actor,@RequestParam(defaultValue="0") int page){return WorkResponse.read(chat.list(actor,page));}
    @GetMapping("/unread") public WorkResponse<Long> unread(@AuthenticationPrincipal WorkActor actor){return WorkResponse.read(chat.unread(actor));}
    @GetMapping("/spaces") public WorkResponse<Map<String,Object>> spaces(@AuthenticationPrincipal WorkActor actor){return WorkResponse.read(chat.spaces(actor));}
    @GetMapping("/people") public WorkResponse<List<IdentityDirectoryClient.InvitationUser>> people(@AuthenticationPrincipal WorkActor actor,@RequestParam String search){return WorkResponse.read(chat.people(actor,search));}
    @PostMapping @ResponseStatus(HttpStatus.CREATED) public WorkResponse<Long> open(@AuthenticationPrincipal WorkActor actor,@Valid @RequestBody Open input){limit(actor,"CHAT_OPEN",30);return WorkResponse.created("Đã mở cuộc trò chuyện.",chat.open(actor,input.kind(),input.target()));}
    @GetMapping("/{id}") public WorkResponse<Map<String,Object>> history(@AuthenticationPrincipal WorkActor actor,@PathVariable long id,@RequestParam(required=false) Long before,@RequestParam(required=false) Long around){return WorkResponse.read(chat.history(actor,id,before,around));}
    @GetMapping("/{id}/messages/search") public WorkResponse<List<Map<String,Object>>> search(@AuthenticationPrincipal WorkActor actor,@PathVariable long id,@RequestParam String q){limit(actor,"CHAT_SEARCH",30);return WorkResponse.read(chat.search(actor,id,q));}
    @PostMapping(path="/{id}/messages", consumes=MediaType.APPLICATION_JSON_VALUE) @ResponseStatus(HttpStatus.CREATED) public WorkResponse<Long> send(@AuthenticationPrincipal WorkActor actor,@PathVariable long id,@Valid @RequestBody Message input){limit(actor,"CHAT_SEND",60);return WorkResponse.created("Đã gửi tin nhắn.",chat.send(actor,id,input.body(),input.clientId(),input.replyToMessageId()));}

    @PostMapping(path = "/{id}/messages", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public WorkResponse<Long> sendImage(@AuthenticationPrincipal WorkActor actor, @PathVariable long id,
                                       @RequestParam(required = false) String body, @RequestParam String clientId,
                                       @RequestParam(required = false) @Positive Long replyToMessageId,
                                       @RequestParam("file") List<MultipartFile> files) {
        limit(actor, "CHAT_SEND", 60);
        limit(actor, "CHAT_IMAGE", 10);
        if (!clientId.matches(CLIENT_ID) || (body != null && body.length() > 4000)) {
            throw new WorkException(HttpStatus.BAD_REQUEST, "INVALID_MESSAGE", "Kiểm tra nội dung hoặc mã gửi tin nhắn.");
        }
        if (files.isEmpty() || files.size() > MessagingService.MAX_IMAGES_PER_MESSAGE || files.stream().anyMatch(MultipartFile::isEmpty)) {
            throw new WorkException(HttpStatus.BAD_REQUEST, "INVALID_FILE", "Chọn từ 1 đến 5 ảnh JPG hoặc PNG để gửi.");
        }
        try {
            var images = new ArrayList<MessagingService.ImageUpload>(files.size());
            for (var file : files) {
                if (file.getSize() > MessagingService.MAX_IMAGE_BYTES) {
                    throw new WorkException(HttpStatus.PAYLOAD_TOO_LARGE, "CHAT_IMAGE_TOO_LARGE", "Mỗi ảnh tối đa 5 MiB.");
                }
                images.add(MessagingService.ImageUpload.validate(file.getOriginalFilename(), file.getBytes()));
            }
            long messageId = images.size() == 1
                ? chat.sendImage(actor, id, body, clientId, images.getFirst(), replyToMessageId)
                : chat.sendImages(actor, id, body, clientId, images, replyToMessageId);
            return WorkResponse.created("Đã gửi tin nhắn.", messageId);
        } catch (IOException exception) {
            throw new WorkException(HttpStatus.BAD_REQUEST, "INVALID_FILE", "Không thể đọc ảnh đã chọn.");
        }
    }

    @GetMapping("/{id}/messages/{messageId}/image")
    public ResponseEntity<byte[]> image(@AuthenticationPrincipal WorkActor actor, @PathVariable long id, @PathVariable long messageId) {
        var image = chat.image(actor, id, messageId);
        return imageResponse(image);
    }

    @GetMapping("/{id}/messages/{messageId}/images/{slot}")
    public ResponseEntity<byte[]> imageSlot(@AuthenticationPrincipal WorkActor actor, @PathVariable long id,
                                            @PathVariable long messageId, @PathVariable @Min(1) @Max(5) int slot) {
        return imageResponse(chat.image(actor, id, messageId, slot));
    }

    private ResponseEntity<byte[]> imageResponse(MessagingService.ImageDownload image) {
        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType(image.mime()))
            .header(HttpHeaders.CACHE_CONTROL, "private, no-store")
            .header(HttpHeaders.CONTENT_DISPOSITION, "inline")
            .header("X-Content-Type-Options", "nosniff")
            .body(image.bytes());
    }
    @PutMapping("/{id}/messages/{messageId}/reaction")
    public WorkResponse<Void> react(@AuthenticationPrincipal WorkActor actor, @PathVariable long id,
                                    @PathVariable long messageId, @Valid @RequestBody Reaction input) {
        limit(actor, "CHAT_REACTION", 120);
        chat.react(actor, id, messageId, input.emoji());
        return WorkResponse.ok("Đã thêm cảm xúc.", null);
    }

    @DeleteMapping("/{id}/messages/{messageId}/reaction")
    public WorkResponse<Void> unreact(@AuthenticationPrincipal WorkActor actor, @PathVariable long id,
                                      @PathVariable long messageId, @Valid @RequestBody Reaction input) {
        limit(actor, "CHAT_REACTION", 120);
        chat.unreact(actor, id, messageId, input.emoji());
        return WorkResponse.ok("Đã gỡ cảm xúc.", null);
    }
    @PutMapping("/{id}/read") public WorkResponse<Void> read(@AuthenticationPrincipal WorkActor actor,@PathVariable long id,@Valid @RequestBody Read input){chat.read(actor,id,input.messageId());return WorkResponse.ok("Đã đọc tin nhắn.",null);}
    @PutMapping("/{id}/block") public WorkResponse<Void> block(@AuthenticationPrincipal WorkActor actor,@PathVariable long id,@Valid @RequestBody Block input){chat.block(actor,id,input.blocked());return WorkResponse.ok("Đã cập nhật cuộc trò chuyện.",null);}
    private void limit(WorkActor actor,String action,int maximum){permissions.requireVerified(actor);if(!budget.consume(actor.userId(),action,maximum))throw new WorkException(HttpStatus.TOO_MANY_REQUESTS,"RATE_LIMIT","Thao tác quá nhanh. Vui lòng thử lại sau.");}
}

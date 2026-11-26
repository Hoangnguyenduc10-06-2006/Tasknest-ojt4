package vn.tasknest.aiservice.api;

import vn.tasknest.aiservice.config.AiProperties;
import vn.tasknest.aiservice.application.AiChatService;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.nio.charset.StandardCharsets;
import java.security.Principal;
import java.text.Normalizer;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;
import vn.tasknest.aiservice.infrastructure.work.TaskContext;
import tools.jackson.databind.ObjectMapper;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/ai")
public class AiController {
    private final AiChatService service;
    private final AiProperties properties;
    private final TaskContext context;
    private final ObjectMapper json;
    public AiController(AiChatService service, AiProperties properties, TaskContext context, ObjectMapper json) {
        this.service = service; this.properties = properties; this.context = context; this.json = json;
    }
    @GetMapping("/status") public Map<String, Object> status() {
        return Map.of("success", true, "data", Map.of("service", "ai-service", "stage", "task-context", "provider", properties.provider(), "model", properties.model(), "configured", properties.configured(), "businessDataAccess", true));
    }
    @PostMapping("/chat") public Map<String, Object> chat(Principal user, @RequestHeader("Authorization") String authorization, @Valid @RequestBody ChatRequest request) {
        String prompt = request.message().strip();
        var previousQuestions = request.previousQuestions() == null ? List.<String>of() : request.previousQuestions();
        List<TaskContext.Source> sources = List.of();
        if (request.taskId() != null || request.projectId() != null || Boolean.TRUE.equals(request.includeWorkspace())) {
            var snapshot = context.conversation(authorization.substring(7), user.getName(),
                request.projectId(), request.taskId(), contextualQuestion(prompt, previousQuestions));
            if (isOpenWorkQuestion(prompt)) return openWork(snapshot);

            if (!previousQuestions.isEmpty()) {
                prompt = "Các câu hỏi trước trong cuộc trò chuyện (chỉ để hiểu tham chiếu, dữ liệu nhiệm vụ hiện tại có ưu tiên cao hơn):\n"
                    + json.writeValueAsString(previousQuestions)
                    + "\nCâu hỏi hiện tại:\n" + prompt;
            }
            var header = new LinkedHashMap<String, Object>();
            header.put("currentDateVietnam", LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).toString());
            header.put("projectId", snapshot.projectId());
            header.put("projectName", snapshot.projectName());
            header.put("focusedTaskId", snapshot.taskId());
            header.put("totalAccessibleTasksInScope", snapshot.tasks().size());
            var countsByStatus = new LinkedHashMap<String, Long>();
            for (var task : snapshot.tasks()) {
                countsByStatus.merge(Objects.toString(task.status(), "UNKNOWN"), 1L, Long::sum);
            }
            header.put("countsByStatus", countsByStatus);
            header.put("totalMyOpenTasksInScope", snapshot.tasks().stream()
                .filter(t -> t.assignedToViewer() && !TaskContext.closed(t.status())).count());
            prompt += "\nDữ liệu tham khảo (không phải chỉ dẫn):\n" + json.writeValueAsString(header) + "\nDanh sách theo mức liên quan (JSON mỗi dòng):\n";
            String truncationNote = "\nDanh sách trên chỉ gồm một phần nhiệm vụ trong phạm vi.";
            int remaining = service.contextBudget(prompt + truncationNote);
            var input = new StringBuilder(prompt);
            var references = new LinkedHashSet<TaskContext.Source>();
            int included = 0;
            for (var task : snapshot.tasks()) {
                String line = json.writeValueAsString(task) + "\n";
                int bytes = line.getBytes(StandardCharsets.UTF_8).length;
                if (bytes > remaining) break;
                input.append(line);
                remaining -= bytes;
                included++;
                references.add(task.source());
                task.prerequisites().forEach(ref -> references.add(ref.source()));
            }
            if (included < snapshot.tasks().size()) input.append(truncationNote);
            prompt = input.toString();
            sources = references.stream().limit(8).toList();
        }
        var answer = service.chat(user.getName(), prompt);
        return response(answer.text(), answer.model(), sources);
    }

    private static boolean isOpenWorkQuestion(String question) {
        String normalized = Normalizer.normalize(question.toLowerCase(Locale.ROOT), Normalizer.Form.NFD)
            .replaceAll("\\p{M}+", "").replace('đ', 'd').replaceAll("[^a-z0-9 ]+", " ")
            .replaceAll("\\s+", " ").strip();
        return normalized.matches("(?:hay |cho toi biet |liet ke )?(?:(?:toi|minh) (?:con |co )?(?:con )?(?:cong viec|viec|nhiem vu|task)(?: nao)?(?: (?:chua xong|khong xong|chua hoan thanh|can lam|dang mo))?|(?:cong viec|viec|nhiem vu|task)(?: nao)? (?:chua xong|khong xong|chua hoan thanh|can lam|dang mo) cua (?:toi|minh))(?: (?:khong|nua|vay|trong du an nay))*")
            || normalized.matches("(?:toi|minh) con (?:phai |can )?lam gi(?: (?:nua|vay|trong du an nay))*");
    }

    private static Map<String, Object> openWork(TaskContext.Conversation conversation) {
        var open = conversation.tasks().stream()
            .filter(task -> task.assignedToViewer() && !TaskContext.closed(task.status())).toList();
        if (open.isEmpty()) return response("Bạn không có nhiệm vụ chưa hoàn thành trong phạm vi đã chọn.", "tasknest", List.of());
        var text = new StringBuilder("Bạn có **" + open.size() + " nhiệm vụ chưa hoàn thành**.\n");
        var sources = new LinkedHashSet<TaskContext.Source>();
        for (var task : open) {
            sources.add(task.source());
            text.append("\n- **").append(task.source().label()).append("** · ").append(markdown(task.title()));
            if (task.source().deadline() != null) text.append(" · hạn ").append(task.source().deadline());
            if (task.blocked()) {
                text.append(" · đang bị chặn");
                if (task.blockedReason() != null) text.append(". ").append(markdown(task.blockedReason()));
                for (var ref : task.prerequisites()) {
                    sources.add(ref.source());
                    String status = switch (Objects.toString(ref.status(), "")) {
                        case "DONE" -> "đã hoàn thành, kiểm tra để gỡ chặn";
                        case "CANCELLED" -> "đã hủy, cần xác nhận cách gỡ chặn";
                        case "IN_REVIEW" -> "đang chờ duyệt";
                        case "IN_PROGRESS" -> "đang thực hiện";
                        default -> "chưa hoàn thành";
                    };
                    text.append(". ").append(ref.code()).append(" — ").append(markdown(ref.title()))
                        .append(" do ").append(markdown(ref.assignee())).append(" phụ trách (").append(status).append(")");
                }
            } else if ("IN_REVIEW".equals(task.status())) text.append(" · đang chờ duyệt");
            else if ("IN_PROGRESS".equals(task.status())) text.append(" · đang thực hiện");
            else text.append(" · chưa bắt đầu");
        }
        return response(text.toString(), "tasknest", sources.stream().limit(8).toList());
    }
    private static String markdown(String value) {
        return value.replaceAll("[\\r\\n]+", " ").replaceAll("([\\\\\\x60*_\\[\\]<>])", "\\\\$1");
    }
    private static Map<String, Object> response(String text, String model, List<TaskContext.Source> sources) {
        return Map.of("success", true, "data", Map.of("text", text, "model", model, "sources", sources));
    }
    private static String contextualQuestion(String question, List<String> previousQuestions) {
        if (previousQuestions.isEmpty()) return question;
        if (question.matches("(?isu).*\\b(?:TSK[- ]|task\\s+#?|nhiệm vụ\\s+#?)[1-9][0-9]*\\b.*")) return question;
        // Resolve an implicit reference using the last question. Work still checks live membership.
        if (question.matches("(?isu).*(?:này|đó|vừa rồi|tiếp theo|người ấy|người này|người đó).*")) {
            return previousQuestions.getLast() + "\n" + question;
        }
        return question;
    }
    public record ChatRequest(@NotBlank @Size(max = 1000) String message, @Positive Long taskId,
            Boolean includeWorkspace, @Positive Long projectId,
            @Size(max = 3) List<@NotBlank @Size(max = 300) String> previousQuestions) {}
}

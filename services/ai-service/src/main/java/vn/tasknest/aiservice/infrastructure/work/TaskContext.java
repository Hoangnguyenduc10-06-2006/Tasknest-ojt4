package vn.tasknest.aiservice.infrastructure.work;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.text.Normalizer;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.*;
import vn.tasknest.aiservice.application.AiException;

@Component
public class TaskContext {
    private static final Pattern TASK_CODE = Pattern.compile("(?i)\\bTSK-([1-9][0-9]*)\\b");
    private static final Pattern QUESTION_TASK_CODE = Pattern.compile(
        "(?iu)\\b(?:TSK[- ]|task\\s+#?|nhiệm vụ\\s+#?)([1-9][0-9]*)\\b");
    private static final Pattern WAITING_REASON = Pattern.compile(
        "(?iu)(?:chờ|đợi|phụ thuộc(?: vào)?)\\s+[^.!?;\\r\\n]*");
    private final RestClient client;
    public TaskContext(@Qualifier("aiWorkClient") RestClient client) { this.client = client; }
    private Data load(String token) {
        Envelope result;
        try {
            // Work rechecks the caller's live membership and time visibility. No service/admin identity.
            result = client.get().uri("/api/work/projects/workspace")
                .headers(h -> h.setBearerAuth(token)).retrieve().body(Envelope.class);
        } catch (RestClientResponseException ex) {
            if (ex.getStatusCode().value() == 401 || ex.getStatusCode().value() == 403)
                throw new AiException(HttpStatus.FORBIDDEN, "AI_CONTEXT_DENIED", "Không còn quyền đọc dữ liệu nhiệm vụ.");
            throw unavailable();
        } catch (RestClientException ex) { throw unavailable(); }
        if (result == null || result.data() == null || result.data().tasks() == null) throw unavailable();
        return result.data();
    }
    public Snapshot read(String token, long taskId) {
        var data = load(token);
        var task = data.tasks().stream().filter(t -> t.id() == taskId).findFirst()
            .orElseThrow(() -> new AiException(HttpStatus.NOT_FOUND, "AI_TASK_NOT_FOUND", "Nhiệm vụ không tồn tại hoặc bạn không còn quyền xem."));
        return snapshot(data, task);
    }
    public Snapshot readForViewer(String token, long taskId, String userId) {
        var data = load(token);
        var task = data.tasks().stream().filter(t -> t.id() == taskId).findFirst()
            .orElseThrow(() -> new AiException(HttpStatus.NOT_FOUND, "AI_TASK_NOT_FOUND", "Nhiệm vụ không tồn tại hoặc bạn không còn quyền xem."));
        var snapshot = snapshot(data, task);
        snapshot.fields().put("viewerIsAssignee", userId.equals(task.assigneeId()));
        String role = data.members() == null ? "Member" : data.members().stream()
            .filter(m -> userId.equals(m.id()) && Objects.equals(task.projectId(), m.projectId()))
            .map(Member::role).findFirst().orElse("Member");
        snapshot.fields().put("viewerProjectRole", role);
        return snapshot;
    }
    public Conversation conversation(String token, String viewerId, Long projectId, Long taskId, String question) {
        var data = load(token);
        var requested = taskCodes(question, QUESTION_TASK_CODE);
        String normalizedQuestion = searchable(question);
        var terms = Arrays.stream(normalizedQuestion.split(" ")).filter(term -> term.length() >= 4)
            .filter(term -> !Set.of("cong", "viec", "nhiem", "project", "khong", "trong", "task", "chua").contains(term))
            .collect(Collectors.toSet());
        if (taskId != null) {
            long requestedFocus = taskId;
            var focus = data.tasks().stream().filter(task -> task.id() == requestedFocus).findFirst()
                .orElseThrow(() -> new AiException(HttpStatus.NOT_FOUND, "AI_TASK_NOT_FOUND", "Nhiệm vụ không tồn tại hoặc bạn không còn quyền xem."));
            if (projectId != null && !projectId.equals(focus.projectId())) {
                throw new AiException(HttpStatus.NOT_FOUND, "AI_TASK_NOT_FOUND", "Nhiệm vụ không thuộc dự án đã chọn.");
            }
            projectId = focus.projectId();
        }
        var members = data.members() == null ? List.<Member>of() : data.members();
        var visibleProjects = members.stream().filter(m -> viewerId.equals(m.id()))
            .map(Member::projectId).collect(Collectors.toSet());
        if (projectId != null && !visibleProjects.contains(projectId)) {
            throw new AiException(HttpStatus.NOT_FOUND, "AI_PROJECT_NOT_FOUND", "Dự án không tồn tại hoặc bạn không còn quyền xem.");
        }
        var projectNames = members.stream().filter(m -> m.projectName() != null && visibleProjects.contains(m.projectId()))
            .collect(Collectors.toMap(Member::projectId, Member::projectName, (first, second) -> first));
        var namedProjects = projectNames.entrySet().stream()
            .filter(p -> !p.getValue().isBlank() && (" " + normalizedQuestion + " ").contains(" " + searchable(p.getValue()) + " "))
            .map(Map.Entry::getKey).toList();
        if (namedProjects.size() == 1) {
            if (!Objects.equals(projectId, namedProjects.getFirst())) taskId = null;
            projectId = namedProjects.getFirst();
        } else if (projectId == null && !requested.isEmpty()) {
            var projectsOfReferences = data.tasks().stream().filter(t -> requested.contains(Long.toString(t.id())))
                .map(Task::projectId).filter(visibleProjects::contains).distinct().toList();
            if (projectsOfReferences.size() == 1) projectId = projectsOfReferences.getFirst();
        }
        Long scope = projectId;
        Long focusId = taskId;
        var names = members.stream().filter(m -> m.name() != null && !m.name().isBlank())
            .collect(Collectors.toMap(Member::id, Member::name, (first, second) -> first));
        var scopedTasks = data.tasks().stream()
            .filter(task -> visibleProjects.contains(task.projectId()))
            .filter(task -> scope == null || scope.equals(task.projectId())).toList();
        var byId = scopedTasks.stream().collect(Collectors.toMap(t -> Long.toString(t.id()), t -> t));
        var rows = scopedTasks.stream()
            .sorted(Comparator.comparingInt((Task task) -> requested.contains(Long.toString(task.id())) ? 0
                    : Objects.equals(focusId, task.id()) ? 1
                    : 2)
                .thenComparing(Comparator.comparingInt((Task task) -> relevance(task, terms)).reversed())
                .thenComparingInt(task -> viewerId.equals(task.assigneeId()) && !closed(task.status()) ? 0
                    : !closed(task.status()) ? 1 : 2)
                .thenComparing(Task::deadlineOn, Comparator.nullsLast(String::compareTo)).thenComparingLong(Task::id))
            .map(task -> {
                var waitingFor = task.blocked() ? waitingCodes(task.blockedReason()).stream()
                    .map(byId::get).filter(Objects::nonNull)
                    .filter(ref -> ref.id() != task.id() && Objects.equals(ref.projectId(), task.projectId()))
                    .map(ref -> new Prerequisite("TSK-" + ref.id(), safeTitle(ref.title()), person(names, ref), ref.status(), source(ref)))
                    .toList() : List.<Prerequisite>of();
                return new ProjectTask(source(task), scope == null ? projectNames.get(task.projectId()) : null,
                    safeTitle(task.title()), person(names, task),
                    viewerId.equals(task.assigneeId()), task.status(), task.priority(), task.startsOn(),
                    task.blocked(), excerpt(task.blockedReason(), 240), excerpt(task.description(), 180), waitingFor);
            }).toList();
        return new Conversation(scope, scope == null ? null : projectNames.get(scope), focusId, rows);
    }
    private static String searchable(String text) {
        if (text == null) return "";
        return Normalizer.normalize(text.toLowerCase(Locale.ROOT), Normalizer.Form.NFD)
            .replaceAll("\\p{M}+", "").replace('đ', 'd').replaceAll("[^a-z0-9]+", " ").strip();
    }
    private static int relevance(Task task, Set<String> terms) {
        if (terms.isEmpty()) return 0;
        String title = " " + searchable(task.title()) + " ";
        String description = " " + searchable(task.description()) + " " + searchable(task.blockedReason()) + " ";
        return terms.stream().mapToInt(term -> title.contains(" " + term + " ") ? 2
            : description.contains(" " + term + " ") ? 1 : 0).sum();
    }
    private static String person(Map<String, String> names, Task task) {
        return task.assigneeId() == null ? "Chưa phân công" : names.getOrDefault(task.assigneeId(), "Thành viên dự án");
    }
    private static Set<String> taskCodes(String text, Pattern pattern) {
        var result = new LinkedHashSet<String>();
        if (text == null) return result;
        var matcher = pattern.matcher(text);
        while (matcher.find()) result.add(matcher.group(1));
        return result;
    }
    private static Set<String> waitingCodes(String reason) {
        var result = new LinkedHashSet<String>();
        if (reason == null) return result;
        var matcher = WAITING_REASON.matcher(reason);
        while (matcher.find()) {
            String before = reason.substring(0, matcher.start()).stripTrailing().toLowerCase(Locale.ROOT);
            if (before.endsWith("không") || before.endsWith("đã")) continue;
            result.addAll(taskCodes(matcher.group(), TASK_CODE));
        }
        return result;
    }
    private static String excerpt(String value, int limit) {
        if (value == null || value.isBlank()) return null;
        return value.length() <= limit ? value : value.substring(0, limit) + "…";
    }
    private static Source source(Task task) {
        return new Source("TSK-" + task.id(), "/tasks/" + task.id(), task.deadlineOn(),
            task.estimatedSeconds() / 3600.0, task.spentSeconds() == null ? null : task.spentSeconds() / 3600.0);
    }
    private Snapshot snapshot(Task task) { return snapshot(null, task); }
    private Snapshot snapshot(Data data, Task task) {
        // Explicit allowlist: never forward descriptions, comments, files, invitations or hidden hours.
        var fields = new LinkedHashMap<String,Object>();
        fields.put("currentDateVietnam", java.time.LocalDate.now(java.time.ZoneId.of("Asia/Ho_Chi_Minh")).toString());
        fields.put("id", task.id()); fields.put("title", task.title() == null ? "" : task.title().substring(0, Math.min(120, task.title().length())));
        fields.put("status", task.status()); fields.put("priority", task.priority());
        fields.put("startsOn", task.startsOn()); fields.put("deadlineOn", task.deadlineOn());
        fields.put("estimatedHours", task.estimatedSeconds() / 3600.0); fields.put("blocked", task.blocked());
        if (task.decision() != null) {
            fields.put("systemPriorityScore", task.decision().score());
            fields.put("systemReasons", task.decision().reasons());
            fields.put("systemNextStep", task.decision().nextStep());
        }
        fields.put("visibleSpentHours", task.spentSeconds() == null ? "không có quyền xem" : task.spentSeconds() / 3600.0);
        if (data != null) {
            var projectTasks = data.tasks().stream()
                .filter(candidate -> Objects.equals(task.projectId(), candidate.projectId()))
                .sorted(Comparator.comparing(Task::deadlineOn, Comparator.nullsLast(String::compareTo))
                    .thenComparingLong(Task::id))
                .limit(40)
                .map(candidate -> taskSummary(candidate))
                .toList();
            fields.put("projectTaskSummary", projectTasks);
            fields.put("projectContextRule", "Danh sách là các nhiệm vụ cùng dự án có quyền xem. Không suy luận quan hệ phụ thuộc chỉ từ tên; chỉ khẳng định phụ thuộc khi hệ thống đã khai báo rõ.");
        }
        return new Snapshot(fields, new Source("TSK-" + task.id(), "/tasks/" + task.id(), task.deadlineOn(), task.estimatedSeconds() / 3600.0, task.spentSeconds() == null ? null : task.spentSeconds() / 3600.0));
    }
    private static String safeTitle(String title) { return title == null ? "" : title.substring(0, Math.min(120, title.length())); }
    private static Map<String, Object> taskSummary(Task task) {
        var result = new LinkedHashMap<String, Object>();
        result.put("id", task.id());
        result.put("title", safeTitle(task.title()));
        result.put("status", task.status() == null ? "" : task.status());
        result.put("priority", task.priority() == null ? "" : task.priority());
        result.put("deadlineOn", task.deadlineOn() == null ? "" : task.deadlineOn());
        result.put("assigneeId", task.assigneeId() == null ? "" : task.assigneeId());
        return result;
    }
    public DashboardSnapshot dashboard(String token, String userId) {
        var data = load(token);
        var managed = new HashSet<Long>();
        if (data.members() != null) data.members().stream()
            .filter(m -> userId.equals(m.id()) && ("Owner".equals(m.role()) || "Manager".equals(m.role())))
            .forEach(m -> managed.add(m.projectId()));
        var today = java.time.LocalDate.now(java.time.ZoneId.of("Asia/Ho_Chi_Minh"));
        var mine = data.tasks().stream().filter(t -> userId.equals(t.assigneeId()))
            .filter(t -> !"DONE".equals(t.status()) && !"CANCELLED".equals(t.status())).toList();
        var reviews = data.tasks().stream().filter(t -> !userId.equals(t.assigneeId()) && managed.contains(t.projectId()) && "IN_REVIEW".equals(t.status())).toList();
        var selected = java.util.stream.Stream.concat(mine.stream(), reviews.stream())
            .sorted(Comparator.comparingInt((Task t) -> "IN_REVIEW".equals(t.status()) && managed.contains(t.projectId()) && !userId.equals(t.assigneeId()) ? 0 : 1)
                .thenComparing(Comparator.comparingInt((Task t) -> t.decision() == null ? 0 : t.decision().score()).reversed())
                .thenComparing(t -> t.deadlineOn() == null ? "9999-12-31" : t.deadlineOn()).thenComparingLong(Task::id))
            .limit(3).map(task -> {
                var item = snapshot(task);
                boolean own = userId.equals(task.assigneeId());
                item.fields().put("viewerIsAssignee", own);
                item.fields().put("viewerCanReview", !own && managed.contains(task.projectId()) && "IN_REVIEW".equals(task.status()));
                item.fields().put("suggestionPurpose", task.blocked() ? "resolve_blocker"
                    : "IN_REVIEW".equals(task.status()) ? own ? "wait_for_feedback" : "review_submission"
                    : own ? "plan_own_work" : "read_only");
                return item;
            }).toList();
        long overdue = mine.stream().filter(t -> !"IN_REVIEW".equals(t.status()) && t.deadlineOn() != null && t.deadlineOn().compareTo(today.toString()) < 0).count();
        var counts = Map.of("myOpenTasks", (long) mine.size(), "myOverdueTasks", overdue,
            "myAwaitingReview", mine.stream().filter(t -> "IN_REVIEW".equals(t.status())).count(), "tasksNeedingMyReview", (long) reviews.size());
        var fields = new LinkedHashMap<String,Object>();
        fields.put("currentDateVietnam", today.toString()); fields.put("counts", counts);
        fields.put("scope", "All counts are from current permitted workspace; only up to 3 task examples are supplied. Do not claim to have analyzed every task.");
        fields.put("tasks", selected.stream().map(Snapshot::fields).toList());
        fields.put("reviewTaskIds", reviews.stream().filter(t -> selected.stream().anyMatch(x -> x.source().href().equals("/tasks/" + t.id()))).map(Task::id).toList());
        return new DashboardSnapshot(fields, selected.stream().map(Snapshot::source).toList(), counts);
    }
    public record DashboardSnapshot(Map<String,Object> fields, List<Source> sources, Map<String,Long> counts) {}
    public static boolean closed(String status) { return "DONE".equals(status) || "CANCELLED".equals(status); }
    public record Conversation(Long projectId, String projectName, Long taskId, List<ProjectTask> tasks) {}
    public record ProjectTask(Source source, String projectName, String title, String assignee, boolean assignedToViewer,
            String status, String priority, String startsOn, boolean blocked, String blockedReason,
            String description, List<Prerequisite> prerequisites) {}
    public record Prerequisite(String code, String title, String assignee, String status, Source source) {}
    private static AiException unavailable() { return new AiException(HttpStatus.SERVICE_UNAVAILABLE, "AI_CONTEXT_UNAVAILABLE", "Chưa tải được dữ liệu thật. Vui lòng thử lại sau."); }
    public record Source(String label, String href, String deadline, double estimatedHours, Double visibleSpentHours) {}
    public record Snapshot(Map<String,Object> fields, Source source) {}
    @JsonIgnoreProperties(ignoreUnknown = true) public record Envelope(Data data) {}
    @JsonIgnoreProperties(ignoreUnknown = true) public record Data(List<Task> tasks, List<Member> members) {}
    @JsonIgnoreProperties(ignoreUnknown = true) public record Member(long projectId, String id, String role, String name, String projectName) {}
    @JsonIgnoreProperties(ignoreUnknown = true) public record Decision(int score, String level, List<String> reasons, String nextStep) {}
    @JsonIgnoreProperties(ignoreUnknown = true) public record Task(long id, String title, String status, String priority, String startsOn, String deadlineOn, long estimatedSeconds, boolean blocked, Double spentSeconds, String assigneeId, Long projectId, Decision decision, String description, String blockedReason) {}
}

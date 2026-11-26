package vn.tasknest.aiservice;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.http.*;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import vn.tasknest.aiservice.infrastructure.work.TaskContext;
import vn.tasknest.aiservice.application.AiException;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class TaskContextTest {
    MockRestServiceServer server;
    TaskContext context;
    @BeforeEach void setup() {
        var builder = RestClient.builder().baseUrl("http://work-service");
        server = MockRestServiceServer.bindTo(builder).build(); context = new TaskContext(builder.build());
    }
    @Test void forwardsCallerAndOnlyAllowlistedSelectedTask() {
        server.expect(requestTo("http://work-service/api/work/projects/workspace"))
            .andExpect(header("Authorization", "Bearer caller"))
            .andRespond(withSuccess("""
                {"data":{"tasks":[{"id":1,"projectId":1,"title":"Selected","status":"IN_PROGRESS","priority":"HIGH","startsOn":"2026-11-01","deadlineOn":"2026-11-03","estimatedSeconds":3600,"blocked":false,"spentSeconds":null,"description":"private omitted"},{"id":2,"projectId":2,"title":"Other private task","estimatedSeconds":0,"blocked":false}],"invitations":["secret invitation"]}}
                """,MediaType.APPLICATION_JSON));
        var result = context.read("caller",1);
        assertThat(result.fields().toString()).doesNotContain("Other private", "private omitted", "secret invitation");
        assertThat(result.fields().get("visibleSpentHours")).isEqualTo("không có quyền xem");
        assertThat(result.source().href()).isEqualTo("/tasks/1"); server.verify();
        assertThat(result.source().estimatedHours()).isEqualTo(1.0);
        assertThat(result.source().visibleSpentHours()).isNull();
        assertThat(result.source().deadline()).isEqualTo("2026-11-03");
    }
    @Test void inaccessibleTaskIsNeverInvented() {
        server.expect(anything()).andRespond(withSuccess("{\"data\":{\"tasks\":[]}}",MediaType.APPLICATION_JSON));
        assertThatThrownBy(() -> context.read("caller",999)).isInstanceOf(AiException.class).hasMessageContaining("quyền xem");
    }
    @Test void includesSafeProjectTaskSummaryForTaskAnalysis() {
        server.expect(anything()).andRespond(withSuccess("""
            {"data":{"tasks":[
            {"id":18,"projectId":1,"assigneeId":"other","title":"Hoàn tất API","status":"IN_PROGRESS","priority":"HIGH","deadlineOn":"2026-11-17","estimatedSeconds":3600,"blocked":false},
            {"id":19,"projectId":1,"assigneeId":"me","title":"Tích hợp giao diện","status":"TODO","priority":"MEDIUM","deadlineOn":"2026-11-18","estimatedSeconds":3600,"blocked":false}]}}
            """, MediaType.APPLICATION_JSON));
        var result = context.read("caller", 19);
        assertThat(result.fields().get("projectTaskSummary").toString())
            .contains("Hoàn tất API", "Tích hợp giao diện")
            .doesNotContain("description");
    }
    @Test void failsClosedWhenMembershipRevoked() {
        server.expect(anything()).andRespond(withStatus(HttpStatus.FORBIDDEN));
        assertThatThrownBy(() -> context.read("caller",1)).isInstanceOf(AiException.class).hasMessageContaining("quyền");
    }
    @Test void projectContextIncludesAllVisibleTasksAndResolvesOnlySameProjectBlockers() {
        String history = java.util.stream.IntStream.rangeClosed(1, 45)
            .mapToObj(id -> "{\"id\":" + id + ",\"projectId\":1,\"title\":\"Lịch sử\",\"status\":\"DONE\",\"estimatedSeconds\":0,\"blocked\":false},")
            .collect(java.util.stream.Collectors.joining());
        server.expect(anything()).andRespond(withSuccess("""
            {"data":{"members":[{"projectId":1,"id":"me","name":"Mai"},{"projectId":1,"id":"dev","name":"Minh"}],"tasks":[%s
            {"id":82,"projectId":1,"title":"Bản dựng","assigneeId":"dev","status":"IN_PROGRESS","estimatedSeconds":1,"blocked":false},
            {"id":87,"projectId":1,"title":"Kiểm thử","assigneeId":"me","status":"TODO","estimatedSeconds":1,"blocked":true,"blockedReason":"Chờ TSK-82 và TSK-99."},
            {"id":99,"projectId":2,"title":"Ngoài dự án","assigneeId":"dev","status":"TODO","estimatedSeconds":1,"blocked":false}
            ]}}
            """.formatted(history), MediaType.APPLICATION_JSON));
        var result = context.conversation("caller", "me", 1L, null, "Tôi còn việc nào chưa xong?");
        assertThat(result.tasks()).hasSize(47);
        assertThat(result.tasks().getFirst().source().label()).isEqualTo("TSK-87");
        assertThat(result.tasks().getFirst().prerequisites()).singleElement()
            .satisfies(ref -> {
                assertThat(ref.code()).isEqualTo("TSK-82");
                assertThat(ref.assignee()).isEqualTo("Minh");
                assertThat(ref.status()).isEqualTo("IN_PROGRESS");
            });
    }
    @Test void projectContextRequiresLiveMembership() {
        server.expect(anything()).andRespond(withSuccess(
            "{\"data\":{\"tasks\":[],\"members\":[{\"id\":\"other\",\"projectId\":2}]}}",
            MediaType.APPLICATION_JSON));
        assertThatThrownBy(() -> context.conversation("caller", "me", 2L, null, "Việc còn lại"))
            .isInstanceOf(AiException.class).hasMessageContaining("quyền xem");
    }
    @Test void findsTheProjectNamedInAFreeFormQuestionFromTheDashboard() {
        server.expect(anything()).andRespond(withSuccess("""
            {"data":{"members":[
              {"projectId":1,"id":"me","projectName":"Ứng dụng AI Vibe Code"},
              {"projectId":2,"id":"me","projectName":"Kho nội bộ"}
            ],"tasks":[
              {"id":87,"projectId":1,"title":"Kiểm thử staging","status":"TODO","estimatedSeconds":1,"blocked":false},
              {"id":99,"projectId":2,"title":"Kiểm kê","status":"TODO","estimatedSeconds":1,"blocked":false}
            ]}}
            """, MediaType.APPLICATION_JSON));
        var result = context.conversation("caller", "me", null, null, "Dự án Ứng dụng AI Vibe Code còn chuẩn bị gì?");
        assertThat(result.projectName()).isEqualTo("Ứng dụng AI Vibe Code");
        assertThat(result.tasks()).extracting(TaskContext.ProjectTask::title).containsExactly("Kiểm thử staging");
    }
    @Test void doesNotFallbackToInventedContextOnOutage() {
        server.expect(anything()).andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE).body("sensitive server error"));
        assertThatThrownBy(() -> context.read("caller",1)).isInstanceOf(AiException.class).hasMessageNotContaining("sensitive");
    }
    @Test void dashboardSeparatesPersonalWorkFromManagedReviews() {
        server.expect(anything()).andRespond(withSuccess("""
            {"data":{"members":[{"projectId":1,"id":"me","role":"Owner"},{"projectId":2,"id":"me","role":"Member"}],"tasks":[
            {"id":1,"projectId":1,"assigneeId":"me","status":"IN_PROGRESS","title":"Mine","deadlineOn":"2000-01-01","estimatedSeconds":3600,"blocked":false},
            {"id":2,"projectId":1,"assigneeId":"me","status":"IN_REVIEW","title":"Awaiting","estimatedSeconds":3600,"blocked":false},
            {"id":3,"projectId":1,"assigneeId":"other","status":"IN_REVIEW","title":"Need review","estimatedSeconds":3600,"blocked":false},
            {"id":4,"projectId":2,"assigneeId":"other","status":"IN_REVIEW","title":"Not my review","estimatedSeconds":3600,"blocked":false},
            {"id":5,"projectId":1,"assigneeId":"me","status":"DONE","title":"Finished","estimatedSeconds":3600,"blocked":false}]}}
            """, MediaType.APPLICATION_JSON));
        var result = context.dashboard("caller","me");
        assertThat(result.counts()).containsEntry("myOpenTasks",2L).containsEntry("myOverdueTasks",1L)
            .containsEntry("myAwaitingReview",1L).containsEntry("tasksNeedingMyReview",1L);
        assertThat(result.sources()).hasSize(3);
        assertThat(result.fields().toString()).doesNotContain("Not my review", "Finished");
    }

    @Test void dashboardUsesSystemRankingAndPassesActionScope() {
        server.expect(anything()).andRespond(withSuccess("""
            {"data":{"members":[{"projectId":1,"id":"me","role":"Member"}],"tasks":[
            {"id":1,"projectId":1,"assigneeId":"me","status":"IN_PROGRESS","title":"Later","deadlineOn":"2026-11-06","estimatedSeconds":3600,"blocked":false,"decision":{"score":20,"level":"low","reasons":["Còn 2 ngày"],"nextStep":"Tiếp tục"}},
            {"id":2,"projectId":1,"assigneeId":"me","status":"IN_PROGRESS","title":"Blocked","deadlineOn":"2026-11-07","estimatedSeconds":3600,"blocked":true,"decision":{"score":80,"level":"high","reasons":["Đang bị chặn"],"nextStep":"Gỡ chặn"}}
            ]}}
            """, MediaType.APPLICATION_JSON));
        var result = context.dashboard("caller","me");
        assertThat(result.sources().getFirst().href()).isEqualTo("/tasks/2");
        @SuppressWarnings("unchecked")
        var tasks = (java.util.List<java.util.Map<String,Object>>) result.fields().get("tasks");
        assertThat(tasks.getFirst()).containsEntry("systemPriorityScore",80)
            .containsEntry("viewerIsAssignee",true).containsEntry("viewerCanReview",false)
            .containsEntry("suggestionPurpose","resolve_blocker");
    }
}

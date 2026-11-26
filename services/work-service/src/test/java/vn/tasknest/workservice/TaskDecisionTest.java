package vn.tasknest.workservice;
import org.junit.jupiter.api.Test;
import java.time.LocalDate;
import vn.tasknest.workservice.application.workspace.TaskDecision;
import static org.assertj.core.api.Assertions.*;
class TaskDecisionTest {
    final LocalDate today = LocalDate.of(2026,11,5);
    @Test void overdueBlockedTaskRanksAboveSoonTask() {
        var late = TaskDecision.evaluate("IN_PROGRESS","MEDIUM",today.minusDays(1),true,3600,4000.0,today);
        var soon = TaskDecision.evaluate("TODO","HIGH",today.plusDays(2),false,3600,null,today);
        assertThat(late.score()).isGreaterThan(soon.score()).isLessThanOrEqualTo(100);
        assertThat(late.nextStep()).contains("gỡ chặn");
    }
    @Test void hiddenTimeDoesNotProduceTimeWarningsAndReviewIsNotExecutionOverdue() {
        var result = TaskDecision.evaluate("IN_REVIEW","MEDIUM",today.minusDays(1),false,3600,null,today);
        assertThat(result.reasons()).containsExactly("Chờ duyệt sau deadline");
        assertThat(result.nextStep()).contains("chưa tiếp tục ghi giờ");
    }
    @Test void completedTasksHaveNoRiskAndTodayIsNotOverdue() {
        assertThat(TaskDecision.evaluate("DONE","URGENT",today.minusDays(5),true,1,100.0,today).score()).isZero();
        assertThat(TaskDecision.evaluate("TODO","LOW",today,false,3600,2880.0,today).reasons())
            .containsExactly("Đến hạn hôm nay","Đã dùng ít nhất 80% thời gian ước tính");
    }
}

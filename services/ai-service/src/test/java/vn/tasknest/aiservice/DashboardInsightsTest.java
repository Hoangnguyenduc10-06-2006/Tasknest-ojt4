package vn.tasknest.aiservice;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;
import vn.tasknest.aiservice.application.DashboardInsights;
import vn.tasknest.aiservice.infrastructure.work.TaskContext;
import java.util.List;
import static org.assertj.core.api.Assertions.*;

class DashboardInsightsTest {
    @Test void acceptsOnlySuppliedTaskIdsAndBoundsGeneratedSuggestions() {
        var result = DashboardInsights.parse(JsonMapper.builder().build(), """
            {"overview":"**Ưu tiên hôm nay**","attention":"Kiểm tra deadline","review":"Duyệt kết quả","awaiting":"Theo dõi phản hồi","taskHints":{"1":"Liên hệ người quản lý","999":"Forged task"}}
            """,List.of(new TaskContext.Source("TSK-1","/tasks/1","2026-11-05",3.0,null)));
        assertThat(result.overview()).isEqualTo("Ưu tiên hôm nay");
        assertThat(result.taskHints()).containsOnlyKeys("1");
        assertThat(result.review()).isEqualTo("Duyệt kết quả");
    }
    @Test void malformedStructuredOutputIsNeverShownAsRawJson() {
        var json = JsonMapper.builder().build();
        assertThat(DashboardInsights.parse(json,"{broken",List.of()).attention()).isEmpty();
        assertThat(DashboardInsights.parse(json,"Plain advice",List.of()).attention()).isEqualTo("Plain advice");
    }
    @Test void nonTextFieldsCannotBecomeUiSuggestions() {
        var result = DashboardInsights.parse(JsonMapper.builder().build(),"{\"overview\":{},\"taskHints\":{\"1\":true}}",List.of(new TaskContext.Source("TSK-1","/tasks/1","2026-11-05",3.0,null)));
        assertThat(result.overview()).isEmpty(); assertThat(result.taskHints()).isEmpty();
    }
}

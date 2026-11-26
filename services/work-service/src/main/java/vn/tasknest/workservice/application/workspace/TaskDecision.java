package vn.tasknest.workservice.application.workspace;

import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;

/** Explainable triage, not a completion prediction or productivity score. */
public record TaskDecision(int score, String level, List<String> reasons, String nextStep) {
    public static TaskDecision evaluate(String status, String priority, LocalDate deadline,
            boolean blocked, long estimate, Double spent, LocalDate today) {
        if (Set.of("DONE","CANCELLED").contains(status)) return new TaskDecision(0,"none",List.of(),"");
        int score = switch (priority == null ? "" : priority) {
            case "URGENT" -> 25; case "HIGH" -> 15; case "MEDIUM" -> 8; default -> 0;
        };
        List<String> reasons = new ArrayList<>();
        boolean review = "IN_REVIEW".equals(status);
        if (deadline != null) {
            long days = ChronoUnit.DAYS.between(today,deadline);
            if (days < 0) { score += 50; reasons.add(review ? "Chờ duyệt sau deadline" : "Quá hạn " + -days + " ngày"); }
            else if (days == 0) { score += 35; reasons.add("Đến hạn hôm nay"); }
            else if (days <= 3) { score += 20; reasons.add("Còn " + days + " ngày đến hạn"); }
        }
        if (blocked) { score += 30; reasons.add("Đang bị chặn"); }
        if (!review && spent != null && estimate > 0 && Double.isFinite(spent)) {
            if (spent > estimate) { score += 15; reasons.add("Đã vượt thời gian ước tính"); }
            else if (spent >= estimate * .8) { score += 8; reasons.add("Đã dùng ít nhất 80% thời gian ước tính"); }
        }
        score = Math.min(score,100);
        String next = blocked ? "Làm rõ vướng mắc và gỡ chặn trước khi tiếp tục."
            : review ? "Theo dõi kết quả duyệt; chưa tiếp tục ghi giờ."
            : score >= 35 ? "Kiểm tra phạm vi còn lại và trao đổi lại kế hoạch nếu cần."
            : "Tiếp tục theo kế hoạch đã giao.";
        return new TaskDecision(score,score >= 65 ? "high" : score >= 35 ? "medium" : "low",List.copyOf(reasons),next);
    }
}

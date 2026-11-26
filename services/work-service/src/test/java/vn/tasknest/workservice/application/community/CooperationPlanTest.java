package vn.tasknest.workservice.application.community;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
class CooperationPlanTest {
    @Test void longAgreementKeepsAllScopeInEditableDraftCriteria() {
        String plan="Phân tích yêu cầu, phát triển và kiểm thử toàn bộ phạm vi đã thống nhất. ".repeat(35);
        var criteria=CooperationService.planCriteria(plan);
        assertEquals(plan.replaceAll("\\s+",""),String.join("",criteria).replaceAll("\\s+",""));
        assertTrue(criteria.size()<=20);
        assertTrue(criteria.stream().allMatch(part->!part.isBlank()&&part.length()<=300));
    }
    @Test void chunkBoundaryDoesNotBreakUnicodeCharacters() {
        String plan="a".repeat(299)+"🚀"+"b".repeat(30);
        var criteria=CooperationService.planCriteria(plan);
        assertEquals(plan,String.join("",criteria));
        assertFalse(Character.isHighSurrogate(criteria.getFirst().charAt(criteria.getFirst().length()-1)));
    }
    @Test void validPlanWithWidelySpacedWordsFitsMilestoneLimits() {
        String word = "a".repeat(151);
        String plan = String.join(" ", java.util.Collections.nCopies(26, word));
        var criteria = CooperationService.planCriteria(plan);
        assertTrue(criteria.size() <= 20);
        assertTrue(criteria.stream().allMatch(part -> part.length() <= 300));
        assertEquals(plan.replace(" ", ""), String.join("", criteria).replace(" ", ""));
    }
}

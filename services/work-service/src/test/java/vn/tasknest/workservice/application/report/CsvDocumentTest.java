package vn.tasknest.workservice.application.report;

import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class CsvDocumentTest {
    @Test void preservesVietnameseQuotesCommasAndLineBreaks() {
        var csv = new CsvDocument();
        csv.row("Báo cáo", "API, \"đăng nhập\"\nđã duyệt", null, 42);
        assertEquals("\uFEFF\"Báo cáo\",\"API, \"\"đăng nhập\"\"\nđã duyệt\",\"\",\"42\"\r\n",
            new String(csv.bytes(), StandardCharsets.UTF_8));
    }

    @Test void neutralizesFormulasEvenWithLeadingWhitespace() {
        var csv = new CsvDocument();
        csv.row("=HYPERLINK(\"https://example.com\")", "  +1", "-2", "@SUM(A1)", "\ttext", "normal");
        String text = new String(csv.bytes(), StandardCharsets.UTF_8);
        assertTrue(text.contains("\"'=HYPERLINK"));
        assertTrue(text.contains("\"'  +1\""));
        assertTrue(text.contains("\"'-2\""));
        assertTrue(text.contains("\"'@SUM(A1)\""));
        assertTrue(text.contains("\"'\ttext\""));
        assertTrue(text.endsWith("\"normal\"\r\n"));
    }
}

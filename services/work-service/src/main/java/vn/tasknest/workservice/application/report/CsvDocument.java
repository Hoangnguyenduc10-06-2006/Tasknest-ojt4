package vn.tasknest.workservice.application.report;

import java.nio.charset.StandardCharsets;

/** UTF-8 with BOM for Excel; quoted fields preserve commas, quotes and line breaks. */
final class CsvDocument {
    private final StringBuilder text = new StringBuilder("\uFEFF");

    void row(Object... fields) {
        for (int index = 0; index < fields.length; index++) {
            if (index > 0) text.append(',');
            String value = fields[index] == null ? "" : fields[index].toString();
            // Quoting alone does not stop spreadsheet formula evaluation.
            String trimmed = value.stripLeading();
            if ((!trimmed.isEmpty() && "=+-@".indexOf(trimmed.charAt(0)) >= 0)
                    || (!value.isEmpty() && "\t\r\n".indexOf(value.charAt(0)) >= 0)) {
                value = "'" + value;
            }
            text.append('"').append(value.replace("\"", "\"\"")).append('"');
        }
        text.append("\r\n");
    }

    byte[] bytes() {
        return text.toString().getBytes(StandardCharsets.UTF_8);
    }
}

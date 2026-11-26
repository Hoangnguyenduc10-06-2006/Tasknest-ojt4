package vn.tasknest.workservice.api.submission;

import jakarta.validation.constraints.*;

/** Stable newest-first history; page is zero-based. */
public record SubmissionHistoryQuery(@Min(0) Integer page, Integer size) {
    public SubmissionHistoryQuery {
        page = page == null ? 0 : page;
        size = size == null ? 20 : size;
    }

    @AssertTrue(message = "Kích thước trang phải là 10, 20 hoặc 50.")
    public boolean isSizeValid() {
        return size == 10 || size == 20 || size == 50;
    }

    @AssertTrue(message = "Chỉ số trang và kích thước vượt quá giới hạn cho phép.")
    public boolean isOffsetValid() {
        return page < 0 || size <= 0 || (long) page * size <= Integer.MAX_VALUE;
    }

    public long offset() {
        return (long) page * size;
    }
}

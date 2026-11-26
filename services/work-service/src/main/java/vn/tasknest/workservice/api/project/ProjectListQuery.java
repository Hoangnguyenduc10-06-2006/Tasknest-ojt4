package vn.tasknest.workservice.api.project;

import jakarta.validation.constraints.*;
import vn.tasknest.workservice.domain.project.*;

/** Use @Valid @ModelAttribute when implementing GET. page is zero-based. */
public record ProjectListQuery(@Size(max = 100) String q, ProjectStatus status, ProjectRole role,
    @Min(0) Integer page, Integer size, Sort sort) {
    public enum Sort { UPDATED_DESC, NAME_ASC, NAME_DESC }
    public ProjectListQuery {
        q = q == null ? "" : q.strip();
        page = page == null ? 0 : page;
        size = size == null ? 20 : size;
        sort = sort == null ? Sort.UPDATED_DESC : sort;
    }
    @AssertTrue(message = "Kích thước trang phải là 10, 20 hoặc 50.")
    public boolean isSizeValid() {
        return size != null && (size == 10 || size == 20 || size == 50);
    }
    @AssertTrue(message = "Chỉ số trang và kích thước vượt quá giới hạn cho phép.")
    public boolean isOffsetValid() {
        return page == null || size == null || page < 0 || size <= 0 || (long) page * size <= Integer.MAX_VALUE;
    }
}

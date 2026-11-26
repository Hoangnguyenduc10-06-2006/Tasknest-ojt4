import type {
  MyProjectItem,
  ProjectFormData,
  ProjectValidationResult,
} from './project.types';

export function normalizeProjectName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export function isProjectReadOnly(
  project: Pick<MyProjectItem, 'status'> | null | undefined,
): boolean {
  if (!project) return false;
  return project.status === 'ARCHIVED';
}

export function getProjectReadOnlyReason(
  project: Pick<MyProjectItem, 'status'> | null | undefined,
): string | undefined {
  if (!isProjectReadOnly(project)) return undefined;
  return 'Dự án đã lưu trữ chỉ được xem lại; không thể chỉnh sửa dữ liệu, tạo hoặc chuyển trạng thái nhiệm vụ, ghi giờ hay thay đổi thành viên.';
}

export function canDevelopProject(
  project:
    | Pick<MyProjectItem, 'status' | 'role' | 'developmentState'>
    | null
    | undefined,
): boolean {
  return (
    !!project &&
    project.status === 'ACTIVE' &&
    project.role !== 'Customer' &&
    (!project.developmentState || project.developmentState === 'ACTIVE')
  );
}
export function developmentReadOnlyReason(
  project: Pick<MyProjectItem, 'developmentState'> | null | undefined,
): string | undefined {
  if (project?.developmentState === 'COMPLETED')
    return 'Dự án đã được khách hàng nghiệm thu. Dữ liệu dự án chỉ được xem. Khách hàng và chủ đội cần đồng ý để mở lại.';
  if (project?.developmentState === 'PENDING_KICKOFF')
    return 'Chủ đội cần chọn nhân sự và khởi động dự án trong tab Tổng quan trước khi giao việc.';
  return undefined;
}

export function canEditProject(
  project: Pick<MyProjectItem, 'role' | 'status' | 'developmentState'> | null | undefined,
): boolean {
  if (!project || isProjectReadOnly(project) || project.developmentState === 'COMPLETED') return false;
  return project.role === 'Owner' || project.role === 'Manager';
}

export function canArchiveOrReopenProject(
  project: Pick<MyProjectItem, 'role' | 'status' | 'developmentState'> | Pick<MyProjectItem, 'role'> | null | undefined,
): boolean {
  if (!project) return false;
  return project.role === 'Owner' &&
    (!('developmentState' in project) || project.developmentState !== 'COMPLETED' || project.status === 'ARCHIVED');
}

export function hasRunningTimerInProject(
  projectId: string | number,
  timeEntries?: ReadonlyArray<{
    projectId: number | string;
    endedAt: string | null;
  }>,
): boolean {
  if (!timeEntries || timeEntries.length === 0) return false;
  const targetId = String(projectId);
  return timeEntries.some(
    (entry) => String(entry.projectId) === targetId && entry.endedAt === null,
  );
}

export function validateProjectArchiveAction(
  project:
    | Pick<MyProjectItem, 'id' | 'role' | 'status' | 'version'>
    | null
    | undefined,
  timeEntries?: ReadonlyArray<{
    projectId: number | string;
    endedAt: string | null;
  }>,
): string | undefined {
  if (!project) {
    return 'Không tìm thấy thông tin dự án.';
  }
  if (!canArchiveOrReopenProject(project)) {
    return 'Chỉ Owner mới có quyền lưu trữ hoặc mở lại dự án.';
  }
  if (project.version === undefined || project.version === null) {
    return 'Phiên bản dự án không xác định. Vui lòng tải lại trang và thử lại.';
  }
  if (
    project.status === 'ACTIVE' &&
    hasRunningTimerInProject(project.id, timeEntries)
  ) {
    return 'Không thể lưu trữ dự án khi vẫn còn phiên ghi giờ đang chạy. Vui lòng dừng tất cả phiên ghi giờ trước.';
  }
  return undefined;
}

export function formatProjectDateRange(start?: string, end?: string): string {
  if (!start && !end) return 'Linh hoạt';
  const formatDate = (iso: string) => {
    const parts = iso.split('-');
    if (parts.length === 3) {
      return `${parts[2]} thg ${parseInt(parts[1], 10)}, ${parts[0]}`;
    }
    return iso;
  };
  if (start && end) return `${formatDate(start)} – ${formatDate(end)}`;
  return formatDate(start || end || '');
}

export function validateProjectForm(
  data: ProjectFormData,
  existingNames: string[] = [],
): ProjectValidationResult {
  const errors: Partial<Record<keyof ProjectFormData, string>> = {};

  const trimmedName = normalizeProjectName(data.name || '');
  if (!trimmedName) {
    errors.name = 'Tên dự án không được để trống.';
  } else if (trimmedName.length < 3 || trimmedName.length > 100) {
    errors.name = 'Tên dự án phải từ 3 đến 100 ký tự.';
  } else {
    const isDuplicate = existingNames.some(
      (existing) => existing.toLowerCase() === trimmedName.toLowerCase(),
    );
    if (isDuplicate) {
      errors.name =
        'Tên dự án đã tồn tại trong danh sách dự án chưa lưu trữ của bạn.';
    }
  }

  const trimmedDesc = (data.description || '').trim();
  if (!trimmedDesc) {
    errors.description = 'Mô tả dự án không được để trống.';
  } else if (trimmedDesc.length < 10 || trimmedDesc.length > 500) {
    errors.description = 'Mô tả dự án phải từ 10 đến 500 ký tự.';
  }

  if (!data.startDate) {
    errors.startDate = 'Vui lòng chọn ngày bắt đầu dự kiến.';
  }

  if (!data.endDate) {
    errors.endDate = 'Vui lòng chọn ngày kết thúc dự kiến.';
  } else if (data.startDate && data.endDate < data.startDate) {
    errors.endDate = 'Ngày kết thúc không được trước ngày bắt đầu.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function generateProjectCode(name: string): string {
  const words = normalizeProjectName(name).split(' ').filter(Boolean);
  if (words.length === 0) return 'PR';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

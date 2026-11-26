import { statusLabels as taskStatusLabels } from './task-board';
const priorityLabels: Record<string, string> = { URGENT: 'Khẩn cấp', HIGH: 'Cao', MEDIUM: 'Trung bình', LOW: 'Thấp' };
const alertLabels: Record<string, string> = { DUE_SOON: 'Sắp đến hạn', OVERDUE: 'Quá hạn thực hiện', REVIEW_OVERDUE: 'Chờ duyệt sau deadline', RISK: 'Rủi ro vượt ước tính', OVERRUN: 'Vượt thời gian ước tính' };
const fields: Record<string, string> = { name: 'Tên nhiệm vụ', title: 'Tên nhiệm vụ', description: 'Mô tả', assigneeId: 'Người phụ trách', assignee_user_id: 'Người phụ trách', status: 'Trạng thái', priority: 'Ưu tiên', starts_on: 'Ngày bắt đầu', startsOn: 'Ngày bắt đầu', deadline_on: 'Deadline', deadlineOn: 'Deadline', estimated_seconds: 'Ước tính (giờ)', estimatedSeconds: 'Ước tính (giờ)', blocked: 'Bị chặn', is_blocked: 'Bị chặn', blocked_reason: 'Lý do', reason: 'Lý do', note: 'Ghi chú', startedAt: 'Bắt đầu ghi giờ', endedAt: 'Kết thúc ghi giờ', alertType: 'Loại cảnh báo' };
export function historyFields(raw: string | null, members: { id: string; name: string }[]): { label: string; value: string; original: string }[] {
  if (!raw) return [];
  try {
    const values: unknown = JSON.parse(raw); if (!values || typeof values !== 'object' || Array.isArray(values)) return [];
    return Object.entries(values).flatMap(([key, value]) => {
      if (!Object.hasOwn(fields, key) || value != null && typeof value === 'object') return [];
      let text = value == null ? 'Chưa có' : typeof value === 'boolean' ? value ? 'Có' : 'Không' : String(value);
      let original = String(value ?? '');
      if ((key === 'assigneeId' || key === 'assignee_user_id') && original) text = members.find(member => member.id === original)?.name ?? 'Thành viên cũ';
      if (key === 'status') text = taskStatusLabels[(value === 'IN_REVIEW' ? 'REVIEW' : String(value)) as keyof typeof taskStatusLabels] ?? text;
      if (key === 'priority') text = priorityLabels[String(value) as keyof typeof priorityLabels] ?? text;
      if (key === 'alertType') text = alertLabels[String(value)] ?? text;
      if (key === 'estimated_seconds' || key === 'estimatedSeconds') {
        if (original && Number.isFinite(Number(value))) text = (Number(value) / 3600).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
      }
      if (key === 'blocked' || key === 'is_blocked') {
        if (value === 1 || value === '1' || value === true) { original = 'true'; text = 'Có'; }
        if (value === 0 || value === '0' || value === false) { original = 'false'; text = 'Không'; }
      }
      return [{ label: fields[key], value: text, original }];
    });
  } catch { return []; }
}

export function taskHistoryChanges(before: string | null, after: string | null, members: { id: string; name: string }[]) {
  const previous = new Map(historyFields(before, members).map(field => [field.label, field]));
  return historyFields(after, members).flatMap(field => {
    const earlier = previous.get(field.label);
    return earlier?.original === field.original ? [] : [{
      label: field.label,
      before: earlier?.value || '—',
      after: field.value || '—',
      changed: Boolean(earlier),
    }];
  });
}

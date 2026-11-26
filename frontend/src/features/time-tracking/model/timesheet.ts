import { businessToday } from '../../../shared/utils/business-date';
import type { TimeEntry } from '../../workspace';

export function toLocalTime(iso: string) {
  return new Date(Date.parse(iso) + 7 * 3600000).toISOString().slice(0, 19);
}
export function fromLocalTime(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)) return NaN;
  const result = Date.parse(value + '+07:00');
  const local = Number.isFinite(result)
    ? toLocalTime(new Date(result).toISOString())
    : '';
  return local.slice(0, value.length) === value ? result : NaN;
}
export function intervalSeconds(
  entry: Pick<TimeEntry, 'startedAt' | 'endedAt'>,
  now: number,
  from = -Infinity,
  to = Infinity,
) {
  const start = Math.max(Date.parse(entry.startedAt), from);
  const end = Math.min(
    entry.endedAt ? Date.parse(entry.endedAt) : now,
    now,
    to,
  );
  return Math.max(0, (end - start) / 1000);
}
export function summarizeTime(entries: TimeEntry[], now: number) {
  const today = businessToday(now);
  const midnight = Date.parse(today + 'T00:00:00+07:00');
  const weekday = new Date(today + 'T00:00:00Z').getUTCDay();
  const monday = midnight - ((weekday + 6) % 7) * 86400000;
  const month = Date.parse(today.slice(0, 7) + '-01T00:00:00+07:00');
  return [midnight, monday, month].map((from) =>
    entries.reduce((sum, entry) => sum + intervalSeconds(entry, now, from), 0),
  );
}
export function validateTimeRange(
  start: string,
  end: string,
  reason: string,
  entries: TimeEntry[],
  now: number,
  excludedId?: number,
) {
  const from = fromLocalTime(start),
    to = fromLocalTime(end);
  if (!Number.isFinite(from) || !Number.isFinite(to))
    return 'Vui lòng nhập đầy đủ ngày và giờ hợp lệ.';
  if (to <= from) return 'Thời điểm kết thúc phải sau thời điểm bắt đầu.';
  if (to > now) return 'Không được ghi giờ trong tương lai.';
  if (!reason.trim() || reason.trim().length > 4000)
    return 'Lý do phải có từ 1 đến 4000 ký tự.';
  if (
    entries.some(
      (entry) =>
        entry.id !== excludedId &&
        Date.parse(entry.startedAt) < to &&
        (!entry.endedAt || Date.parse(entry.endedAt) > from),
    )
  )
    return 'Khoảng thời gian trùng với phiên khác của bạn, kể cả phiên đang chạy.';
  return undefined;
}
export type TimeFilters = {
  search: string;
  projectId: string;
  taskId: string;
  fromDate: string;
  toDate: string;
};
export function filterTimeEntries(
  entries: TimeEntry[],
  filters: TimeFilters,
  now: number,
) {
  const query = filters.search.trim().toLocaleLowerCase('vi');
  const from = filters.fromDate
    ? Date.parse(filters.fromDate + 'T00:00:00+07:00')
    : -Infinity;
  const to = filters.toDate
    ? Date.parse(filters.toDate + 'T00:00:00+07:00') + 86400000
    : Infinity;
  return entries.filter(
    (entry) =>
      (!query ||
        `${entry.taskTitle} ${entry.projectName} TSK-${entry.taskId}`
          .toLocaleLowerCase('vi')
          .includes(query)) &&
      (filters.projectId === 'ALL' ||
        String(entry.projectId) === filters.projectId) &&
      (filters.taskId === 'ALL' || String(entry.taskId) === filters.taskId) &&
      Date.parse(entry.startedAt) < to &&
      Date.parse(entry.endedAt ?? new Date(now).toISOString()) > from,
  );
}

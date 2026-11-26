export type ProjectReportType = 'TASKS' | 'TIME' | 'SPRINT';

export function reportPeriodError(from: string, to: string): string | undefined {
  const parse = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number(value.slice(0, 4)) < 1000) return NaN;
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date.getTime() : NaN;
  };
  const start = parse(from);
  const end = parse(to);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 'Chọn đầy đủ ngày bắt đầu và ngày kết thúc hợp lệ.';
  if (start > end) return 'Ngày bắt đầu không được sau ngày kết thúc.';
  if ((end - start) / 86400000 >= 366) return 'Khoảng báo cáo tối đa 366 ngày, tính cả ngày đầu và cuối.';
  return undefined;
}

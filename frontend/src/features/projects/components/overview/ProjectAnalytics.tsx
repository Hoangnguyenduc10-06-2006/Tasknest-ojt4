import { ProjectReportExport } from './ProjectReportExport';
import { useCallback, useState } from 'react';
import { useWorkspace } from '../../../workspace';
import { authenticatedAccessToken } from '../../../auth';
import { requestJson } from '../../../../shared/api/client';
import { Modal } from '../../../../shared/ui/Modal';
import { Panel } from '../../../../shared/ui/Panel';
import { useReloadableData as useCollaborationData } from '../../../../shared/hooks/useReloadableData';

type Analytics = {
  from: string; to: string; group: string;
  completions: { period: string; taskId: number; title: string }[];
  workload: { userId: string; openCount: number; overdueCount: number; blockedCount: number }[];
  comparison: { id: number; title: string; estimatedSeconds: number; loggedSeconds: number }[];
  timeScope: string;
};
const hours = (seconds: number) => (seconds / 3600).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
const shortDate = (value: string) => new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'numeric', timeZone: 'UTC' }).format(new Date(value.slice(0, 10) + 'T00:00:00Z'));

export function ProjectAnalytics({ project }: { project: string }) {
  const workspace = useWorkspace();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const [from, setFrom] = useState('');
  const [to, setTo] = useState(today);
  const [group, setGroup] = useState('DAY');
  const [period, setPeriod] = useState<string>();
  const invalid = Boolean(from && to && from > to);
  const load = useCallback(async () => {
    if (from && to && from > to) throw new Error('Ngày bắt đầu không được sau ngày kết thúc.');
    const token = await authenticatedAccessToken();
    const query = new URLSearchParams({ to, group, ...(from ? { from } : {}) });
    return requestJson<{ data: Analytics }>(`/api/work/projects/${project}/analytics?${query}`, { accessToken: token });
  }, [project, from, to, group]);
  const state = useCollaborationData(load);
  const data = invalid ? undefined : state.data;
  const counts = new Map<string, Set<number>>();
  for (const row of data?.completions ?? []) {
    const key = String(row.period).slice(0, 10);
    if (!counts.has(key)) counts.set(key, new Set());
    counts.get(key)!.add(row.taskId);
  }
  const periods: string[] = [];
  if (data) {
    const date = new Date(data.from.slice(0, 10) + 'T00:00:00Z');
    const end = new Date(data.to.slice(0, 10) + 'T00:00:00Z');
    if (data.group === 'WEEK') date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
    while (date <= end && periods.length < 3660) {
      periods.push(date.toISOString().slice(0, 10));
      date.setUTCDate(date.getUTCDate() + (data.group === 'WEEK' ? 7 : 1));
    }
  }
  const completionMax = Math.max(1, ...Array.from(counts.values(), ids => ids.size));
  const workloadMax = Math.max(1, ...(data?.workload.map(row => row.openCount) ?? []));
  const timeMax = Math.max(1, ...(data?.comparison.flatMap(row => [row.estimatedSeconds, row.loggedSeconds]) ?? []));
  return <section className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><h2 className="text-xl font-semibold">Biểu đồ tiến độ và thời gian</h2><p className="mt-2 text-xs text-muted">Theo dõi số nhiệm vụ được duyệt, khối lượng còn lại và thời gian thực hiện.</p></div>
      <div className="flex flex-wrap items-end gap-3">
        <ProjectReportExport project={project} />
        <label className="field"><span>Từ ngày</span><input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
        <label className="field"><span>Đến ngày</span><input type="date" required value={to} onChange={e => setTo(e.target.value)} /></label>
        <label className="field"><span>Nhóm theo</span><select value={group} onChange={e => setGroup(e.target.value)}><option value="DAY">Ngày</option><option value="WEEK">Tuần (từ thứ Hai)</option></select></label>
      </div>
    </div>
    {state.error && <p role="alert" className="rounded-xl bg-danger-soft p-4 text-sm text-danger">{state.error}</p>}
    {!data && !state.error && <p role="status" className="text-muted">Đang tải biểu đồ…</p>}
    {data && <>
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">Nhiệm vụ hoàn thành theo kỳ</h3><p className="mt-1 text-xs text-muted">{data.from} – {data.to} · Nhấp cột để xem nhiệm vụ đã duyệt.</p></div><span className="text-xs text-success">● Đã duyệt</span></div>
        <div className="mt-6 overflow-x-auto">
          <div className="completion-chart" style={{ minWidth: Math.max(300, periods.length * 32) }}>
            <div className="completion-axis"><span>{completionMax}</span><span>{Math.floor(completionMax / 2)}</span><span>0</span></div>
            <div className="completion-columns">
              {periods.map(bucket => {
                const count = counts.get(bucket)?.size ?? 0;
                return <button type="button" key={bucket} className="completion-column" onClick={() => setPeriod(bucket)} aria-label={`${bucket}: ${count} nhiệm vụ hoàn thành`}>
                  <span className="completion-plot"><span className="completion-bar" style={{ height: count ? `${count / completionMax * 100}%` : '2px' }}><strong>{count > 0 ? count : ''}</strong></span></span>
                  <span className="completion-label">{shortDate(bucket)}</span>
                </button>;
              })}
            </div>
          </div>
        </div>
        {!counts.size && <p className="mt-3 text-xs text-muted">Chưa có nhiệm vụ được duyệt trong kỳ. Các cột đang ở mức 0.</p>}
        <p className="mt-4 text-[11px] text-muted">Ngày/tuần theo giờ Việt Nam. Đếm nhiệm vụ phân biệt được duyệt trong từng kỳ; số này khác tỷ lệ hoàn thành hiện tại.</p>
      </Panel>
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <Panel>
          <h3 className="font-semibold">Khối lượng theo người phụ trách</h3><p className="mt-1 text-xs text-muted">Nhiệm vụ chưa hoàn thành / chưa hủy.</p>
          <div className="mt-6 space-y-5">
            {data.workload.map(row => <div key={row.userId}>
              <div className="mb-2 flex justify-between gap-3 text-xs"><strong>{workspace.data?.members.find(member => member.id === row.userId && member.projectId === project)?.name ?? 'Thành viên cũ'}</strong><span>{row.openCount} nhiệm vụ</span></div>
              <div className="h-3 overflow-hidden rounded-full bg-panel" role="meter" aria-label="Nhiệm vụ đang mở" aria-valuemin={0} aria-valuemax={workloadMax} aria-valuenow={row.openCount}><div className="h-full rounded-full bg-accent" style={{ width: `${row.openCount / workloadMax * 100}%` }} /></div>
              <div className="mt-2 flex gap-4 text-[11px]"><span className="text-danger">{row.overdueCount} quá hạn</span><span className="text-warning">{row.blockedCount} bị chặn</span></div>
            </div>)}
            {!data.workload.length && <p className="py-8 text-center text-sm text-muted">Không có nhiệm vụ đang mở.</p>}
          </div>
        </Panel>
        <Panel>
          <h3 className="font-semibold">Ước tính và thời gian đã ghi</h3>
          <p className="mt-1 text-xs text-muted">{data.timeScope === 'PROJECT' ? 'Giờ toàn dự án theo quyền quản lý.' : 'Chỉ giờ của bạn trên nhiệm vụ đang được giao cho bạn.'}</p>
          <div className="mt-4 flex gap-4 text-xs"><span className="text-accent">● Ước tính</span><span className="text-success">● Đã ghi</span></div>
          <div className="mt-5 space-y-5">
            {data.comparison.map(row => <div key={row.id}>
              <a className="text-xs font-semibold hover:text-accent" href={`/tasks/${row.id}`}>{row.title}</a>
              <div className="mt-2 grid grid-cols-[1fr_4rem] items-center gap-x-3 gap-y-2 text-[11px]">
                <div className="h-2 rounded bg-panel"><div className="h-full rounded bg-accent" style={{ width: `${row.estimatedSeconds / timeMax * 100}%` }} /></div><span>{hours(row.estimatedSeconds)} giờ</span>
                <div className="h-2 rounded bg-panel"><div className="h-full rounded bg-success" style={{ width: `${row.loggedSeconds / timeMax * 100}%` }} /></div><span>{hours(row.loggedSeconds)} giờ</span>
              </div>
            </div>)}
            {!data.comparison.length && <p className="py-8 text-center text-sm text-muted">Chưa có dữ liệu trong phạm vi được phép.</p>}
          </div>
          <p className="mt-5 text-[11px] text-muted">Bao gồm timer đang chạy. Giờ làm không phải điểm năng suất.</p>
        </Panel>
      </div>
    </>}
    {period && data && <Modal open title={`Nhiệm vụ được duyệt: ${period}`} onClose={() => setPeriod(undefined)}>
      <ul className="space-y-3">{data.completions.filter(row => String(row.period).slice(0, 10) === period).map(row => <li key={row.taskId}><a className="text-accent" href={`/tasks/${row.taskId}`}>TSK-{row.taskId} · {row.title}</a></li>)}</ul>
      {!counts.get(period)?.size && <p className="text-sm text-muted">Không có nhiệm vụ được duyệt trong kỳ này.</p>}
    </Modal>}
  </section>;
}

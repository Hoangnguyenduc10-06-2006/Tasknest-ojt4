import { Panel } from '../../../shared/ui/Panel';
import { Badge } from '../../../shared/ui/Badge';
import { Icon } from '../../../shared/ui/Icon';
import type { TimeEntry } from '../../workspace';
import { intervalSeconds } from '../model/timesheet';
import { formatDuration } from '../model/timer';

export function TaskTimeSummary({ entries, taskId, projectId, now, loading }: {
  entries: TimeEntry[]; taskId: string; projectId: string; now: number; loading: boolean;
}) {
  const sessions = entries.filter(entry => String(entry.taskId) === taskId && String(entry.projectId) === projectId)
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
  const total = sessions.reduce((sum, entry) => sum + intervalSeconds(entry, now), 0);
  const running = sessions.find(entry => !entry.endedAt);
  const stamp = (value: string) => new Date(value).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
  return <Panel>
    <header className="flex items-center justify-between gap-3"><h2 className="font-medium">Phiên ghi giờ</h2><a href="/my-time" className="text-xs font-semibold text-accent">Xem tất cả</a></header>
    <p className="mt-2 text-xs text-muted">Thời gian của bạn trên nhiệm vụ này</p>
    {loading ? <p role="status" className="mt-5 text-sm text-muted">Đang tải phiên ghi giờ…</p> : <>
      <dl className="my-4 grid grid-cols-[1fr_auto] gap-4 rounded-xl bg-panel p-3">
        <div><dt className="text-[11px] text-muted">Tổng đã ghi</dt><dd className="mt-1 font-mono text-lg font-semibold tabular-nums">{formatDuration(total)}</dd></div>
        <div className="text-right"><dt className="text-[11px] text-muted">Số phiên</dt><dd className="mt-1 text-lg font-semibold">{sessions.length}</dd></div>
      </dl>
      {running && <p className="mb-3 flex items-center gap-2 text-xs text-success"><span className="size-2 rounded-full bg-success" />Đang ghi · {formatDuration(intervalSeconds(running, now))}</p>}
      {sessions.length ? <ul className="divide-y divide-line">
        {sessions.slice(0, 3).map(entry => <li key={entry.id} className="py-3">
          <div className="flex items-center justify-between gap-3"><time dateTime={entry.startedAt} className="text-[11px] text-muted">{stamp(entry.startedAt)}</time><strong className="font-mono text-xs tabular-nums">{formatDuration(intervalSeconds(entry, now))}</strong></div>
          <div className="mt-2 flex items-center justify-between gap-2"><span className="text-[10px] text-muted">{entry.endedAt ? `Kết thúc ${stamp(entry.endedAt)}` : 'Chưa kết thúc'}</span><Badge tone={!entry.endedAt ? 'green' : 'neutral'}>{!entry.endedAt ? 'Đang chạy' : entry.source === 'MANUAL' ? 'Bổ sung' : 'Đã kết thúc'}</Badge></div>
        </li>)}
      </ul> : <p className="flex items-center gap-2 py-4 text-xs text-muted"><Icon name="clock" />Bạn chưa ghi giờ cho nhiệm vụ này.</p>}
      {sessions.length > 3 && <p className="mt-2 text-[11px] text-muted">Hiển thị 3 phiên gần nhất trong {sessions.length} phiên.</p>}
    </>}
  </Panel>;
}

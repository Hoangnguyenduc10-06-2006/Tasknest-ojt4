import { Button } from '../../../shared/ui/Button';
import { Pagination } from '../../../shared/ui/Pagination';
import { useSubmissionHistory } from '../hooks/useSubmissionHistory';
import { SubmissionHistoryList } from './SubmissionHistoryList';

export function TaskSubmissionHistory({ userId, project, task, active, taskVersion, revision }: {
  userId?: string; project: string; task: string; active: boolean; taskVersion?: number; revision?: number;
}) {
  const history = useSubmissionHistory(userId, project, task, active, taskVersion, revision);
  if (!userId) return <p role="status" className="text-sm text-muted">Đang kiểm tra phiên đăng nhập…</p>;
  return <section className="space-y-4" aria-label="Kết quả nộp và duyệt" aria-busy={history.loading}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        {history.data && <p className="text-sm font-semibold">{history.data.totalElements} lần nộp kết quả</p>}
        <p className="mt-1 text-xs text-muted">Lần nộp mới nhất ở trên cùng. Thời gian theo giờ Việt Nam.</p>
      </div>
      <Button variant="secondary" size="sm" disabled={history.loading} onClick={() => void history.refresh()}>Tải lại lần nộp</Button>
    </div>
    {history.error && <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{history.error}</p>}
    {history.loading && <p role="status" className="text-sm text-muted">{history.data ? 'Đang cập nhật kết quả…' : 'Đang tải lịch sử kết quả…'}</p>}
    {history.data && <>
      {history.data.content.length ? <SubmissionHistoryList items={history.data.content} context={{ userId, project, task }} onFileError={history.onFileError} /> : <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">Chưa có lần nộp kết quả.</p>}
      {history.data.totalPages > 1 && <Pagination page={history.page} total={history.data.totalElements} size={history.data.size} disabled={history.loading} onChange={history.setPage} />}
    </>}
  </section>;
}

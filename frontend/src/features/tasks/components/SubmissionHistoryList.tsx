import { Badge, type BadgeTone } from '../../../shared/ui/Badge';
import { SubmissionResultFile, type SubmissionDownloadContext } from './SubmissionResultFile';
import { submissionResultUrl, submissionTimestamp, type SubmissionHistoryItem, type SubmissionOutcome } from '../model/submission-history';

const outcomes: Record<SubmissionOutcome, { label: string; tone: BadgeTone }> = {
  PENDING: { label: 'Chờ duyệt', tone: 'purple' },
  ACCEPTED: { label: 'Đã chấp nhận', tone: 'green' },
  REWORK_REQUESTED: { label: 'Yêu cầu làm lại', tone: 'amber' },
  TASK_CANCELLED: { label: 'Đóng do hủy nhiệm vụ', tone: 'neutral' },
  REJECTED: { label: 'Đã từ chối', tone: 'red' },
};

export function SubmissionHistoryList({ items, context, onFileError }: {
  items: SubmissionHistoryItem[]; context?: SubmissionDownloadContext; onFileError?: (error: unknown) => void;
}) {
  return <ol className="space-y-4" aria-label="Các lần nộp kết quả">
    {items.map(item => <li key={item.id} className="min-w-0 rounded-xl border border-line bg-surface p-4 sm:p-5">
      <article aria-label={`Lần nộp ${item.number}`} className="space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold">Lần nộp {item.number}</h3>
          <Badge tone={outcomes[item.reviewOutcome].tone}>{outcomes[item.reviewOutcome].label}</Badge>
        </header>
        <dl className="grid gap-3 text-xs sm:grid-cols-2">
          <div><dt className="text-muted">Người nộp</dt><dd className="mt-1 break-words font-medium" title={item.submittedBy.id}>{item.submittedBy.name}</dd></div>
          <div><dt className="text-muted">Thời điểm nộp</dt><dd className="mt-1"><time dateTime={item.submittedAt}>{submissionTimestamp(item.submittedAt)}</time></dd></div>
        </dl>
        <div><h4 className="text-xs text-muted">Ghi chú kết quả</h4><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{item.resultNote}</p></div>
        <dl className="grid gap-3 text-xs sm:grid-cols-2">
          <div><dt className="text-muted">Người phụ trách khi nộp</dt><dd className="mt-1 break-words" title={item.assignee.id}>{item.assignee.name}</dd></div>
          <div><dt className="text-muted">Deadline của lần nộp</dt><dd className="mt-1">{item.deadlineOnSnapshot.split('-').reverse().join('/')}</dd></div>
          <div><dt className="text-muted">Người duyệt / xử lý</dt><dd className="mt-1 break-words" title={item.reviewedBy?.id}>{item.reviewedBy?.name ?? (item.reviewOutcome === 'PENDING' ? 'Chưa duyệt' : 'Chưa có thông tin')}</dd></div>
          <div><dt className="text-muted">Thời điểm duyệt / xử lý</dt><dd className="mt-1">{item.reviewedAt ? <time dateTime={item.reviewedAt}>{submissionTimestamp(item.reviewedAt)}</time> : item.reviewOutcome === 'PENDING' ? 'Chưa duyệt' : 'Chưa có thông tin'}</dd></div>
        </dl>
        {item.rejectionReason && <div className="rounded-lg bg-panel p-3 text-sm">
          <h4 className="font-medium">{item.reviewOutcome === 'TASK_CANCELLED' ? 'Lý do hủy' : item.reviewOutcome === 'REWORK_REQUESTED' ? 'Yêu cầu chỉnh sửa' : 'Lý do từ chối'}</h4>
          <p className="mt-2 whitespace-pre-wrap break-words leading-6">{item.rejectionReason}</p>
        </div>}
        {item.reviewOutcome === 'REJECTED' && <p className="text-xs leading-5 text-muted">Dữ liệu cũ chưa đủ thông tin để phân biệt yêu cầu làm lại với đóng do hủy nhiệm vụ.</p>}
        <section aria-label="Tài liệu kết quả" className="space-y-3 border-t border-line pt-4">
          {item.file && <SubmissionResultFile context={context} submissionId={item.id} number={item.number} file={item.file} onFailure={onFileError} />}
          {item.resultUrl && (submissionResultUrl(item.resultUrl)
            ? <a href={submissionResultUrl(item.resultUrl)} target="_blank" rel="noopener noreferrer" className="inline-block break-all text-sm font-medium text-accent hover:underline">Mở liên kết kết quả ↗</a>
            : <p className="text-xs text-muted">Liên kết kết quả không hợp lệ hoặc không được hỗ trợ.</p>)}
          {!item.file && !item.resultUrl && <p className="text-xs text-muted">Lần nộp cũ chưa có tệp hoặc liên kết kết quả.</p>}
        </section>
      </article>
    </li>)}
  </ol>;
}

import { useEffect, useRef, useState } from 'react';
import { Button } from '../../../shared/ui/Button';
import { downloadSubmissionFile } from '../api/submission-history.api';
import { submissionDownloadName } from '../model/submission-history';

export interface SubmissionDownloadContext { userId: string; project: string; task: string }
export function SubmissionResultFile({ context, submissionId, number, file, onFailure }: {
  context?: SubmissionDownloadContext; submissionId: number; number: number;
  file: { name: string | null; available: boolean }; onFailure?: (error: unknown) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, [context?.userId, context?.project, context?.task, submissionId]);
  const name = file.name || `Kết quả lần ${number}`;
  async function download() {
    if (!context || !file.available || busy.current) return;
    busy.current = true;
    const request = ++generation.current;
    setPending(true);
    setError('');
    try {
      const blob = await downloadSubmissionFile(context.userId, context.project, context.task, submissionId);
      if (request !== generation.current) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = submissionDownloadName(file.name, number);
      document.body.appendChild(link);
      try { link.click(); } finally { link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
    } catch (cause) {
      if (request === generation.current) {
        setError(cause instanceof Error ? cause.message : 'Không thể tải tệp kết quả. Vui lòng thử lại.');
        onFailure?.(cause);
      }
    } finally {
      busy.current = false;
      if (request === generation.current) setPending(false);
    }
  }
  return <div className="space-y-2">
    {file.available ? <Button variant="secondary" size="sm" loading={pending} disabled={!context} className="max-w-full whitespace-normal break-all" onClick={() => void download()}>Tải {name}</Button>
      : <p className="break-words text-xs text-muted">Tệp {name} không còn khả dụng.</p>}
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
  </div>;
}

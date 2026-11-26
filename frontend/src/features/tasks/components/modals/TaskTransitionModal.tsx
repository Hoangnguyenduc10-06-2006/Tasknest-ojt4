import { uploadFile } from '../../../collaboration/api/collaboration.api';
import { ProtectedFile } from '../../../collaboration/components/ProtectedFile';
import { useEffect, useRef, useState } from 'react';
import { Modal } from '../../../../shared/ui/Modal';
import { Button } from '../../../../shared/ui/Button';
import { useWorkspace } from '../../../workspace';
import {
  getLatestTaskSubmission,
  transitionTask,
  type TaskSubmission,
} from '../../api/task.api';
import { needsTransitionNote, statusLabels } from '../../model/task-board';
import type { Task, TaskStatus } from '../../model/task.types';
import { businessToday } from '../../../../shared/utils/business-date';

export function TaskTransitionModal({
  task,
  target,
  onClose,
  onSaved,
}: {
  task: Task;
  target: TaskStatus;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const workspace = useWorkspace();
  const [note, setNote] = useState('');
  const [resultType, setResultType] = useState<'FILE' | 'LINK'>('FILE');
  const [resultUrl, setResultUrl] = useState('');
  const [resultFile, setResultFile] = useState<File>();
  const uploadRef = useRef<{file: File; id: number} | undefined>(undefined);

  const rework = task.status === 'REVIEW' && target === 'IN_PROGRESS';
  const [deadline, setDeadline] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const [submission, setSubmission] = useState<TaskSubmission>();
  const [readError, setReadError] = useState('');
  useEffect(() => {
    if (task.status !== 'REVIEW' || !workspace.userId) return;
    let active = true;
    void getLatestTaskSubmission(workspace.userId, task.projectId, task.id)
      .then((value) => {
        if (active) setSubmission(value);
      })
      .catch((error) => {
        if (active)
          setReadError(
            error instanceof Error ? error.message : 'Không thể tải kết quả.',
          );
      });
    return () => {
      active = false;
    };
  }, [task.id, task.projectId, task.status, workspace.userId]);
  const required = needsTransitionNote(task.status, target);
  const resultAttached =
    resultType === 'FILE'
      ? Boolean(resultFile && resultFile.size > 0)
      : Boolean(resultUrl.trim());
  const submit = async () => {
    if (!workspace.userId || busy.current) return;
    if (target === 'REVIEW') {
      if (resultType === 'FILE' && (!resultFile || resultFile.size === 0 || resultFile.size > 20 * 1024 * 1024)) { setError('Chọn tệp kết quả từ 1 byte đến 20 MiB.'); return; }
      if (resultType === 'LINK') {
        try { const url = new URL(resultUrl.trim()); if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error(); }
        catch { setError('Nhập liên kết HTTP/HTTPS hợp lệ.'); return; }
      }
    }
    if (rework && (!deadline || deadline < businessToday(Date.now()) || (task.startDate && deadline < task.startDate))) {
      setError('Nhập deadline giao lại từ hôm nay, không trước ngày bắt đầu ; giờ ước tính được giữ nguyên.');
      return;
    }
    if (task.status === 'REVIEW' && !submission) {
      setError('Cần tải kết quả đang chờ duyệt trước khi xác nhận.');
      return;
    }
    if (task.version === undefined) {
      setError('Thiếu phiên bản nhiệm vụ. Vui lòng tải lại.');
      return;
    }
    busy.current = true;
    setSaving(true);
    setError('');
    try {
      let resultFileId: number | undefined;
      if (target === 'REVIEW' && resultType === 'FILE' && resultFile) {
        if (uploadRef.current?.file !== resultFile) {
          const uploaded = await uploadFile(task.projectId, resultFile, 'PROJECT_DOCUMENT', crypto.randomUUID());
          uploadRef.current = { file: resultFile, id: uploaded.data.id };
        }
        resultFileId = uploadRef.current.id;
      }
      await transitionTask(workspace.userId, task.projectId, task.id, {
        version: task.version,
        status: target,
        note: note.trim(),
        confirmed,
        ...(target === 'REVIEW' ? (resultType === 'LINK' ? { resultUrl: resultUrl.trim() } : { resultFileId }) : {}),
        ...(rework ? { deadlineOn: deadline } : {}),
      });
      onSaved?.();
      await workspace.refresh();
      onClose();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Không thể cập nhật trạng thái.',
      );
      // Refresh also reconciles version conflicts without pretending a write succeeded.
      await workspace.refresh();
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };
  return (
    <Modal
      open
      onClose={() => {
        if (!busy.current) onClose();
      }}
      title={rework ? 'Giao lại nhiệm vụ' : statusLabels[target]}
      description={`${task.code} · ${task.title}`}
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <p className="text-sm text-muted">
          {statusLabels[task.status]} → {statusLabels[target]}
        </p>
        {task.status === 'REVIEW' && (
          <section
            className="rounded-xl border border-line bg-panel p-3 text-sm"
            aria-label="Kết quả đã nộp"
          >
            {readError ? (
              <p role="alert" className="text-danger">
                {readError}
              </p>
            ) : submission ? (
              <>
                <h3 className="font-semibold">
                  Kết quả lần nộp {submission.number}
                </h3>
                <p className="mt-2 whitespace-pre-wrap break-words text-muted">
                  {submission.resultNote}
                </p>
                {submission.resultUrl && <a className="text-accent break-all" href={submission.resultUrl} target="_blank" rel="noopener noreferrer">Mở liên kết kết quả ↗</a>}
                {submission.fileId && <ProtectedFile project={task.projectId} id={submission.fileId} name={submission.fileName || 'kết quả'}/>}

              </>
            ) : (
              <p role="status">Đang tải kết quả đã nộp...</p>
            )}
          </section>
        )}
        {rework && <section className="space-y-4 rounded-xl border border-line bg-panel p-4">
          <h3 className="text-sm font-semibold">Kế hoạch thực hiện lại</h3>
          <p className="text-xs text-muted">Người phụ trách: {task.assignee.name}. Deadline cũ: {task.deadline || 'Chưa có'} · Ước tính cũ: {task.estimatedHours} giờ.</p>
          <div className="field-row"><label className="field"><span>Deadline giao lại *</span><input type="date" required disabled={saving} value={deadline} onChange={e => setDeadline(e.target.value)} /></label></div>
          <p className="text-xs text-muted">Giờ ước tính ban đầu được giữ nguyên khi giao lại. Giờ đã ghi và các lần nộp cũ được giữ nguyên; timer không tự chạy lại.</p>
        </section>}
        {target === 'REVIEW' && <section className="space-y-4">
          <div className="segmented" aria-label="Hình thức nộp kết quả">
            <button type="button" disabled={saving} className={resultType === 'FILE' ? 'active' : ''} onClick={() => setResultType('FILE')}>Gửi file</button>
            <button type="button" disabled={saving} className={resultType === 'LINK' ? 'active' : ''} onClick={() => setResultType('LINK')}>Gửi link</button>
          </div>
          {resultType === 'FILE' ? <label className="field"><span>Tệp kết quả *</span><input type="file" required disabled={saving} accept=".png,.jpg,.jpeg,.pdf,.docx,.xlsx,.pptx,.txt,.csv,.zip" onChange={e => setResultFile(e.target.files?.[0])}/><small>PNG, JPG, PDF, DOCX, XLSX, PPTX, TXT, CSV hoặc ZIP · tối đa 20 MiB.</small></label> : <label className="field"><span>Liên kết kết quả *</span><input type="url" required maxLength={2048} placeholder="https://..." disabled={saving} value={resultUrl} onChange={e => setResultUrl(e.target.value)}/><small>Đảm bảo người duyệt có quyền truy cập liên kết.</small></label>}
        </section>}
        {required && (
          <label className="grid gap-2 text-sm font-medium">
            {target === 'REVIEW' ? 'Ghi chú kết quả' : 'Lý do'}
            <textarea
              required
              maxLength={4000}
              value={note}
              disabled={saving}
              onChange={(event) => setNote(event.target.value)}
              rows={4}
              className="rounded-xl border border-line bg-field p-3 text-ink"
            />
          </label>
        )}
        {target === 'REVIEW' && (
          <section
            className="rounded-xl border border-line bg-panel p-4"
            aria-label="Checklist trước khi gửi duyệt"
          >
            <h3 className="text-sm font-semibold">Checklist trước khi gửi duyệt</h3>
            <p className="mt-1 text-xs text-muted">
              Kiểm tra tự động từ nội dung bạn đang nhập. Không phát sinh thêm thao tác xác nhận.
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              <li className={resultAttached ? 'text-success' : 'text-muted'}>
                {resultAttached ? '✓' : '○'} Có tệp hoặc liên kết kết quả
              </li>
              <li className={note.trim() ? 'text-success' : 'text-muted'}>
                {note.trim() ? '✓' : '○'} Có ghi chú để người duyệt đối chiếu
              </li>
              <li className="text-muted">
                ○ Nếu dùng liên kết, hãy bảo đảm người duyệt có quyền truy cập.
              </li>
            </ul>
          </section>
        )}
        {(target === 'REVIEW' || target === 'CANCELLED') && (
          <p className="text-sm text-muted">
            Phiên ghi giờ đang chạy của nhiệm vụ sẽ được kết thúc khi lưu.
          </p>
        )}
        {target === 'DONE' && (
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              required
              checked={confirmed}
              disabled={saving}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            Tôi xác nhận kết quả đạt yêu cầu.
          </label>
        )}
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-3">
          <Button
            variant="secondary"
            size="sm"
            disabled={saving}
            onClick={onClose}
          >
            Đóng
          </Button>
          <Button
            type="submit"
            size="sm"
            loading={saving}
            disabled={
              saving ||
              (task.status === 'REVIEW' && !submission) ||
              (required && !note.trim()) ||
              (target === 'DONE' && !confirmed)
            }
          >
            {saving ? 'Đang lưu...' : 'Xác nhận'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

import { useRef, useState, type FormEvent } from 'react';
import { useSession } from '../../auth';
import { useWorkspace } from '../../workspace';
import { useProjects } from '../../projects';
import { AiPriorityTaskList } from './AiPriorityTaskList';
import { Modal } from '../../../shared/ui/Modal';
import { Button } from '../../../shared/ui/Button';
import { ApiError } from '../../../shared/api/client';
import { askAi, type AiAnswer } from '../api/ai.api';
import { AiAnswerMarkdown } from './AiAnswerMarkdown';

type Exchange = { question: string; answer: AiAnswer; taskLabel?: string };
export function AiAssistant() {
  const session = useSession();
  // A user change remounts this component, discarding all private conversation state.
  if (session.status !== 'authenticated') return null;
  return <Assistant key={session.user.id + window.location.pathname} userId={session.user.id} />;
}
function Assistant({ userId }: { userId: string }) {
  const workspace = useWorkspace();
  const projects = useProjects();
  const tasks = workspace.data?.tasks ?? [];
  const [preview, setPreview] = useState<Exchange | 'tasks' | null>(null);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; rateLimited: boolean }>();
  const inFlight = useRef(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current || !message.trim()) return;
    inFlight.current = true; setBusy(true); setError(undefined);
    const question = message.trim();
    const path = window.location.pathname;
    const projectId = path.match(/^\/projects\/(\d+)\/?$/)?.[1];
    const taskId = path.match(/^\/tasks\/(\d+)\/?$/)?.[1];
    try {
      const answer = await askAi(userId, question, taskId ? Number(taskId) : undefined,
        projectId ? Number(projectId) : undefined, exchanges.slice(-3).map(item => item.question));
      setExchanges(current => [...current.slice(-9), { question, answer, taskLabel: tasks.find(t => t.id === taskId)?.title }]);
      setMessage('');
    } catch (cause) {
      setError({
        message: cause instanceof Error && cause.name !== 'TimeoutError'
          ? cause.message : 'AI phản hồi quá lâu. Yêu cầu có thể đã được tính vào hạn mức; không tự động gửi lại.',
        rateLimited: cause instanceof ApiError && cause.status === 429,
      });
    } finally { inFlight.current = false; setBusy(false); }
  }
  return <>
    <Button onClick={() => setOpen(true)} aria-haspopup="dialog" className="shadow-lg">✦ Trợ lý AI</Button>
    <Modal open={open} onClose={() => { setOpen(false); setPreview(null); }} title="Trợ lý TaskNest" description="Gợi ý từ AI · Không tự thay đổi dữ liệu" maxWidth="xl">
      {preview ? (
        <div className="space-y-3">
          <Button kind="ghost" size="sm" onClick={() => setPreview(null)}>← Về cuộc trò chuyện</Button>
          <div className="max-h-[55dvh] overflow-y-auto p-1">
            {preview === 'tasks' ? (
              workspace.error ? (
                <div className="space-y-2">
                  <p role="alert" className="text-sm text-danger">Không thể tải danh sách công việc.</p>
                  <Button size="sm" kind="secondary" onClick={() => void workspace.refresh()}>Thử lại</Button>
                </div>
              ) : workspace.loading ? (
                <p role="status" className="text-sm text-muted">Đang tải công việc…</p>
              ) : (
                <AiPriorityTaskList tasks={tasks} projects={projects} userId={userId} />
              )
            ) : (
              <section aria-label="Xem trước câu trả lời">
                <h3 className="mb-2 text-sm font-semibold">Xem trước câu trả lời</h3>
                <p className="mb-3 whitespace-pre-wrap text-sm text-muted">{preview.question}</p>
                <AiAnswerMarkdown text={preview.answer.text} />
              </section>
            )}
          </div>
        </div>
      ) : <div className="space-y-4">
        <Button kind="secondary" size="sm" onClick={() => setPreview('tasks')}>Công việc cần làm</Button>
        <p className="rounded-xl bg-panel p-3 text-xs leading-relaxed text-muted">Bạn có thể hỏi tiếp về nhiệm vụ vừa trao đổi. Trợ lý nhớ tối đa 3 câu hỏi gần nhất và đọc lại dữ liệu dự án theo quyền truy cập hiện tại của bạn.</p>
        <div role="log" aria-live="polite" aria-label="Trao đổi với AI" className="max-h-[40dvh] space-y-4 overflow-y-auto">
          {exchanges.length === 0 && <div className="py-4 text-center text-sm text-muted">Ví dụ: “Tôi còn việc nào chưa xong?” hoặc “TSK-87 đang chờ việc gì?”</div>}
          {exchanges.map((item, index) => <div key={index} className="space-y-2">
            <div className="ml-8 rounded-xl bg-accent-soft p-3 text-sm whitespace-pre-wrap">{item.question}{item.taskLabel && <p className="mt-2 text-xs text-muted">Nhiệm vụ: {item.taskLabel}</p>}</div>
            <div className="mr-4 rounded-xl border border-line bg-surface p-3">
              <AiAnswerMarkdown text={item.answer.text} />
              <Button kind="ghost" size="sm" className="mt-2" onClick={() => setPreview(item)}>Xem trước</Button>
              {item.answer.sources.length > 0 && <div className="mt-3 flex flex-wrap gap-2 text-xs text-accent">Nguồn: {item.answer.sources.map(source => <a key={source.href} href={source.href} className="rounded-lg bg-panel px-2 py-1 text-accent underline">{source.label}</a>)}</div>}
            </div>
          </div>)}
          {busy && <p role="status" className="text-sm text-muted">AI đang phân tích…</p>}
        </div>
        <form onSubmit={event => void submit(event)} className="space-y-3 border-t border-line pt-4">
          <label className="block text-sm font-semibold">Câu hỏi
            <textarea value={message} onChange={event => setMessage(event.target.value)} maxLength={1000} rows={3} disabled={busy} placeholder="Ví dụ: Tôi còn việc nào chưa xong?" className="mt-2 w-full resize-y rounded-xl border border-line bg-surface p-3 text-sm text-ink" />
          </label>
          {error && <div className="space-y-2">
            <p role="alert" className="text-sm text-danger">{error.message}</p>
            {error.rateLimited && <Button kind="secondary" size="sm" type="button" onClick={() => setPreview('tasks')}>
              Xem công việc cần làm
            </Button>}
          </div>}
          <div className="flex items-center justify-between gap-3">
            <Button kind="ghost" disabled={busy || !exchanges.length} onClick={() => setExchanges([])}>Xóa cuộc trò chuyện</Button>
            <Button type="submit" loading={busy} disabled={!message.trim()}>Gửi câu hỏi</Button>
          </div>
          <p className="text-xs text-muted">Hạn mức sử dụng được cấu hình theo tài khoản và nhóm. Khi provider chính bị giới hạn, hệ thống có thể tự dùng provider dự phòng. Gợi ý AI cần được kiểm tra lại.</p>
        </form>
      </div>}
    </Modal>
  </>;
}

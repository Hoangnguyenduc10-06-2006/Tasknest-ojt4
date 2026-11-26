import { canDevelopProject } from '../../projects/model/project.validation';
import { useRef, useState } from 'react';
import { useProjects } from '../../projects';
import { useWorkspace, workAction } from '../../workspace';
import { Modal } from '../../../shared/ui/Modal';
import { Button } from '../../../shared/ui/Button';
import { TaskForm } from './TaskForm';
import type { CreateTaskInput, Task } from '../model/task.types';

export function TaskManagement({ task, onSaved }: { task: Task; onSaved: () => void }) {
  const workspace = useWorkspace();
  const project = useProjects().find(item => item.id === task.projectId);
  const members = workspace.data?.members.filter(member => member.projectId === task.projectId) ?? [];
  const [modal, setModal] = useState<'edit' | 'block'>();
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const writable = canDevelopProject(project) && !['DONE', 'CANCELLED'].includes(task.status);
  const canManage = project?.role === 'Owner' || project?.role === 'Manager';

  function open(kind: 'edit' | 'block') {
    setError('');
    setReason('');
    setModal(kind);
  }

  function close() {
    if (!busy.current) setModal(undefined);
  }

  async function save(input?: CreateTaskInput) {
    if (!workspace.userId || busy.current) return;
    busy.current = true;
    setPending(true);
    setError('');
    const path = `${task.projectId}/tasks/${task.id}`;
    try {
      if (input) {
        await workAction(workspace.userId, path, {
          version: task.version,
          task: {
            title: input.title.trim(), description: input.description.trim(), assigneeId: input.assigneeId,
            priority: input.priority, startsOn: input.startDate, deadlineOn: input.deadline,
            estimatedSeconds: Math.max(1, Math.round(input.estimatedHours * 3600)),
          },
        });
      } else {
        await workAction(workspace.userId, `${path}/blocked`, {
          version: task.version, blocked: !task.isBlocked, reason,
        });
      }
      await workspace.refresh();
      setModal(undefined);
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể lưu.');
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return <>
    <div className="flex flex-wrap gap-3">
      {writable && canManage && <Button variant="secondary" onClick={() => open('edit')}>Sửa nhiệm vụ / phân công</Button>}
      {writable && (task.assignee.id === workspace.userId || (task.isBlocked && canManage)) && (
        <Button variant="secondary" onClick={() => open('block')}>{task.isBlocked ? 'Bỏ cờ bị chặn' : 'Đánh dấu bị chặn'}</Button>
      )}
    </div>
    {modal && <Modal open title={modal === 'edit' ? 'Cập nhật nhiệm vụ' : task.isBlocked ? 'Gỡ cờ bị chặn' : 'Đánh dấu bị chặn'} onClose={close} maxWidth="lg">
      {error && <p role="alert" className="mb-4 text-danger">{error}</p>}
      {modal === 'edit' ? (
        <TaskForm submitLabel="Lưu thay đổi" projectRange={project}
          initialValues={{ title: task.title, description: task.description, assigneeId: task.assignee.id,
            priority: task.priority, startDate: task.startDate, deadline: task.deadline, estimatedHours: task.estimatedHours }}
          members={members} role={project?.role ?? 'Member'} onCancel={close}
          onSubmit={input => void save(input)} isSubmitting={pending} />
      ) : (
        <form onSubmit={event => { event.preventDefault(); void save(); }} className="space-y-4">
          <p className="text-sm text-muted">Đánh dấu bị chặn sẽ dừng phiên ghi giờ đang chạy. Chỉ có thể ghi giờ trở lại sau khi gỡ cờ. Hệ thống không tự khởi động lại timer.</p>
          <label className="grid gap-2">Lý do
            <textarea required maxLength={2000} value={reason} disabled={pending} onChange={event => setReason(event.target.value)} className="rounded-xl border border-line bg-field p-3" />
          </label>
          <Button type="submit" loading={pending}>Xác nhận</Button>
        </form>
      )}
    </Modal>}
  </>;
}

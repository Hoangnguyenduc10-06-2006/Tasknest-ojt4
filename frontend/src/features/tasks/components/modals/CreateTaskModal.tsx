import { createTask } from '../../api/task.api';
import { useRef, useState } from 'react';
import { Modal } from '../../../../shared/ui/Modal';
import { useProjects } from '../../../projects';
import { useWorkspace } from '../../../workspace';
import type { CreateTaskInput } from '../../model/task.types';
import { TaskForm } from '../TaskForm';
export interface CreateTaskModalProps {
  open: boolean;
  projectId: string;
  role: 'Owner' | 'Manager' | 'Member' | 'Customer';
  initialDeadline?: string;
  onClose: () => void;
  onCreated: () => void;
}
export function CreateTaskModal({
  open,
  projectId,
  role,
  initialDeadline,
  onClose,
  onCreated,
}: CreateTaskModalProps) {
  const workspace = useWorkspace();
  const projects = useProjects();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const busy = useRef(false);
  const project = projects.find((item) => item.id === projectId);
  const members =
    workspace.data?.members.filter(
      (member) => member.projectId === projectId,
    ) ?? [];
  const submit = async (input: CreateTaskInput) => {
    if (!workspace.userId || busy.current) return;
    if (project?.status === 'ARCHIVED') {
      setError('Dự án đã lưu trữ chỉ được xem lại. Không thể tạo nhiệm vụ mới.');
      return;
    }
    busy.current = true;
    setSaving(true);
    setError(undefined);
    try {
      await createTask(workspace.userId, projectId, input);
      await workspace.refresh();
      onCreated();
      onClose();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Không thể tạo nhiệm vụ.',
      );
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };
  return (
    <Modal
      open={open}
      onClose={() => {
        if (!busy.current) onClose();
      }}
      title="Tạo nhiệm vụ"
      description="Nhiệm vụ mới bắt đầu ở trạng thái Chưa bắt đầu."
      maxWidth="lg"
    >
      {error && (
        <p role="alert" className="mb-3 text-sm text-danger">
          {error}
        </p>
      )}
      {members.length ? (
        <TaskForm
          key={projectId}
          projectRange={project}
          initialValues={{ deadline: initialDeadline }}
          members={members}
          role={role}
          onSubmit={(input) => {
            void submit(input);
          }}
          onCancel={onClose}
          isSubmitting={saving}
        />
      ) : (
        <p>Đang tải thành viên dự án...</p>
      )}
    </Modal>
  );
}

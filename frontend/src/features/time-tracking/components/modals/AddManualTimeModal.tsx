import { canDevelopProject, developmentReadOnlyReason } from '../../../projects/model/project.validation';
import { useState } from 'react';
import { Modal } from '../../../../shared/ui/Modal';
import { useProjects } from '../../../projects';
import { useWorkspace } from '../../../workspace';
import type { Task } from '../../../tasks';
import { addManualTime } from '../../api/timesheet.api';
import { useTimeEntryForm } from '../../hooks/useTimeEntryForm';
import { TimeEntryForm } from '../TimeEntryForm';
export function AddManualTimeModal({
  tasks,
  projectNames,
  onClose,
}: {
  tasks: Task[];
  projectNames: Map<string, string>;
  onClose: () => void;
}) {
  const { userId } = useWorkspace();
  const projects = useProjects();
  const [taskId, setTaskId] = useState(tasks[0]?.id ?? '');
  const task = tasks.find((task) => task.id === taskId);
  const form = useTimeEntryForm(
    undefined,
    async (input) => {
      if (!task || !userId)
        throw new Error('Nhiệm vụ không còn được phép bổ sung giờ.');
      const project = projects.find((item) => item.id === task.projectId);
      if (!canDevelopProject(project)) {
        throw new Error(
          developmentReadOnlyReason(project) ?? 'Dự án không còn cho phép bổ sung giờ làm.',
        );
      }
      return addManualTime(userId, task.projectId, task.id, input);
    },
    onClose,
  );
  return (
    <Modal
      open
      onClose={() => {
        if (!form.busy.current) onClose();
      }}
      title="Bổ sung giờ đã quên"
      description="Chỉ ghi giờ của bạn trên nhiệm vụ chưa hoàn thành thuộc dự án đang hoạt động."
      maxWidth="lg"
    >
      <TimeEntryForm form={form} onClose={onClose} submitLabel="Bổ sung phiên">
        <label className="grid gap-2 text-sm font-medium">
          Nhiệm vụ
          <select
            required
            disabled={form.saving}
            value={taskId}
            onChange={(event) => setTaskId(event.target.value)}
            className="min-w-0 rounded-xl border border-line bg-field p-3 text-ink"
          >
            {!tasks.length && (
              <option value="">Không có nhiệm vụ phù hợp</option>
            )}
            {tasks.map((task) => (
              <option key={task.id} value={task.id}>
                {projectNames.get(task.projectId)} · {task.code} · {task.title}
              </option>
            ))}
          </select>
        </label>
      </TimeEntryForm>
    </Modal>
  );
}

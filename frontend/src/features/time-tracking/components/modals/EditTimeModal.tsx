import { canDevelopProject, developmentReadOnlyReason } from '../../../projects/model/project.validation';
import { Modal } from '../../../../shared/ui/Modal';
import { useProjects } from '../../../projects';
import { useWorkspace, type TimeEntry } from '../../../workspace';
import { editTime } from '../../api/timesheet.api';
import { useTimeEntryForm } from '../../hooks/useTimeEntryForm';
import { TimeEntryForm } from '../TimeEntryForm';
export function EditTimeModal({
  entry,
  onClose,
}: {
  entry: TimeEntry;
  onClose: () => void;
}) {
  const { userId } = useWorkspace();
  const projects = useProjects();
  const form = useTimeEntryForm(
    entry,
    async (input) => {
      if (!userId) throw new Error('Vui lòng đăng nhập lại.');
      const project = projects.find(
        (item) => item.id === String(entry.projectId),
      );
      if (!canDevelopProject(project)) {
        throw new Error(
          developmentReadOnlyReason(project) ?? 'Dự án không còn cho phép chỉnh sửa phiên ghi giờ.',
        );
      }
      return editTime(userId, entry.projectId, entry.id, entry.version, input);
    },
    onClose,
  );
  return (
    <Modal
      open
      onClose={() => {
        if (!form.busy.current) onClose();
      }}
      title="Chỉnh sửa phiên ghi giờ"
      description={`${entry.projectName} · ${entry.taskTitle}`}
      maxWidth="lg"
    >
      <TimeEntryForm
        form={form}
        onClose={onClose}
        submitLabel="Cập nhật phiên"
      />
    </Modal>
  );
}

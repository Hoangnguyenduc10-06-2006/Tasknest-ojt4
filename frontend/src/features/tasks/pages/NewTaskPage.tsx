import { canDevelopProject } from '../../projects/model/project.validation';
import { useState } from 'react';
import { useProjects } from '../../projects';
import { CreateTaskModal } from '../components/modals/CreateTaskModal';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { Panel } from '../../../shared/ui/Panel';
import { Button } from '../../../shared/ui/Button';
export function NewTaskPage() {
  const projects = useProjects().filter(
    (project) => canDevelopProject(project),
  );
  const [projectId, setProjectId] = useState('');
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const project = projects.find((project) => project.id === projectId);
  return (
    <main className="space-y-5">
      <PageHeader eyebrow="NHIỆM VỤ" title="Tạo nhiệm vụ" description="Chọn dự án và nhập thông tin công việc cần phân công." />
      <Panel className="space-y-4">
        {projects.length ? (
          <>
            <label
              htmlFor="new-task-project"
              className="block text-sm font-semibold"
            >
              Chọn dự án
            </label>
            <select
              id="new-task-project"
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
              className="w-full rounded-xl border border-line bg-field p-3 text-sm"
            >
              <option value="">Chọn dự án đang hoạt động</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <Button
              disabled={!project}
              onClick={() => setOpen(true)}
            >
              Nhập thông tin nhiệm vụ
            </Button>
          </>
        ) : (
          <p className="text-muted">
            Bạn cần tạo hoặc tham gia dự án đang hoạt động trước.
          </p>
        )}
        {message && (
          <p role="status" className="text-success">
            {message}
          </p>
        )}
      </Panel>
      {project && (
        <CreateTaskModal
          projectId={project.id}
          role={project.role}
          open={open}
          onClose={() => setOpen(false)}
          onCreated={() =>
            setMessage(
              'Đã tạo nhiệm vụ. Xem trong Công việc của tôi hoặc dự án.',
            )
          }
        />
      )}
    </main>
  );
}

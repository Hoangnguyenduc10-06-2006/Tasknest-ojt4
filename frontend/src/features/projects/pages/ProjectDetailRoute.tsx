import { useEffect, useState } from 'react';
import { useSession } from '../../auth';
import type { Task } from '../../tasks';
import { ApiError } from '../../../shared/api/client';
import { RouteNoticePage } from '../../../app/pages/RouteNoticePage';
import { getProject } from '../api/project.api';
import { mapProject } from '../model/project.mapping';
import type { MyProjectItem } from '../model/project.types';
import { useProjects } from '../hooks/useProjects';
import { ProjectDetailPage } from './ProjectDetailPage';

export function ProjectDetailRoute({
  projectId,
  tasks,
}: {
  projectId: string;
  tasks: Task[];
}) {
  const session = useSession();
  const userId =
    session.status === 'authenticated' ? session.user.id : undefined;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    key: string;
    project?: MyProjectItem;
    error?: string;
    notFound?: boolean;
  }>({ key: '' });
  const key = `${userId}/${projectId}`;
  useEffect(()=>{const sync=()=>setAttempt(value=>value+1);window.addEventListener('tasknest:sync',sync);return()=>window.removeEventListener('tasknest:sync',sync);},[]);
  const cached = useProjects().find((project) => project.id === projectId);
  useEffect(() => {
    if (!userId) return;
    let active = true;
    if (!/^[1-9][0-9]*$/.test(projectId)) return;
    void getProject(userId, projectId)
      .then((project) => {
        if (active) setState({ key, project: mapProject(project) });
      })
      .catch((error) => {
        if (active)
          setState({
            key,
            error:
              error instanceof Error ? error.message : 'Không thể tải dự án.',
            notFound: error instanceof ApiError && error.status === 404,
          });
      });
    return () => {
      active = false;
    };
  }, [userId, projectId, key, attempt]);
  if (!/^[1-9][0-9]*$/.test(projectId) || (state.key === key && state.notFound))
    return <RouteNoticePage />;
  if (state.key !== key || !state.project)
    return (
      <section
        role={state.key === key && state.error ? 'alert' : 'status'}
        className="rounded-2xl border border-line bg-surface p-6 text-sm text-muted"
      >
        {state.key === key && state.error ? (
          <>
            {state.error}
            <button
              className="ml-3 font-semibold text-accent"
              onClick={() => setAttempt((value) => value + 1)}
            >
              Thử lại
            </button>
          </>
        ) : (
          'Đang tải thông tin dự án…'
        )}
      </section>
    );
  const project =
    cached && (cached.version ?? 0) > (state.project.version ?? 0)
      ? cached
      : state.project;
  return (
    <ProjectDetailPage
      key={`${userId}/${projectId}`}
      project={project}
      tasks={tasks}
    />
  );
}

import { MyProjectsView } from '../components/MyProjectsView';

export function MyProjectsPage({
  progressByProject,
}: {
  progressByProject: Record<string, number>;
}) {
  return <MyProjectsView progressByProject={progressByProject} />;
}

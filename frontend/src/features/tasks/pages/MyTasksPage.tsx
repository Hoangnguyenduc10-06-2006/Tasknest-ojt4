import { MyTasksView } from '../components/MyTasksView';
import type { MyTaskItem } from '../model/task.types';

export function MyTasksPage({
  tasks,
  now,
}: {
  tasks: MyTaskItem[];
  now: number;
}) {
  return <MyTasksView tasks={tasks} now={now} />;
}

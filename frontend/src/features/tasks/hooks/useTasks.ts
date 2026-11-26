import { useWorkspace } from '../../workspace';
import type { Task } from '../model/task.types';
const empty: Task[] = [];
export function useTasks() {
  return useWorkspace().data?.tasks ?? empty;
}

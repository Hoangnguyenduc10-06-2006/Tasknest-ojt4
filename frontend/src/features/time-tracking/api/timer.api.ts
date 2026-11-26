import { workAction } from '../../workspace';
export function startTimer(userId: string, projectId: string, taskId: string) {
  return workAction(
    userId,
    `${projectId}/tasks/${taskId}/timer`,
    undefined,
    'POST',
  );
}
export function stopTimer(userId: string, projectId: number, entryId: number) {
  return workAction(userId, `${projectId}/time-entries/${entryId}/stop`);
}

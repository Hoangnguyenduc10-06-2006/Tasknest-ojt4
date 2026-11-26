import { authenticatedAccessToken } from '../../auth';
import { workAction } from '../../workspace';
import { requestJson } from '../../../shared/api/client';
import type { ManualTimeInput, TimeRevision } from '../model/timesheet.types';
export function addManualTime(
  userId: string,
  projectId: string,
  taskId: string,
  input: ManualTimeInput,
) {
  return workAction(
    userId,
    `${projectId}/tasks/${taskId}/time-entries`,
    input,
    'POST',
  );
}
export function editTime(
  userId: string,
  projectId: number,
  entryId: number,
  version: number,
  input: ManualTimeInput,
) {
  return workAction(userId, `${projectId}/time-entries/${entryId}`, {
    ...input,
    version,
  });
}
export async function readTimeRevisions(userId: string) {
  const accessToken = await authenticatedAccessToken(userId);
  return (
    await requestJson<{ data: TimeRevision[] }>(
      '/api/work/projects/workspace/time-revisions',
      { accessToken },
    )
  ).data;
}

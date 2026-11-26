import { authenticatedAccessToken } from '../../auth';
import { requestJson } from '../../../shared/api/client';
import { workAction } from '../../workspace';
import type { CreateTaskInput } from '../model/task.types';
export async function createTask(
  userId: string,
  projectId: string,
  input: CreateTaskInput,
) {
  return workAction(
    userId,
    `${projectId}/tasks`,
    {
      title: input.title.trim(),
      description: input.description.trim(),
      assigneeId: input.assigneeId,
      priority: input.priority,
      startsOn: input.startDate,
      deadlineOn: input.deadline,
      estimatedSeconds: Math.max(1, Math.round(input.estimatedHours * 3600)),
    },
    'POST',
  );
}
export async function startTask(
  userId: string,
  projectId: string,
  taskId: string,
  version?: number,
) {
  return workAction(userId, `${projectId}/tasks/${taskId}/start`, { version });
}
export async function transitionTask(
  userId: string,
  projectId: string,
  taskId: string,
  input: { version: number; status: string; note: string; confirmed: boolean; deadlineOn?: string; estimatedSeconds?: number; resultUrl?: string; resultFileId?: number },
) {
  return workAction(userId, `${projectId}/tasks/${taskId}/status`, input);
}

export interface TaskSubmission {
  resultUrl?: string;
  fileId?: number;
  fileName?: string;
  number: number;
  resultNote: string;
  decision: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  submittedAt: string;
}
export async function getLatestTaskSubmission(
  userId: string,
  projectId: string,
  taskId: string,
) {
  const accessToken = await authenticatedAccessToken(userId);
  const response = await requestJson<{ data: TaskSubmission | null }>(
    `/api/work/projects/${projectId}/tasks/${taskId}/submission`,
    { accessToken },
  );
  const submission = response.data;
  if (
    !submission ||
    typeof submission.resultNote !== 'string' ||
    submission.decision !== 'PENDING'
  )
    throw new Error(
      'Nhiệm vụ không còn kết quả đang chờ duyệt. Đóng cửa sổ và tải lại bảng.',
    );
  return submission;
}

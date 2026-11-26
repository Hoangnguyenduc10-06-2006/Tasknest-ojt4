import { authenticatedAccessToken } from '../../auth';
import { requestJson } from '../../../shared/api/client';

export type AiAnswer = { text: string; model: string; sources: { label: string; href: string; deadline: string; estimatedHours: number; visibleSpentHours: number | null }[] };
export async function askAi(userId: string, message: string, taskId?: number, projectId?: number, previousQuestions: string[] = []): Promise<AiAnswer> {
  const accessToken = await authenticatedAccessToken(userId);
  const response = await requestJson<{ data?: Partial<AiAnswer> } | null>('/api/ai/chat', {
    method: 'POST', accessToken,
    body: { message, taskId, projectId, includeWorkspace: true,
      ...(previousQuestions.length ? { previousQuestions: previousQuestions.slice(-3).map(question => question.slice(0, 300)) } : {}) },
    timeoutMs: 55000,
  });
  const answer = response?.data;
  if (typeof answer?.text !== 'string' || !answer.text.trim()) {
    throw new Error('Trợ lý chưa trả về nội dung hợp lệ. Vui lòng thử lại.');
  }
  const sources = Array.isArray(answer.sources)
    ? answer.sources.filter(source => source && typeof source.label === 'string'
        && typeof source.href === 'string' && /^\/tasks\/[1-9]\d*$/.test(source.href))
    : [];
  return { text: answer.text, model: typeof answer.model === 'string' ? answer.model : '', sources };
}

export type DashboardBrief = AiAnswer & {
  insights?: { overview: string; attention: string; awaiting: string; review: string; taskHints: Record<string, string> };
  counts: { myOpenTasks: number; myOverdueTasks: number; myAwaitingReview: number; tasksNeedingMyReview: number };
  generatedAt: string;
};
const dashboardRequests = new Map<string, Promise<DashboardBrief>>();
export function getDashboardBrief(userId: string, scopeKey = ''): Promise<DashboardBrief> {
  const key = JSON.stringify([userId, scopeKey]);
  const pending = dashboardRequests.get(key);
  if (pending) return pending;
  const request = loadDashboardBrief(userId).finally(() => {
    if (dashboardRequests.get(key) === request) dashboardRequests.delete(key);
  });
  dashboardRequests.set(key, request);
  return request;
}
async function loadDashboardBrief(userId: string): Promise<DashboardBrief> {
  const accessToken = await authenticatedAccessToken(userId);
  const response = await requestJson<{ data: DashboardBrief }>('/api/ai/dashboard', {
    method: 'POST', accessToken, timeoutMs: 55000,
  });
  return response.data;
}

export type TaskBrief = {
  insights: { overview: string; deadline: string; time: string; blocked: string; nextStep: string };
  source: AiAnswer['sources'][number];
  generatedAt: string;
};
const taskRequests = new Map<string, Promise<TaskBrief>>();
export function getTaskBrief(userId: string, taskId: number, scopeKey = ''): Promise<TaskBrief> {
  const key = JSON.stringify([userId, taskId, scopeKey]);
  const pending = taskRequests.get(key);
  if (pending) return pending;
  const request = (async () => {
    const accessToken = await authenticatedAccessToken(userId);
    const response = await requestJson<{ data: TaskBrief }>(`/api/ai/tasks/${taskId}`, {
      method: 'POST', accessToken, timeoutMs: 55000,
    });
    return response.data;
  })().finally(() => { if (taskRequests.get(key) === request) taskRequests.delete(key); });
  taskRequests.set(key, request);
  return request;
}

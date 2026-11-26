import { authenticatedAccessToken } from '../../auth';
import { requestBlob, requestJson } from '../../../shared/api/client';
import { parseSubmissionHistory } from '../model/submission-history';

export async function listSubmissionHistory(userId: string, project: string, task: string, page = 0, size = 20) {
  if (!Number.isSafeInteger(page) || page < 0 || ![10, 20, 50].includes(size) || page * size > 2147483647) {
    throw new Error('Chỉ số trang hoặc kích thước trang không hợp lệ.');
  }
  const token = await authenticatedAccessToken(userId);
  const query = new URLSearchParams({ page: String(page), size: String(size) });
  const result = await requestJson<{ data: unknown } | null>(
    `/api/work/projects/${encodeURIComponent(project)}/tasks/${encodeURIComponent(task)}/submissions?${query}`, { accessToken: token },
  );
  const data = parseSubmissionHistory(result?.data);
  if (data.page !== page || data.size !== size) throw new Error('Máy chủ trả về trang lịch sử không đúng yêu cầu.');
  return data;
}

export async function downloadSubmissionFile(userId: string, project: string, task: string, submissionId: number) {
  if (!Number.isSafeInteger(submissionId) || submissionId < 1) throw new Error('Lần nộp không hợp lệ.');
  const token = await authenticatedAccessToken(userId);
  const blob = await requestBlob(`/api/work/projects/${encodeURIComponent(project)}/tasks/${encodeURIComponent(task)}/submissions/${submissionId}/file`, token);
  if (blob.type.toLowerCase().startsWith('text/html') || blob.type.toLowerCase().includes('application/json')) {
    throw new Error('Máy chủ trả về tệp kết quả không hợp lệ.');
  }
  return blob;
}

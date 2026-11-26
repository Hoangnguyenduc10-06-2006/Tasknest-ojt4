export type SubmissionOutcome = 'PENDING' | 'ACCEPTED' | 'REWORK_REQUESTED' | 'TASK_CANCELLED' | 'REJECTED';
export interface SubmissionParticipant { id: string; name: string }
export interface SubmissionHistoryItem {
  id: number;
  number: number;
  submittedBy: SubmissionParticipant;
  assignee: SubmissionParticipant;
  submittedAt: string;
  resultNote: string;
  resultUrl: string | null;
  file: { id: number; name: string | null; available: boolean } | null;
  decision: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  reviewOutcome: SubmissionOutcome;
  reviewedBy: SubmissionParticipant | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  deadlineOnSnapshot: string;
}
export interface SubmissionHistoryPage {
  content: SubmissionHistoryItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

const invalid = () => new Error('Dữ liệu lịch sử kết quả không hợp lệ. Vui lòng thử tải lại.');
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid();
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== 'string') throw invalid();
  return value;
}
function integer(value: unknown, minimum = 0): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) throw invalid();
  return value;
}
function nullableText(value: unknown): string | null { return value === null ? null : text(value); }
function timestamp(value: unknown): string {
  const result = text(value);
  if (!Number.isFinite(Date.parse(result))) throw invalid();
  return result;
}
function person(value: unknown): SubmissionParticipant {
  const data = object(value);
  const id = text(data.id);
  if (!id) throw invalid();
  return { id, name: text(data.name) };
}
function item(value: unknown): SubmissionHistoryItem {
  const data = object(value);
  const outcomes: Record<string, readonly string[]> = {
    PENDING: ['PENDING'], ACCEPTED: ['ACCEPTED'], REJECTED: ['REWORK_REQUESTED', 'TASK_CANCELLED', 'REJECTED'],
  };
  const decision = text(data.decision);
  const outcome = text(data.reviewOutcome);
  if (!Object.hasOwn(outcomes, decision) || !outcomes[decision].includes(outcome)) throw invalid();
  const file = data.file === null ? null : object(data.file);
  if (file && typeof file.available !== 'boolean') throw invalid();
  const deadline = text(data.deadlineOnSnapshot);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline)) throw invalid();
  return {
    id: integer(data.id, 1), number: integer(data.number, 1), submittedBy: person(data.submittedBy),
    assignee: person(data.assignee), submittedAt: timestamp(data.submittedAt), resultNote: text(data.resultNote),
    resultUrl: nullableText(data.resultUrl),
    file: file ? { id: integer(file.id, 1), name: nullableText(file.name), available: file.available as boolean } : null,
    decision: decision as SubmissionHistoryItem['decision'], reviewOutcome: outcome as SubmissionOutcome,
    reviewedBy: data.reviewedBy === null ? null : person(data.reviewedBy),
    reviewedAt: data.reviewedAt === null ? null : timestamp(data.reviewedAt),
    rejectionReason: nullableText(data.rejectionReason), deadlineOnSnapshot: deadline,
  };
}

export function parseSubmissionHistory(value: unknown): SubmissionHistoryPage {
  const data = object(value);
  const page = integer(data.page);
  const size = integer(data.size, 1);
  const totalElements = integer(data.totalElements);
  const totalPages = integer(data.totalPages);
  if (![10, 20, 50].includes(size) || totalPages !== Math.ceil(totalElements / size) || !Array.isArray(data.content)) throw invalid();
  const content = data.content.map(item);
  if (content.length > size || content.length > totalElements || (page >= totalPages && content.length > 0) || new Set(content.map(row => row.id)).size !== content.length) throw invalid();
  if (content.some((row, index) => index > 0 && row.number >= content[index - 1].number)) throw invalid();
  return { content, page, size, totalElements, totalPages };
}

export function submissionTimestamp(value: string): string {
  return new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

export function submissionResultUrl(value: string | null): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value.trim());
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password && value.length <= 2048 ? url.href : undefined;
  } catch { return undefined; }
}

export function submissionDownloadName(value: string | null, number: number): string {
  const name = value ? Array.from(value, char =>
    char === '/' || char === String.fromCharCode(92) || char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127 ? '_' : char,
  ).join('').trim().slice(0, 255) : '';
  return name || `ket-qua-lan-${number}`;
}

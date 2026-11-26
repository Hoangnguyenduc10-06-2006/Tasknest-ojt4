import type { SubmissionHistoryItem, SubmissionHistoryPage } from '../model/submission-history';

export function submissionFixture(overrides: Partial<SubmissionHistoryItem> = {}): SubmissionHistoryItem {
  return {
    id: 11, number: 1, submittedBy: { id: 'former-user', name: 'Người nộp cũ' },
    assignee: { id: 'member', name: 'Thành viên' }, submittedAt: '2026-11-01T18:00:00Z', resultNote: 'Kết quả lần một',
    resultUrl: null, file: null, decision: 'PENDING', reviewOutcome: 'PENDING',
    reviewedBy: null, reviewedAt: null, rejectionReason: null, deadlineOnSnapshot: '2026-11-03', ...overrides,
  };
}
export function historyFixture(overrides: Partial<SubmissionHistoryPage> = {}): SubmissionHistoryPage {
  return { content: [submissionFixture()], page: 0, size: 20, totalElements: 1, totalPages: 1, ...overrides };
}

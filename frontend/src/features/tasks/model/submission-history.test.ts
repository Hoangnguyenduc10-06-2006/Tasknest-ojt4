import { describe, expect, it } from 'vitest';
import { historyFixture, submissionFixture } from '../mocks/submission-history.fixture';
import { parseSubmissionHistory, submissionTimestamp, submissionResultUrl, submissionDownloadName } from './submission-history';

describe('submission history contract', () => {
  it('preserves legacy null deliverables and pending review fields', () => {
    expect(parseSubmissionHistory(historyFixture())).toEqual(historyFixture());
    expect(parseSubmissionHistory(historyFixture()).content[0].reviewedBy).toBeNull();
  });
  it('accepts cancellation and uncertain legacy rejection without relabeling either as rework', () => {
    for (const reviewOutcome of ['TASK_CANCELLED', 'REJECTED', 'REWORK_REQUESTED'] as const) {
      const item = submissionFixture({ decision: 'REJECTED', reviewOutcome });
      expect(parseSubmissionHistory(historyFixture({ content: [item] })).content[0].reviewOutcome).toBe(reviewOutcome);
    }
  });
  it('rejects malformed pages, duplicate results, inconsistent decisions and unsupported outcomes', () => {
    const invalid: unknown[] = [null, {}, historyFixture({ totalPages: 2 }), historyFixture({ size: 1 }),
      historyFixture({ content: [submissionFixture(), submissionFixture({ number: 2 })], totalElements: 2 }),
      historyFixture({ content: [submissionFixture({ id: 12, number: 1 }), submissionFixture({ id: 13, number: 2 })], totalElements: 2 }),
      historyFixture({ content: [submissionFixture({ reviewOutcome: 'ACCEPTED' })] }),
      historyFixture({ content: [{ ...submissionFixture(), reviewedAt: 'not a timestamp' }] }),
    ];
    for (const data of invalid) expect(() => parseSubmissionHistory(data)).toThrow('không hợp lệ');
  });
  it('formats UTC timestamps in Vietnam even across midnight', () => {
    const label = submissionTimestamp('2026-11-01T18:00:00Z');
    expect(label).toContain('02/11/2026');
    expect(label).toContain('01:00');
  });
  it('allows only absolute HTTP/HTTPS result links without embedded credentials', () => {
    expect(submissionResultUrl('https://example.com/result')).toBe('https://example.com/result');
    for (const value of [null, 'javascript:alert(1)', 'data:text/html,test', '//example.com', 'https://user:secret@example.com/file']) {
      expect(submissionResultUrl(value)).toBeUndefined();
    }
  });
  it('keeps a safe download name without directory separators or control characters', () => {
    expect(submissionDownloadName('../file\n.pdf', 2)).toBe('.._file_.pdf');
    expect(submissionDownloadName(null, 2)).toBe('ket-qua-lan-2');
  });

});

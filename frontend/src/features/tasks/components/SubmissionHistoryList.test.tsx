import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { submissionFixture } from '../mocks/submission-history.fixture';
import { SubmissionHistoryList } from './SubmissionHistoryList';

describe('submission history presentation', () => {
  it('renders the submission number, historical submitter, note and explicit review outcome', () => {
    const html = renderToStaticMarkup(<SubmissionHistoryList items={[submissionFixture({ decision: 'REJECTED', reviewOutcome: 'TASK_CANCELLED' })]} />);
    expect(html).toContain('Lần nộp 1');
    expect(html).toContain('Người nộp cũ');
    expect(html).toContain('Đóng do hủy nhiệm vụ');
    expect(html).not.toContain('Yêu cầu làm lại');
  });
  it('escapes user-authored result notes', () => {
    const html = renderToStaticMarkup(<SubmissionHistoryList items={[submissionFixture({ resultNote: '<script>alert(1)</script>' })]} />);
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });
  it('shows the reviewer, decision reason and a protected file control', () => {
    const item = submissionFixture({ decision: 'REJECTED', reviewOutcome: 'REWORK_REQUESTED',
      reviewedBy: { id: 'owner', name: 'Người duyệt' }, reviewedAt: '2026-11-02T01:00:00Z',
      rejectionReason: 'Bổ sung kiểm thử', file: { id: 44, name: 'ket-qua.pdf', available: true } });
    const html = renderToStaticMarkup(<SubmissionHistoryList items={[item]} context={{ userId: 'member', project: '7', task: '9' }} />);
    expect(html).toContain('Người duyệt');
    expect(html).toContain('Bổ sung kiểm thử');
    expect(html).toContain('Tải ket-qua.pdf');
    expect(html).not.toContain('href="/api/');
  });
  it('renders unavailable files and missing legacy deliverables without a broken download link', () => {
    const unavailable = renderToStaticMarkup(<SubmissionHistoryList items={[submissionFixture({ file: { id: 44, name: 'old.pdf', available: false } })]} />);
    expect(unavailable).toContain('không còn khả dụng');
    expect(unavailable).not.toContain('<button');
    expect(renderToStaticMarkup(<SubmissionHistoryList items={[submissionFixture()]} />)).toContain('Lần nộp cũ chưa có tệp hoặc liên kết');
  });
  it('opens safe external links separately and never renders executable legacy URLs', () => {
    const safe = renderToStaticMarkup(<SubmissionHistoryList items={[submissionFixture({ resultUrl: 'https://example.com/result' })]} />);
    expect(safe).toContain('href="https://example.com/result"');
    expect(safe).toContain('rel="noopener noreferrer"');
    const unsafe = renderToStaticMarkup(<SubmissionHistoryList items={[submissionFixture({ resultUrl: 'javascript:alert(1)' })]} />);
    expect(unsafe).not.toContain('href=');
    expect(unsafe).toContain('không hợp lệ');
  });

});

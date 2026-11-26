import { describe, expect, it } from 'vitest';
import { taskHistoryChanges } from './task-history';

describe('task history changes', () => {
  it('shows changed values once across legacy and current snapshot field names', () => {
    const before = JSON.stringify({
      name: 'Kiểm thử', deadline_on: '2026-11-18', estimated_seconds: '3600', assignee_user_id: 'user-a',
    });
    const after = JSON.stringify({
      title: 'Kiểm thử', deadlineOn: '2026-11-20', estimatedSeconds: 3600, assigneeId: 'user-b',
    });
    expect(taskHistoryChanges(before, after, [{ id: 'user-a', name: 'Mai' }, { id: 'user-b', name: 'Minh' }]))
      .toEqual([
        { label: 'Deadline', before: '2026-11-18', after: '2026-11-20', changed: true },
        { label: 'Người phụ trách', before: 'Mai', after: 'Minh', changed: true },
      ]);
  });

  it('shows a removed blocker and ignores unsupported fields', () => {
    expect(taskHistoryChanges('{"is_blocked":1}', '{"blocked":false,"reason":"Đã có bản dựng","sample":true}', []))
      .toEqual([
        { label: 'Bị chặn', before: 'Có', after: 'Không', changed: true },
        { label: 'Lý do', before: '—', after: 'Đã có bản dựng', changed: false },
      ]);
  });
});

import { describe, expect, it } from 'vitest';
import {
  suggestChecklistSteps,
  summarizeChecklist,
} from './task-checklist';
import {
  getTagMeta,
  isTaskPinned,
  toggleTaskPin,
} from './task-organization';
import {
  deriveTaskDraftFromMessage,
  extractTaskReferences,
  togglePinChatMessage,
} from '../../messaging/chat-enhancements';
import { computeSkillMatch } from '../../community/skill-matching';

describe('New product enhancements suite', () => {
  it('summarizes shared checklist snapshots and derives suggested steps', () => {
    expect(summarizeChecklist([{id:'one',title:'Kiểm thử API',completed:true,createdAt:''},{id:'two',title:'Bàn giao',completed:false,createdAt:''}])).toEqual({total:2,completed:1,percent:50});
    expect(suggestChecklistSteps('Phát triển API')).toHaveLength(4);
  });
  it('keeps personal pins scoped to the current account', () => {
    toggleTaskPin('task-personal','account-a');
    expect(isTaskPinned('task-personal','account-a')).toBe(true);
    expect(isTaskPinned('task-personal','account-b')).toBe(false);
    expect(getTagMeta('BACKEND').label).toBe('Backend / API');
  });
  it('extracts #TSK-... references, derives task drafts and pins chat messages', () => {
    const refs = extractTaskReferences('Anh em kiểm tra giúp #TSK-12 và TSK-45 nhé, #TSK-12 cần xong hôm nay.');
    expect(refs).toEqual([
      { code: 'TSK-12', taskNumber: '12' },
      { code: 'TSK-45', taskNumber: '45' },
    ]);

    const msg = {
      id: 88,
      sender_user_id: 'u1',
      sender_name: 'Nguyễn An',
      body: 'Tối ưu tốc độ tải trang thông báo. Cần gộp API read-all thành 1 lần gọi.',
      created_at: '2026-11-22T01:00:00Z',
    };
    const draft = deriveTaskDraftFromMessage(msg);
    expect(draft.title).toBe('Tối ưu tốc độ tải trang thông báo');
    expect(draft.description).toContain('Nguyễn An');

    const pinned = togglePinChatMessage(501, msg);
    expect(pinned).toHaveLength(1);
    expect(pinned[0].id).toBe(88);
    expect(togglePinChatMessage(501, msg)).toHaveLength(0);
  });

  it('calculates skill & weekly availability matching scores with alias normalization', () => {
    const fullMatch = computeSkillMatch(
      'ReactJS, TypeScript, Spring, MySQL',
      'React, TS, Spring Boot, MySQL, Docker',
      20,
      25
    );
    expect(fullMatch.score).toBe(100);
    expect(fullMatch.matchedSkills).toHaveLength(4);
    expect(fullMatch.missingSkills).toHaveLength(0);
    expect(fullMatch.hoursCompatible).toBe(true);

    const partialMatch = computeSkillMatch(
      'React, Go, Kubernetes, Rust',
      'React, TypeScript',
      30,
      15
    );
    expect(partialMatch.matchedSkills).toEqual(['React']);
    expect(partialMatch.missingSkills).toEqual(['Go', 'Kubernetes', 'Rust']);
    expect(partialMatch.hoursCompatible).toBe(false);
    expect(partialMatch.score).toBeGreaterThan(20);
    expect(partialMatch.score).toBeLessThan(50);
  });
});

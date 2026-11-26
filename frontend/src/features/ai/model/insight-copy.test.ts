import { expect, it } from 'vitest';
import { insightCopy } from './insight-copy';
it('cleans formatting and suppresses duplicate native UI explanations', () => {
  expect(insightCopy('**Kiểm tra phạm vi còn lại.**')).toBe('Kiểm tra phạm vi còn lại.');
  expect(insightCopy('Kiểm tra deadline.', ['Kiểm tra deadline'])).toBe('');
});
it('hides internal structured output, oversized text and claims of automatic action', () => {
  for (const text of ['{"nextStep":"test"}', 'IN_PROGRESS', 'Đã tự động giao nhiệm vụ', 'a'.repeat(241)]) expect(insightCopy(text)).toBe('');
});

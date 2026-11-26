import { describe, expect, it } from 'vitest';
import { getCompletionPercentage } from './progress';

describe('project completion', () => {
  it('distinguishes no eligible tasks from tasks with no completions', () => {
    expect(getCompletionPercentage(0, 0)).toBeNull();
    expect(getCompletionPercentage(0, 3)).toBe(0);
  });

  it('uses the non-cancelled task denominator', () => {
    expect(getCompletionPercentage(2, 3)).toBe(67);
    expect(getCompletionPercentage(3, 3)).toBe(100);
  });
});

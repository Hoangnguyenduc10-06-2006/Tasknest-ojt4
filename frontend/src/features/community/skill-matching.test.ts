import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  computeSkillMatch,
  getSavedMatchingSkills,
  saveMatchingSkills,
} from './skill-matching';
afterEach(() => vi.unstubAllGlobals());
describe('matching uses real account data', () => {
  it('does not infer skills or hours for a new or anonymous account', () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => null } });
    expect(getSavedMatchingSkills('new')).toEqual({
      skills: '',
      weeklyHours: 0,
    });
    expect(getSavedMatchingSkills()).toEqual({ skills: '', weeklyHours: 0 });
    expect(computeSkillMatch('React', '').assessable).toBe(false);
    expect(computeSkillMatch('', 'React').assessable).toBe(false);
  });
  it('does not match unrelated skill names by substring', () => {
    expect(computeSkillMatch('Java', 'JavaScript').matchedSkills).toEqual([]);
    expect(computeSkillMatch('React', 'React Native').matchedSkills).toEqual(
      [],
    );
    expect(computeSkillMatch('ReactJS, TS', 'React, TypeScript').score).toBe(
      100,
    );
  });
  it('initializes from the profile and keeps explicit search criteria account scoped', () => {
    const data = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => data.set(key, value),
      },
    });
    const profile = {
      configured: true,
      publicUrl: '',
      likes: 0,
      recognitionCount: 0,
      completedProjects: 0,
      skills: ['Java'],
      weekly_hours: 12,
    };
    expect(getSavedMatchingSkills('a', profile)).toEqual({
      skills: 'Java',
      weeklyHours: 12,
    });
    saveMatchingSkills('Go', 20, 'a');
    expect(getSavedMatchingSkills('a', profile)).toEqual({
      skills: 'Go',
      weeklyHours: 20,
    });
    expect(getSavedMatchingSkills('b')).toEqual({ skills: '', weeklyHours: 0 });
  });
});

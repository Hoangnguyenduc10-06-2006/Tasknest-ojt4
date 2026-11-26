import { describe, expect, it } from 'vitest';
import {
  draftFrom,
  needsOnboarding,
  professionalSetupInput,
  setupDestination,
  setupError,
  setupErrors,
  suggestedPurpose,
} from './onboarding';
const user = {
  id: 'u',
  fullName: 'An',
  email: 'an@example.test',
  emailVerified: true,
};
describe('account onboarding', () => {
  it('uses current profile and avatar privacy when editing a previously completed setup', () => {
    const draft = draftFrom(
      {
        user: { ...user, onboardingStatus: 'COMPLETED', avatarPublic: false },
        draft: { headline: 'Old', shareAvatar: true },
      },
      {
        configured: true,
        headline: 'Updated title',
        publicUrl: '',
        likes: 0,
        recognitionCount: 0,
        completedProjects: 0,
      },
    );
    expect(draft.headline).toBe('Updated title');
    expect(draft.shareAvatar).toBe(false);
  });
  it('automatically opens only pending new-user setup, preserving deferral across logins', () => {
    for (const onboardingStatus of ['NOT_STARTED', 'IN_PROGRESS'])
      expect(needsOnboarding({ ...user, onboardingStatus })).toBe(true);
    for (const onboardingStatus of ['DEFERRED', 'COMPLETED', undefined])
      expect(needsOnboarding({ ...user, onboardingStatus })).toBe(false);
    expect(setupDestination('/setup?returnTo=/setup')).toBe('/dashboard');
    expect(setupDestination('/projects/17')).toBe('/projects/17');
  });
  it('resumes private drafts and fills only missing values from an existing professional profile', () => {
    const draft = draftFrom(
      { user, draft: { headline: 'Draft headline', goals: 'Client need' } },
      {
        configured: true,
        headline: 'Existing',
        about: 'Existing about',
        skills: ['Java'],
        publicUrl: '',
        likes: 0,
        recognitionCount: 0,
        completedProjects: 0,
      },
    );
    expect(draft.headline).toBe('Draft headline');
    expect(draft.about).toBe('Existing about');
    expect(draft.publishProfile).toBe(false);
    expect(setupError('BOTH', draft)).toContain('20');
  });
  it('does not erase existing portfolios or experience when finishing the guided core profile', () => {
    const draft = draftFrom({
      user,
      draft: {
        headline: 'Developer',
        about: 'Build software with the team',
        skills: ['React'],
      },
    });
    const existing = {
      configured: true,
      experience_years: 4,
      portfolio_items: [
        { title: 'Product', role: 'Dev', description: 'API', url: null },
      ],
      version: 7,
      publicUrl: '',
      likes: 0,
      recognitionCount: 0,
      completedProjects: 0,
    };
    const input = professionalSetupInput(existing, draft);
    expect(input.portfolioItems).toEqual(existing.portfolio_items);
    expect(input.experienceYears).toBe(4);
    expect(input.version).toBe(7);
    expect(setupError('DEVELOPER', draft)).toBeUndefined();
  });
  it('suggests needs from current activity without overwriting an explicit preference', () => {
    const context = {
      teams: [],
      invitations: [],
      activity: { isDeveloper: true, isCustomer: false },
    };
    expect(suggestedPurpose('UNDECIDED', context)).toBe('DEVELOPER');
    context.activity.isCustomer = true;
    expect(suggestedPurpose(undefined, context)).toBe('BOTH');
    expect(suggestedPurpose('CLIENT', context)).toBe('CLIENT');
    expect(suggestedPurpose('UNDECIDED')).toBe('UNDECIDED');
  });
  it('reports all invalid fields separately and clears only corrected fields', () => {
    const draft = draftFrom({
      user,
      draft: { goals: 'Ngắn', about: 'Tôi muốn phát triển' },
    });
    const errors = setupErrors('BOTH', draft);
    expect(Object.keys(errors)).toEqual([
      'goals',
      'headline',
      'about',
      'skills',
    ]);
    expect(errors.about).toContain('20 ký tự');
    expect(
      setupErrors('BOTH', {
        ...draft,
        about: 'Tôi muốn phát triển ứng dụng quản lý dự án',
      }).about,
    ).toBeUndefined();
    expect(
      setupErrors('BOTH', { ...draft, skills: ['React'] }).skills,
    ).toBeUndefined();
    expect(setupErrors('CLIENT', { ...draft, goals: '' })).toEqual({});
    expect(
      setupErrors('DEVELOPER', { ...draft, skills: ['x'.repeat(41)] }).skills,
    ).toContain('40');
  });
  it('does not require a project brief simply to enable hiring as another need', () => {
    const draft = draftFrom({
      user,
      draft: {
        headline: 'Developer',
        about: 'Build software and cooperate with other teams',
        skills: ['React'],
      },
    });
    expect(setupError('BOTH', draft)).toBeUndefined();
    expect(setupError('CLIENT', draft)).toBeUndefined();
  });
});

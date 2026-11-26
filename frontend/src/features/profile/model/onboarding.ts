import type { MyTeams } from '../../community/community.api';
import type { SessionUser } from '../../auth';
import type { ProfessionalProfile } from './professional-profile';
export type OnboardingDraft = {
  company: string;
  location: string;
  goals: string;
  headline: string;
  about: string;
  skills: string[];
  publishProfile: boolean;
  shareAvatar: boolean;
};
export type OnboardingState = {
  user: SessionUser;
  draft: Partial<OnboardingDraft>;
};
export const needsOnboarding = (user?: SessionUser) =>
  !!user &&
  (['NOT_STARTED', 'IN_PROGRESS'].includes(user.onboardingStatus ?? '') ||
    (user.onboardingStatus === 'DEFERRED' && user.accountPurpose === 'UNDECIDED'));
export const isDeveloper = (purpose: string) =>
  purpose === 'DEVELOPER' || purpose === 'BOTH';
export const isClient = (purpose: string) =>
  purpose === 'CLIENT' || purpose === 'BOTH';
export function setupDestination(value: string | null) {
  return value?.split(/[?#]/, 1)[0] === '/setup' ? '/dashboard' : value;
}
export function draftFrom(
  state: OnboardingState,
  profile?: ProfessionalProfile,
): OnboardingDraft {
  const draft = {
    company: '',
    location: profile?.location ?? '',
    goals: '',
    headline: profile?.headline ?? '',
    about: profile?.about ?? '',
    skills: profile?.skills ?? [],
    publishProfile: profile?.is_public ?? false,
    shareAvatar: state.user.avatarPublic ?? false,
    ...state.draft,
  };
  if (state.user.onboardingStatus === 'COMPLETED') {
    draft.shareAvatar = state.user.avatarPublic ?? false;
    if (profile?.configured) {
      draft.headline = profile.headline ?? '';
      draft.about = profile.about ?? '';
      draft.location = profile.location ?? '';
      draft.skills = profile.skills ?? [];
      draft.publishProfile = profile.is_public ?? false;
    }
  }
  return draft;
}
export function suggestedPurpose(
  saved: string | undefined,
  context?: MyTeams,
  profile?: ProfessionalProfile,
) {
  if (saved && ['CLIENT', 'DEVELOPER', 'BOTH'].includes(saved)) return saved;
  const developer =
    !!context?.teams.length ||
    !!context?.activity?.isDeveloper ||
    !!profile?.configured;
  const customer = !!context?.activity?.isCustomer;
  return developer && customer
    ? 'BOTH'
    : developer
      ? 'DEVELOPER'
      : customer
        ? 'CLIENT'
        : 'UNDECIDED';
}
export type SetupErrors = Partial<
  Record<'purpose' | 'goals' | 'headline' | 'about' | 'skills', string>
>;
export function setupErrors(
  purpose: string,
  draft: OnboardingDraft,
): SetupErrors {
  const errors: SetupErrors = {};
  if (!['CLIENT', 'DEVELOPER', 'BOTH'].includes(purpose))
    errors.purpose = 'Chọn ít nhất một nhu cầu sử dụng.';
  if (isClient(purpose) && draft.goals.trim() && draft.goals.trim().length < 20)
    errors.goals = 'Mô tả nhu cầu hợp tác ít nhất 20 ký tự hoặc để trống.';
  if (isDeveloper(purpose)) {
    if (!draft.headline.trim())
      errors.headline = 'Nhập chuyên môn giới thiệu của bạn.';
    if (draft.about.trim().length < 20)
      errors.about = 'Giới thiệu kinh nghiệm và định hướng ít nhất 20 ký tự.';
    if (!draft.skills.length) errors.skills = 'Nhập ít nhất một kỹ năng.';
    else if (
      draft.skills.length > 20 ||
      draft.skills.some((skill) => skill.length > 40)
    )
      errors.skills = 'Tối đa 20 kỹ năng, mỗi kỹ năng không quá 40 ký tự.';
  }
  return errors;
}
export function setupError(purpose: string, draft: OnboardingDraft) {
  return Object.values(setupErrors(purpose, draft))[0];
}
export function professionalSetupInput(
  profile: ProfessionalProfile,
  draft: OnboardingDraft,
) {
  return {
    headline: draft.headline.trim(),
    about: draft.about.trim(),
    location: draft.location.trim(),
    skills: draft.skills,
    experienceYears: profile.experience_years ?? null,
    desiredRoles: profile.desired_roles?.length ? profile.desired_roles
      : draft.headline.trim() && draft.headline.trim().length <= 40 ? [draft.headline.trim()] : [],
    collaborationModes: profile.collaboration_modes ?? [],
    availability: profile.availability ?? 'BUSY',
    weeklyHours: profile.weekly_hours ?? null,
    githubUrl: profile.github_url ?? null,
    linkedinUrl: profile.linkedin_url ?? null,
    websiteUrl: profile.website_url ?? null,
    portfolioItems: profile.portfolio_items ?? [],
    isPublic: draft.publishProfile,
    version: profile.version,
  };
}

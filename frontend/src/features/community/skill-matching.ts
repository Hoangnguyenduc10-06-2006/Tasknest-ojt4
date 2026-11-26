export type SkillMatchResult = {
  score: number;
  assessable: boolean;
  matchedSkills: string[];
  missingSkills: string[];
  hoursCompatible: boolean;
  summaryLabel: string;
};

const SKILL_ALIASES: Record<string, string> = {
  reactjs: 'react',
  'react.js': 'react',
  ts: 'typescript',
  js: 'javascript',
  nodejs: 'node',
  'node.js': 'node',
  springboot: 'spring boot',
  spring: 'spring boot',
  postgres: 'postgresql',
  mysql8: 'mysql',
  tailwindcss: 'tailwind',
  'tailwind css': 'tailwind',
};

export function normalizeSkill(raw: string): string {
  const cleaned = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  return SKILL_ALIASES[cleaned] ?? cleaned;
}

export function splitSkills(
  raw: string | string[] | undefined | null,
): string[] {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : raw.split(/[,，;/|]+/);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of list) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    const norm = normalizeSkill(trimmed);
    if (!seen.has(norm)) {
      seen.add(norm);
      result.push(trimmed);
    }
  }
  return result;
}

export function computeSkillMatch(
  requiredSkillsRaw: string | string[],
  userSkillsRaw: string | string[],
  requiredWeeklyHours?: number,
  userAvailableHours?: number,
): SkillMatchResult {
  const required = splitSkills(requiredSkillsRaw);
  const userSkills = splitSkills(userSkillsRaw);
  const userNormalized = new Set(userSkills.map(normalizeSkill));

  if (required.length === 0 || userSkills.length === 0) {
    return {
      score: 0,
      assessable: false,
      matchedSkills: [],
      missingSkills: [],
      hoursCompatible: true,
      summaryLabel: 'Chưa đủ thông tin để đánh giá',
    };
  }

  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];

  for (const req of required) {
    const reqNorm = normalizeSkill(req);
    const matched = userNormalized.has(reqNorm);
    if (matched) matchedSkills.push(req);
    else missingSkills.push(req);
  }

  const skillRatio = matchedSkills.length / required.length;
  const hoursCompatible =
    !requiredWeeklyHours ||
    !userAvailableHours ||
    userAvailableHours >= requiredWeeklyHours;

  const hoursKnown = !!requiredWeeklyHours && !!userAvailableHours;
  let score = hoursKnown
    ? Math.round(
        skillRatio * 85 +
          (hoursCompatible
            ? 15
            : Math.min(
                15,
                Math.round(
                  ((userAvailableHours ?? 0) / (requiredWeeklyHours || 1)) * 15,
                ),
              )),
      )
    : Math.round(skillRatio * 100);
  if (matchedSkills.length === 0) score = Math.min(score, 15);
  score = Math.max(0, Math.min(100, score));

  const summaryLabel = `Phù hợp ${score}% · Khớp ${matchedSkills.length}/${required.length} kỹ năng`;
  return {
    score,
    assessable: true,
    matchedSkills,
    missingSkills,
    hoursCompatible,
    summaryLabel,
  };
}

import type { ProfessionalProfile } from '../profile/model/professional-profile';
const PROFILE_SKILLS_KEY = 'tasknest:matching-criteria:';
export function getSavedMatchingSkills(
  user?: string,
  profile?: ProfessionalProfile,
): { skills: string; weeklyHours: number } {
  const base = {
    skills: (profile?.skills ?? []).join(', '),
    weeklyHours: profile?.weekly_hours ?? 0,
  };
  if (!user) return { skills: '', weeklyHours: 0 };
  try {
    const raw = window.localStorage.getItem(PROFILE_SKILLS_KEY + user);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as { skills?: string; weeklyHours?: number };
    return {
      skills: typeof parsed.skills === 'string' ? parsed.skills : base.skills,
      weeklyHours:
        typeof parsed.weeklyHours === 'number' &&
        parsed.weeklyHours >= 0 &&
        parsed.weeklyHours <= 168
          ? parsed.weeklyHours
          : base.weeklyHours,
    };
  } catch {
    return base;
  }
}
export function saveMatchingSkills(
  skills: string,
  weeklyHours: number,
  user?: string,
) {
  if (!user) return;
  try {
    window.localStorage.setItem(
      PROFILE_SKILLS_KEY + user,
      JSON.stringify({ skills, weeklyHours }),
    );
  } catch {
    /* Criteria remain usable in memory. */
  }
}

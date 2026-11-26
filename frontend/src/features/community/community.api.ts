import { useCallback, useEffect, useRef, useState } from 'react';
import { authenticatedAccessToken, useSession } from '../auth';
import { ApiError, requestJson } from '../../shared/api/client';
import type { ProfessionalProfile } from '../profile/model/professional-profile';

export type Team = {
  id: number;
  owner_user_id: string;
  name: string;
  description: string;
  skills: string;
  accepting_work: boolean;
  version: number;
  member_count: number;
  likes: number;
  review_count: number;
  rating: number | null;
  completed_projects: number;
};
export type Review = {
  project_id: number;
  quality: number;
  schedule: number;
  communication: number;
  support: number;
  comment: string;
  would_rehire: boolean;
  reply: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  reply_updated_at: string | null;
  customer_name: string;
  project_public_name: string | null;
  rating: number;
};
export type Recognition = {
  strengths: string;
  comment: string;
  customer_name: string;
  project_public_name: string | null;
  team_id: number;
  team_name: string;
  updated_at: string;
};
export type TeamProfile = Team & {
  liked: boolean;
  isOwner: boolean;
  reviews: Review[];
  members: {
    user_id: string;
    display_name: string;
    specialty: string;
    can_message?: boolean | number;
    likes: number;
    recognitions: number;
  }[];
};
export type MemberProfile = {
  connectionOnly?: boolean;
  user_id: string;
  display_name: string;
  likes: number;
  liked: boolean;
  recognitionCount: number;
  recognitions: Recognition[];
  teams: { id: number; name: string }[];
  professional?: ProfessionalProfile | null;
  completedProjects?: number;
};
export type MyTeams = {
  activity?: { isDeveloper: boolean; isCustomer: boolean };
  teams: Team[];
  invitations: { team_id: number; name: string }[];
};
export type Engagement = {
  configured: boolean;
  team_id?: number;
  team_name?: string;
  customer_name?: string;
  status?: 'PROPOSED' | 'ACTIVE' | 'COMPLETED';
  isCustomer?: boolean;
  isTeamOwner?: boolean;
  review?: Review | null;
  reopenRequest?: { id: string; requestedByMe: boolean; fromCustomer: boolean };
  project_public_name?: string | null;
  contributors?: {
    user_id: string;
    display_name: string;
    completed_tasks?: number | null;
    tracked_seconds?: number | null;
    strengths: string | null;
    comment: string | null;
  }[];
};
export const strengths = {
  COMMUNICATION: 'Giao tiếp rõ ràng',
  PROBLEM_SOLVING: 'Giải quyết vấn đề',
  DESIGN: 'Thiết kế tốt',
  SUPPORT: 'Hỗ trợ tận tình',
  RELIABILITY: 'Đáng tin cậy',
};
export const inputClass =
  'mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink';
export const panelClass = 'rounded-2xl border border-line bg-surface p-5';
export const dateLabel = (value: string) =>
  new Date(value).toLocaleDateString('vi-VN');
export function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Không thể thực hiện. Vui lòng thử lại.';
}
export async function communityRequest<T>(
  path: string,
  userId?: string,
  body?: unknown,
  method?: 'POST' | 'PUT' | 'DELETE',
) {
  const accessToken = userId
    ? await authenticatedAccessToken(userId)
    : undefined;
  const result = await requestJson<{ data: T }>('/api/work/' + path, {
    accessToken,
    body,
    method,
  });
  return result.data;
}
export function useCommunityResource<T>(path: string | null) {
  const session = useSession();
  const user = session.status === 'authenticated' ? session.user.id : undefined;
  const key = user + '/' + path;
  const [state, setState] = useState<{ key: string; data?: T; error?: string; refreshError?: string }>(
    { key: '' },
  );
  const requestId = useRef(0);
  const reload = useCallback(async (background = false) => {
    if (!path) return;
    const request = ++requestId.current;
    try {
      const data = await communityRequest<T>(path, user);
      if (requestId.current === request) setState({ key, data });
    } catch (error) {
      if (requestId.current === request)
        setState(previous => background && previous.key === key && previous.data !== undefined && !(error instanceof ApiError && [401,403,404].includes(error.status))
          ? {...previous, refreshError: errorMessage(error)}
          : {key, error: errorMessage(error)});
    }
  }, [path, user, key]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void reload();
    }, 0);
    const refresh = () => { if (!document.hidden) void reload(true); };
    window.addEventListener('tasknest:sync', refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener('pageshow', refresh);
    const cancel = () => {
      requestId.current++;
    };
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('tasknest:sync', refresh);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pageshow', refresh);
      cancel();
    };
  }, [reload]);
  return {
    data: state.key === key ? state.data : undefined,
    error: state.key === key ? state.error : undefined,
    refreshError: state.key === key ? state.refreshError : undefined,
    reload,
    user,
  };
}

export function communityQueryId(name: string): string | null {
  const value = new URLSearchParams(window.location.search).get(name);
  return value && /^[1-9]\d{0,14}$/.test(value) ? value : null;
}

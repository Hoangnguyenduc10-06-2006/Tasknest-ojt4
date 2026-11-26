export type LayoutUser = {
  name: string;
  initials: string;
  specialty: string;
  avatarUrl?: string;
};
export type RecentProject = {
  id: string;
  name: string;
  members?: number;
  initial: string;
  tone: 'accent' | 'danger' | 'success' | 'warning' | 'review';
};
export type ShellData = {
  client?: boolean;
  canWork?: boolean;
  ownsTeam?: boolean;
  memberOfTeam?: boolean;
  hasTeamInvitations?: boolean;
  user: LayoutUser;
  unreadCount?: number;
  myTaskCount?: number;
  hasPendingInvitations: boolean;
  recentProjects: RecentProject[];
};

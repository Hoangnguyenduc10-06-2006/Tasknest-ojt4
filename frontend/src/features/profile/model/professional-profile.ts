export type PortfolioItem = {
  title: string;
  role: string;
  description: string;
  url: string | null;
};
export type ProfessionalProfile = {
  configured: boolean;
  display_name?: string;
  headline?: string;
  about?: string;
  location?: string;
  experience_years?: number | null;
  skills?: string[];
  desired_roles?: string[];
  collaboration_modes?: string[];
  availability?: string;
  weekly_hours?: number | null;
  github_url?: string | null;
  linkedin_url?: string | null;
  website_url?: string | null;
  social_url?: string | null;
  contact_email?: string | null;
  portfolio_items?: PortfolioItem[];
  is_public?: boolean;
  version?: number;
  publicUrl: string;
  likes: number;
  recognitionCount: number;
  completedProjects: number;
};
export const availabilityLabels: Record<string, string> = {
  AVAILABLE: 'Sẵn sàng nhận dự án',
  LOOKING_FOR_TEAM: 'Đang tìm đội phù hợp',
  BUSY: 'Đang bận, chưa nhận việc mới',
};
export const collaborationLabels: Record<string, string> = {
  PROJECT: 'Theo dự án',
  PART_TIME: 'Bán thời gian',
  FULL_TIME: 'Toàn thời gian',
};
export function parseProfileTags(value: string) {
  return [
    ...new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}
export function profileLinkError(value: string) {
  if (!value.trim()) return undefined;
  try {
    const url = new URL(value.trim());
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      /\p{Cc}/u.test(value)
    ) {
      return 'Liên kết cần dùng http:// hoặc https:// và không chứa thông tin đăng nhập.';
    }
  } catch {
    return 'Nhập liên kết đầy đủ, ví dụ https://github.com/ten-cua-ban.';
  }
}

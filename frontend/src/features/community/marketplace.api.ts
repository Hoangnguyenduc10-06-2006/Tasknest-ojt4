export type CustomerRequest = {
  id: number;
  customer_user_id: string;
  customer_name: string;
  title: string;
  description: string;
  skills: string;
  budget_min: number | null;
  budget_max: number | null;
  desired_delivery: string;
  reference_url: string | null;
  image_count?: number;
  status: string;
  version: number;
  proposal_count: number;
  created_at: string;
  updated_at: string;
  project_id: number | null;
  selected_team_name: string | null;
  isOwner?: boolean;
  canAccessProject?: boolean;
};
export type Proposal = {
  id: number;
  request_id: number;
  team_id: number;
  team_name: string;
  team_owner: string;
  request_version: number;
  plan: string;
  amount: number;
  starts_on: string;
  ends_on: string;
  status: string;
  version: number;
  updated_at: string;
  member_count: number;
  message_count?: number;
  unread_messages?: number;
};
export type MarketplacePageResult<T> = {
  items: T[];
  total: number;
  page: number;
};
export const requestStatuses: Record<string, string> = {
  DRAFT: 'Bản nháp',
  OPEN: 'Đang tìm đội',
  PAUSED: 'Tạm dừng nhận đề xuất',
  CLOSED: 'Đã đóng',
  AWARDED: 'Đã chọn đội',
};
export const proposalStatuses: Record<string, string> = {
  SUBMITTED: 'Đang chờ khách hàng',
  WITHDRAWN: 'Đội đã rút đề xuất',
  ACCEPTED: 'Được chọn thực hiện',
  DECLINED: 'Khách hàng đã chọn đội khác',
};
export function money(value: number | string) {
  return Number(value).toLocaleString('vi-VN') + ' ₫';
}
export function budgetLabel(
  request: Pick<CustomerRequest, 'budget_min' | 'budget_max'>,
) {
  if (request.budget_min != null && request.budget_max != null)
    return money(request.budget_min) + ' – ' + money(request.budget_max);
  if (request.budget_min != null) return 'Từ ' + money(request.budget_min);
  if (request.budget_max != null) return 'Đến ' + money(request.budget_max);
  return 'Trao đổi theo phạm vi';
}

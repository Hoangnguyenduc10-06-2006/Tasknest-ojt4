export type Milestone = {
  id: number;
  title: string;
  due_on: string;
  criteria: string[];
  status: string;
  version: number;
  task_count: number;
  closed_tasks: number;
  submission_count: number;
  latest_submission_id: number | null;
  cancelled_reason: string | null;
};
export type MilestoneSubmission = {
  id: number;
  submission_no: number;
  submitted_name: string;
  note: string;
  result_url: string;
  criteria: string[];
  decision: string;
  feedback: string | null;
  checked_criteria: number[] | null;
  reviewer_name: string | null;
  submitted_at: string;
  reviewed_at: string | null;
};
export type MilestonePage = {
  items: Milestone[];
  counts: {
    total: number;
    accepted: number;
    awaiting_review: number;
    changes_requested: number;
  };
  configured: boolean;
  canManage: boolean;
  canReview: boolean;
  readOnly: boolean;
};
export type MilestoneDetails = Milestone & {
  tasks: { id: number; name: string; status: string }[];
  submissions: MilestoneSubmission[];
  submissionCount: number;
};
export const milestoneLabels: Record<string, string> = {
  DRAFT: 'Chờ xác nhận kế hoạch',
  ACTIVE: 'Đang thực hiện',
  IN_REVIEW: 'Chờ khách hàng nghiệm thu',
  CHANGES_REQUESTED: 'Cần chỉnh sửa',
  ACCEPTED: 'Đã chấp nhận',
  CANCELLED: 'Đã hủy',
};
export const submissionLabels: Record<string, string> = {
  PENDING: 'Chờ phản hồi',
  ACCEPTED: 'Đã chấp nhận',
  CHANGES_REQUESTED: 'Yêu cầu chỉnh sửa',
};

export type JoinRequestStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'CLOSED';

export type InvitationStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'EXPIRED'
  | 'CANCELLED';

export interface JoinRequest {
  id: string;
  projectId: string;
  projectName: string;
  projectCode: string;
  projectColor?: string;
  sentAt: string;
  message: string;
  status: JoinRequestStatus;
  projectArchived?: boolean;
}

export interface DirectInvitation {
  id: string;
  projectId: string;
  projectName: string;
  projectCode: string;
  projectColor?: string;
  invitedAt: string;
  inviterName: string;
  inviterRole: string;
  role: 'Owner' | 'Manager' | 'Member' | 'Customer' | 'Viewer';
  message: string;
  status: InvitationStatus;
  projectArchived?: boolean;
}

export type PersonalInvitationTab = 'direct_invitations' | 'sent_requests';

import { Badge, type BadgeTone } from '../../../shared/ui/Badge';
import type { InvitationStatus,JoinRequestStatus } from '../model/invitation.types';
const config:Record<InvitationStatus|JoinRequestStatus,{label:string;tone:BadgeTone}>={CLOSED:{label:'Đã đóng',tone:'neutral'},PENDING:{label:'Chờ duyệt',tone:'amber'},ACCEPTED:{label:'Đã chấp nhận',tone:'green'},REJECTED:{label:'Đã từ chối',tone:'neutral'},DECLINED:{label:'Đã từ chối',tone:'neutral'},CANCELLED:{label:'Đã hủy',tone:'neutral'},EXPIRED:{label:'Đã hết hạn',tone:'red'}};
export function StatusBadge({status}:{status:InvitationStatus|JoinRequestStatus}){const item=config[status];return <Badge tone={item.tone}>{item.label}</Badge>;}

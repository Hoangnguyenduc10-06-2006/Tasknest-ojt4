import { RoleBadge } from '../../../shared/ui/RoleBadge';
import { Button } from '../../../shared/ui/Button';
import { Badge } from '../../../shared/ui/Badge';
import { UserAvatar as Avatar } from '../../profile/components/UserAvatar';
import { Icon } from '../../../shared/ui/Icon';
import { useWorkspace } from '../../workspace';
import { ProjectAvatar } from './ProjectAvatar';
import { ProjectAvatarEditor } from './ProjectAvatarEditor';
import type { MyProjectItem } from '../model/project.types';

export function ProjectSettings({ project, editable, canArchive, pending, hasRunningTimer, onEdit, onArchive, onMembers }: {
  project: MyProjectItem; editable: boolean; canArchive: boolean; pending: boolean; hasRunningTimer: boolean;
  onEdit: () => void; onArchive: () => void; onMembers: () => void;
}) {
  const workspace = useWorkspace();
  const archived = project.status === 'ARCHIVED';
  const completed = project.developmentState === 'COMPLETED';
  const leaders = workspace.data?.members.filter(member => member.projectId === project.id && ['Owner','Manager'].includes(member.role)) ?? [];
  return <section className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-semibold">Cài đặt dự án</h2><p className="mt-2 text-xs text-muted">Quản lý thông tin chung, lịch dự kiến và trạng thái dự án.</p></div><RoleBadge role={project.role} prefix="Bạn là " /></div>
    <div className="settings-layout">
      <section className="panel settings-form">
        <div className="panel-head"><div><h2>Thông tin chung</h2><p>Hiển thị với tất cả thành viên của dự án.</p></div>{editable && <Button kind="secondary" onClick={onEdit}>Chỉnh sửa</Button>}</div>
        <div className="mt-5 flex items-center gap-3 rounded-lg border border-dashed border-line bg-field p-4"><ProjectAvatar code={project.code} name={project.name} projectId={project.id} colorClass={project.iconBgClass} imageUrl={project.imageUrl} className="size-12" /><div><strong className="text-sm">Ảnh dự án</strong><p className="text-xs text-muted">PNG, JPG tối đa 5 MB</p></div></div>
        {editable && <div className="mt-3"><ProjectAvatarEditor project={project.id} version={project.version ?? 0} /></div>}
        <div className="mt-5 grid gap-4">
          <label className="field"><span>Tên dự án</span><input readOnly value={project.name} /></label>
          <label className="field"><span>Mô tả</span><textarea readOnly value={project.description} /></label>
          <div className="field-row"><label className="field"><span>Ngày bắt đầu</span><input readOnly value={project.startDate || 'Chưa đặt'} /></label><label className="field"><span>Kết thúc dự kiến</span><input readOnly value={project.endDate || 'Chưa đặt'} /></label></div>
          <div className="info-callout"><Icon name="alert" /><span>Đổi lịch dự án không tự đổi deadline nhiệm vụ. Deadline ngoài lịch dự kiến chỉ được cảnh báo, không chặn lưu.</span></div>
          <div className="form-footer"><span>Cập nhật gần nhất: {project.updatedAt || 'Chưa có thông tin'}</span>{(archived || completed) && <Badge>Chỉ xem</Badge>}</div>
        </div>
      </section>
      <aside className="settings-aside">
        <section className="panel role-management"><h2>Quản lý vai trò</h2>
          {leaders.map(member => <div key={member.id}><Avatar userId={member.id} projectId={project.id} name={member.name} tone={member.role === 'Owner' ? 'purple' : 'green'} /><span><strong>{member.name}</strong><small><RoleBadge role={member.role} />{member.role === 'Owner' ? ' · Không thể chuyển hoặc xóa' : ''}</small></span></div>)}
          {!leaders.length && <p>Chưa tải được thông tin vai trò.</p>}
          <p>Chỉ Owner có thể chỉ định Manager. Quản lý vai trò trong danh sách thành viên.</p><Button kind="ghost" size="sm" onClick={onMembers}>Quản lý thành viên</Button>
        </section>
        <section className="panel danger-zone"><h2>Trạng thái dự án</h2><p>{completed ? 'Khách hàng và chủ đội cần đồng ý mở lại trong Nghiệm thu & đánh giá.' : 'Chủ dự án có thể lưu trữ hoặc khôi phục dự án.'}</p><div className="mt-3"><Badge tone={archived || completed ? 'neutral' : 'green'}>{archived ? 'Đã lưu trữ' : completed ? 'Đã hoàn thành' : 'Đang hoạt động'}</Badge></div>
          {canArchive && <Button className="mt-4" kind={archived ? 'secondary' : 'danger'} loading={pending} disabled={!archived && hasRunningTimer} onClick={onArchive}>{archived ? 'Khôi phục dự án' : 'Lưu trữ dự án'}</Button>}
          {!archived && hasRunningTimer && <p className="mt-2">Cần dừng các phiên ghi giờ trước khi lưu trữ dự án.</p>}
        </section>
      </aside>
    </div>
  </section>;
}

import { ChatLink } from '../../../messaging/ChatLink';
import { ConfirmDialog, type Confirmation } from '../../../../shared/ui/ConfirmDialog';
import { Pagination } from '../../../../shared/ui/Pagination';
import { RoleBadge } from '../../../../shared/ui/RoleBadge';
import { UserAvatar } from '../../../profile/components/UserAvatar';
import { SectionHeader } from '../../../../shared/ui/SectionHeader';
import { Button } from '../../../../shared/ui/Button';
import { Tabs } from '../../../../shared/ui/Tabs';
import { useRef, useState } from 'react';
import { useSession } from '../../../auth';
import { useWorkspace } from '../../../workspace';
import { useProjectMembers } from '../../hooks/useProjectMembers';
import {
  cancelProjectInvitation,
  decideProjectRequest,
  inviteProjectMember,
  removeProjectMember,
  setProjectMemberRole,
} from '../../api/project-members.api';
import type { ProjectMemberTab } from '../../model/project-member.types';
import type { MyProjectItem } from '../../model/project.types';
import { InviteMemberModal } from '../modals/InviteMemberModal';
import { ShareProjectModal } from '../modals/ShareProjectModal';
const statuses: Record<string, string> = {
  ACTIVE: 'Đang tham gia',
  PENDING: 'Chờ phản hồi',
  ACCEPTED: 'Đã chấp nhận',
  REJECTED: 'Đã từ chối',
  CANCELLED: 'Đã hủy',
  EXPIRED: 'Hết hạn',
  CLOSED: 'Đã đóng',
};
const roles: Record<string, string> = {
  Customer: 'Khách hàng',
  Owner: 'Chủ dự án',
  Manager: 'Quản lý',
  Member: 'Thành viên',
};
const date = (value: string) =>
  new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
export interface ProjectMembersViewProps {
  project: MyProjectItem;
}
export function ProjectMembersView({ project }: ProjectMembersViewProps) {
  const session = useSession();
  return session.status === 'authenticated' ? (
    <Members
      key={`${session.user.id}/${project.id}`}
      project={project}
      userId={session.user.id}
    />
  ) : null;
}
function Members({
  project,
  userId,
}: {
  project: MyProjectItem;
  userId: string;
}) {
  const [confirmation, setConfirmation] = useState<Confirmation>();
  const [tab, setTab] = useState<ProjectMemberTab>('members');
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const busy = useRef(false);
  const workspace = useWorkspace();

  const {
    data,
    error: loadError,
    refresh,
  } = useProjectMembers(userId, project.id, tab, page, size);
  const manager = !!data && ['OWNER', 'MANAGER'].includes(data.role);
  const editable = manager && !data?.archived && project.status !== 'ARCHIVED' && project.developmentState !== 'COMPLETED';
  const owner = data?.role === 'OWNER' && editable;
  const reload = async () => {
    await Promise.all([refresh(), workspace.refresh()]);
  };
  const action = async (operation: () => Promise<unknown>, message: string) => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError('');
    setFeedback('');
    try {
      await operation();
      setFeedback(message);
      await reload();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Không thể thực hiện thao tác.',
      );
      await refresh();
    } finally {
      busy.current = false;
      setPending(false);
    }
  };
  const tabs = manager
    ? (['members', 'invitations', 'requests'] as const)
    : (['members'] as const);
  return (
    <section className="space-y-5">
      <ConfirmDialog confirmation={confirmation} onClose={() => setConfirmation(undefined)} />
      <SectionHeader title="Thành viên & lời mời" description="Quản lý người tham gia và các yêu cầu vào dự án." actions={editable && <><Button kind="secondary" icon="users" onClick={() => setShareOpen(true)}>Chia sẻ link / QR</Button><Button icon="plus" onClick={() => setInviteOpen(true)}>Mời thành viên</Button></>} />
      <Tabs value={tab} onChange={(value) => { setTab(value); setPage(0); setError(''); setFeedback(''); }} items={tabs.map(value => ({ value, label: value === 'members' ? 'Thành viên' : value === 'invitations' ? 'Lời mời đã gửi' : 'Yêu cầu tham gia' }))} />
      {(error || loadError) && (
        <p
          role="alert"
          className="rounded-xl border border-line bg-surface p-4 text-sm text-red-500"
        >
          {error || loadError}
          <button className="ml-3 underline" onClick={() => void refresh()}>
            Tải lại
          </button>
        </p>
      )}
      {feedback && (
        <p role="status" className="rounded-xl bg-tint p-3 text-sm text-ink">
          {feedback}
        </p>
      )}
      {!data && !loadError && (
        <p role="status" className="py-10 text-center text-sm text-muted">
          Đang tải dữ liệu…
        </p>
      )}
      {data && (
        <>
          <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {!data.items.length && (
              <p className="p-10 text-center text-sm text-muted">
                {tab === 'members'
                  ? 'Chưa có thành viên.'
                  : tab === 'invitations'
                    ? 'Chưa có lời mời đã gửi.'
                    : 'Chưa có yêu cầu tham gia.'}
              </p>
            )}
            {data.items.map((item) => (
              <div
                key={item.id}
                className="flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <UserAvatar name={item.name} userId={item.userId} projectId={project.id} className="size-10" />
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold text-ink">
                      <a href={`/members/${encodeURIComponent(item.userId)}?project=${encodeURIComponent(project.id)}`} className="hover:text-accent">{item.name}</a>
                      {item.userId === userId && (
                        <span className="ml-2 text-xs text-accent">Bạn</span>
                      )}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {tab === 'members'
                        ? 'Tham gia'
                        : tab === 'invitations'
                          ? `Mời bởi ${item.actorName ?? item.actorId} ·`
                          : 'Gửi lúc'}{' '}
                      {date(item.createdAt)}
                    </p>
                    {item.reason && (
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted">
                        {item.reason}
                      </p>
                    )}
                    {item.expiresAt && (
                      <p className="mt-1 text-xs text-muted">
                        Hết hạn: {date(item.expiresAt)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-3">
                  {tab === 'members' ? (
                    <>
                      {item.userId !== userId && (
                        <ChatLink
                          destination={{ kind: 'user', id: item.userId }}
                          aria-label={`Nhắn tin cho ${item.name}`}
                          className="!min-h-9 !px-3 !py-1.5"
                        >
                          Nhắn tin
                        </ChatLink>
                      )}
                      {owner && item.role !== 'Owner' && item.role !== 'Customer' ? (
                        <label className="text-xs text-muted">
                          Vai trò
                          <select
                            aria-label={`Vai trò của ${item.name}`}
                            disabled={pending}
                            value={item.role}
                            onChange={(event) => {
                              const role = event.target.value as
                                | 'Member'
                                | 'Manager';
                              setConfirmation({ title: 'Thay đổi vai trò', description: role === 'Manager' ? 'Chỉ định Manager mới sẽ đưa Manager hiện tại về Member. Tiếp tục?' : 'Đổi thành viên này về vai trò Member?', run: () => { void action(() => setProjectMemberRole(userId, project.id, item.userId, role), 'Đã cập nhật vai trò.'); } });
                            }}
                            className="ml-2 rounded-lg border border-line bg-field p-2 text-sm text-ink"
                          >
                            <option value="Manager">Quản lý</option>
                            <option value="Member">Thành viên</option>
                          </select>
                        </label>
                      ) : (
                        <RoleBadge role={item.role} label={roles[item.role]} className="rounded-full px-3" />
                      )}
                      {owner && item.role !== 'Owner' && item.role !== 'Customer' && (
                        <button
                          disabled={pending}
                          className="text-xs font-semibold text-red-500 disabled:opacity-50"
                          onClick={() => {
                            setConfirmation({ title: 'Xóa thành viên', description: `Xóa ${item.name} khỏi dự án? Thành viên sẽ mất quyền truy cập dự án.`, run: () => { void action(() => removeProjectMember(userId, project.id, item.userId), 'Đã xóa thành viên.'); } });
                          }}
                        >
                          Xóa khỏi dự án
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="rounded-full bg-tint px-3 py-1 text-xs text-ink">
                        {tab === 'requests' && item.status === 'PENDING'
                          ? 'Chờ duyệt'
                          : (statuses[item.status] ?? item.status)}
                      </span>
                      {editable &&
                        item.status === 'PENDING' &&
                        (tab === 'invitations' ? (
                          item.actorId === userId && (
                            <button
                              disabled={pending}
                              className="text-xs font-semibold text-red-500 disabled:opacity-50"
                              onClick={() =>
                                void action(
                                  () =>
                                    cancelProjectInvitation(
                                      userId,
                                      project.id,
                                      item.id,
                                    ),
                                  'Đã thu hồi lời mời.',
                                )
                              }
                            >
                              Thu hồi
                            </button>
                          )
                        ) : (
                          <>
                            <button
                              disabled={pending}
                              className="rounded-lg border border-line px-3 py-2 text-xs disabled:opacity-50"
                              onClick={() =>
                                void action(
                                  () =>
                                    decideProjectRequest(
                                      userId,
                                      project.id,
                                      item.id,
                                      false,
                                    ),
                                  'Đã từ chối yêu cầu.',
                                )
                              }
                            >
                              Từ chối
                            </button>
                            <button
                              disabled={pending}
                              className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-on-accent disabled:opacity-50"
                              onClick={() =>
                                void action(
                                  () =>
                                    decideProjectRequest(
                                      userId,
                                      project.id,
                                      item.id,
                                      true,
                                    ),
                                  'Đã thêm thành viên vào dự án.',
                                )
                              }
                            >
                              Chấp nhận
                            </button>
                          </>
                        ))}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end py-2">              <select
                aria-label="Số kết quả mỗi trang"
                value={size}
                onChange={(event) => {
                  setSize(Number(event.target.value));
                  setPage(0);
                }}
                className="rounded-lg border border-line bg-surface p-2 text-ink"
              >
                {[10, 20, 50].map((value) => (
                  <option key={value} value={value}>
                    {value} / trang
                  </option>
                ))}
              </select></div>
          <Pagination page={page} size={size} total={data.total} disabled={pending} onChange={setPage} />
        </>
      )}
      {editable && (
        <>
          <InviteMemberModal
            open={inviteOpen}
            onClose={() => setInviteOpen(false)}
            onInvite={async (email) => {
              await inviteProjectMember(userId, project.id, email);
              setFeedback(
                'Đã tạo lời mời. Email đang được xử lý trong hàng đợi.',
              );
              await reload();
            }}
          />
          <ShareProjectModal
            key={shareOpen ? 'open' : 'closed'}
            open={shareOpen}
            userId={userId}
            projectId={project.id}
            projectName={project.name}
            onClose={() => setShareOpen(false)}
          />
        </>
      )}
    </section>
  );
}

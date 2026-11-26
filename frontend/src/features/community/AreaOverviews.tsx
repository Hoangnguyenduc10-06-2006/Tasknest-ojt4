import { useEffect, useState } from 'react';
import { Icon } from '../../shared/ui/Icon';
import { Button } from '../../shared/ui/Button';
import { getCompletionPercentage } from '../dashboard/model/progress';
import { PageHeader } from '../../shared/ui/PageHeader';
import { panelClass, useCommunityResource } from './community.api';

type Team = { id: number; name: string; accepting_work: boolean; active_projects: number; overdue: number; pending_proposals: number; accepted: number; on_time: number };
type Workload = { team_id: number; user_id: string; display_name: string; open_tasks: number };

type Attention = {
  team_id: number;
  team_name: string;
  kind: 'KICKOFF' | 'REWORK' | 'APPLICATION';
  item_id: number;
  target_id: number;
  title: string;
};

type TeamOverviewData = { teams: Team[]; workload: Workload[]; attention: Attention[] };

const attentionLabels: Record<Attention['kind'], string> = {
  KICKOFF: 'Chờ bố trí nhân sự và khởi động',
  REWORK: 'Khách hàng yêu cầu chỉnh sửa',
  APPLICATION: 'Có hồ sơ ứng tuyển cần duyệt',
};

function attentionLink(item: Attention) {
  if (item.kind === 'KICKOFF') return `/projects/${item.target_id}?tab=overview`;
  if (item.kind === 'REWORK') return `/projects/${item.target_id}?tab=milestones&milestone=${item.item_id}`;
  return `/team-management/${item.team_id}?opening=${item.target_id}&application=${item.item_id}`;
}


export function TeamOverview() {
  const [selected, setSelected] = useState('');
  const resource = useCommunityResource<TeamOverviewData>('community/overview/teams');
  const selectedAttention = useCommunityResource<TeamOverviewData>(selected ? 'community/overview/teams?teamId=' + selected : null);
  if (resource.error) return <div role="alert">{resource.error} <Button kind="ghost" onClick={() => void resource.reload()}>Thử lại</Button></div>;
  if (!resource.data) return <p role="status">Đang tải số liệu đội…</p>;
  if (!resource.data.teams.length) return null;
  const teams = resource.data.teams.filter(team => !selected || String(team.id) === selected);
  const total = (key: 'active_projects' | 'overdue' | 'pending_proposals' | 'accepted' | 'on_time') =>
    teams.reduce((sum, team) => sum + team[key], 0);
  const accepted = total('accepted');
  const workload = resource.data.workload.filter(item => !selected || String(item.team_id) === selected);
  const largestWorkload = Math.max(1, ...workload.map(item => item.open_tasks));
  const attention = (selected ? selectedAttention.data : resource.data)?.attention;
  return (
    <section className={panelClass + ' space-y-4'}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Hiệu suất đội tôi quản lý</h2>
        <label className="flex items-center gap-2 text-sm">
          Phạm vi
          <select className="max-w-44 rounded-xl border border-line bg-field p-2" value={selected} onChange={e => setSelected(e.target.value)}>
            <option value="">Tất cả đội</option>
            {resource.data.teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ['Dự án đang thực hiện', total('active_projects')],
          ['Mốc quá hạn', total('overdue')],
          ['Đề xuất đang chờ khách', total('pending_proposals')],
          ['Mốc nghiệm thu đúng hạn', accepted ? `${total('on_time')}/${accepted} (${Math.round(100 * total('on_time') / accepted)}%)` : 'Chưa có'],
        ].map(([label, value]) => <div key={label} className="rounded-xl bg-panel p-3"><p className="text-xs text-muted">{label}</p><strong className="text-lg">{value}</strong></div>)}
      </div>
      {selected && <a href={'/team-management/' + selected} className="inline-block text-sm font-semibold text-accent">Xem thành viên và dự án của đội →</a>}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Cần đội xử lý</h3>
        {selected && selectedAttention.error ? (
          <p role="alert" className="text-sm text-danger">{selectedAttention.error} <Button kind="ghost" onClick={() => void selectedAttention.reload()}>Thử lại</Button></p>
        ) : !attention ? (
          <p role="status" className="text-sm text-muted">Đang tải việc cần xử lý…</p>
        ) : attention.length === 0 ? (
          <p className="text-sm text-muted">Chưa có dự án chờ khởi động, yêu cầu chỉnh sửa hoặc hồ sơ cần duyệt.</p>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2">
            {attention.map(item => (
              <li key={item.kind + item.item_id}>
                <a href={attentionLink(item)} className="block h-full rounded-xl border border-line p-3 hover:border-accent hover:text-accent">
                  <strong className="block break-words text-sm">{item.title}</strong>
                  <span className="block text-xs text-muted">{item.team_name} · {attentionLabels[item.kind]}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
      <details open>
        <summary className="cursor-pointer text-sm font-semibold">Tải công việc theo thành viên</summary>
        <ul className="mt-2 divide-y divide-line">
          {workload.map(item => (
            <li className="space-y-1.5 py-2 text-sm" key={item.team_id + '/' + item.user_id}>
              <div className="flex justify-between gap-3">
                <a href={'/team-management/' + item.team_id + '#team-roster'} className="break-words text-accent">{item.display_name} · {teams.find(team => team.id === item.team_id)?.name}</a>
                <span className="shrink-0 tabular-nums">{item.open_tasks} việc mở</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-field" aria-hidden="true">
                <div className="h-full rounded-full bg-accent" style={{ width: `${100 * item.open_tasks / largestWorkload}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

type CustomerOverviewData = {
  requests: {id:number; title:string; proposal_count:number}[];
  milestones: {id:number; project_id:number; title:string; project_name:string; status:string}[];
  projects: {id:number; name:string; team_name:string; milestones:number; accepted:number; status:'ACTIVE' | 'COMPLETED'; kickoff_pending:boolean}[];
  discussions: {request_id:number; title:string; proposal_id:number; team_name:string; unread:number}[];
};

const customerSteps = [
  { title: 'Đăng yêu cầu', description: 'Mô tả sản phẩm, thời gian và ngân sách dự kiến để các đội hiểu bạn cần gì.', icon: 'list' },
  { id: 'customer-proposals', title: 'Chọn đội phù hợp', description: 'Xem hồ sơ đội, trao đổi và so sánh đề xuất trước khi chọn.', icon: 'users' },
  { id: 'customer-projects', title: 'Theo dõi và nghiệm thu', description: 'Xem tiến độ, phản hồi và xác nhận từng mốc bàn giao ngay trên TaskNest.', icon: 'check' },
] as const;

function CustomerWelcome() {
  return (
    <section className="mx-auto max-w-5xl space-y-5">
      <div className="rounded-3xl border border-line bg-gradient-to-br from-tint via-surface to-surface p-6 shadow-panel sm:p-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Chào mừng bạn đến với TaskNest</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-muted sm:text-base">
          Tìm đội phát triển cho dự án đầu tiên và theo dõi tiến độ từ lúc nhận đề xuất đến khi nghiệm thu.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a href="/requests?view=mine&compose=1" className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-on-accent hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-accent">
            <Icon name="plus" size={17} /> Đăng yêu cầu đầu tiên
          </a>
          <a href="/teams" className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-sm font-semibold hover:text-accent focus-visible:outline-2 focus-visible:outline-accent">
            <Icon name="users" size={17} /> Tìm đội phát triển
          </a>
        </div>
      </div>
      <section aria-labelledby="customer-start-heading">
        <h2 id="customer-start-heading" className="mb-3 text-lg font-semibold">Bắt đầu dự án của bạn</h2>
        <ol className="grid gap-3 sm:grid-cols-3">
          {customerSteps.map(step => (
            <li key={step.title} id={'id' in step ? step.id : undefined} className="scroll-mt-24 rounded-2xl border border-line bg-surface p-4 sm:p-5">
              <span className="mb-3 grid size-9 place-items-center rounded-xl bg-tint text-accent"><Icon name={step.icon} size={18} /></span>
              <h3 className="text-sm font-semibold">{step.title}</h3>
              <p className="mt-1 text-sm leading-6 text-muted">{step.description}</p>
            </li>
          ))}
        </ol>
      </section>
    </section>
  );
}

export function CustomerOverview() {
  const resource = useCommunityResource<CustomerOverviewData>('community/overview/customer');
  const requests = resource.data?.requests ?? [];
  const milestones = resource.data?.milestones ?? [];
  const projects = resource.data?.projects ?? [];
  const discussions = resource.data?.discussions ?? [];
  useEffect(() => {
    const section = window.location.hash.slice(1);
    if (resource.data && (section === 'customer-proposals' || section === 'customer-projects'))
      document.getElementById(section)?.scrollIntoView();
  }, [resource.data]);
  if (resource.data && !resource.error && !requests.length && !milestones.length && !projects.length && !discussions.length)
    return <CustomerWelcome />;
  return (
    <section className="mx-auto max-w-5xl space-y-5">
      <PageHeader title="Tổng quan khách hàng" description="Theo dõi đề xuất, các mốc cần xác nhận và dự án bạn đang thuê đội thực hiện." />
      <div className="flex flex-wrap gap-3">
        <a href="/requests?view=mine&compose=1" className="rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-on-accent">Đăng yêu cầu</a>
        <a href="/teams" className="rounded-xl border border-line bg-surface px-4 py-3 text-sm font-semibold">Tìm đội</a>
        <a href="/messages?area=discovery" className="rounded-xl border border-line bg-surface px-4 py-3 text-sm font-semibold">Tin nhắn từ các đội</a>
      </div>
      {resource.error ? <div role="alert">{resource.error} <Button kind="ghost" onClick={() => void resource.reload()}>Thử lại</Button></div> : !resource.data ? <p role="status">Đang tải hợp tác…</p> : <>
        <section id="customer-proposals" className={panelClass + ' scroll-mt-24 space-y-3'}>
          <h2 className="text-lg font-semibold">Cần bạn xử lý</h2>
          {milestones.length === 0 && discussions.length === 0 && !requests.some(item => item.proposal_count > 0) && <p className="text-sm text-muted">Chưa có đề xuất hoặc mốc bàn giao cần xử lý.</p>}
          {milestones.map(item => <a key={item.id} className="block rounded-xl bg-panel p-3 text-sm hover:text-accent" href={`/projects/${item.project_id}?tab=milestones&milestone=${item.id}`}>
            <strong>{item.title}</strong><span className="block text-muted">{item.project_name} · {item.status === 'DRAFT' ? 'Chờ xác nhận kế hoạch' : 'Chờ nghiệm thu'}</span>
          </a>)}
          {requests.filter(item => item.proposal_count > 0).map(item => <a key={item.id} href={'/requests/' + item.id} className="block rounded-xl bg-panel p-3 text-sm hover:text-accent"><strong>{item.title}</strong><span className="block text-muted">{item.proposal_count} đề xuất đang chờ</span></a>)}
          {discussions.map(item => <a key={item.proposal_id} className="block rounded-xl bg-panel p-3 text-sm hover:text-accent" href={`/requests/${item.request_id}?proposal=${item.proposal_id}&discussion=1`}>
            <strong>{item.title}</strong><span className="block text-muted">{item.team_name} · {item.unread} tin trao đổi chưa đọc</span>
          </a>)}
        </section>
        <section id="customer-projects" className={panelClass + ' scroll-mt-24 space-y-3'}>
          <h2 className="text-lg font-semibold">Dự án đang thuê</h2>
          {projects.length === 0 && <p className="text-sm text-muted">Chưa có dự án hợp tác.</p>}
          {projects.map(item => {
            const percent = getCompletionPercentage(item.accepted, item.milestones);
            const status = item.status === 'COMPLETED' ? 'Đã nghiệm thu dự án' : item.kickoff_pending ? 'Đang chờ đội khởi động' : 'Đang thực hiện';
            return (
              <a key={item.id} href={`/projects/${item.id}?tab=${item.status === 'COMPLETED' ? 'reputation' : item.milestones ? 'milestones' : 'overview'}`} className="block space-y-2 rounded-xl border border-line p-3 text-sm hover:border-accent hover:text-accent">
                <div className="flex flex-wrap justify-between gap-2">
                  <strong className="break-words">{item.name}</strong>
                  <span className="text-xs text-muted">{status}</span>
                </div>
                <span className="block text-xs text-muted">{item.team_name} · {percent === null ? 'Chưa có mốc bàn giao' : `${item.accepted}/${item.milestones} mốc đã nghiệm thu`}</span>
                {percent !== null && (
                  <div className="h-2 overflow-hidden rounded-full bg-field" aria-hidden="true">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
                  </div>
                )}
              </a>
            );
          })}
          <a href="/cooperations?area=discovery" className="text-sm font-semibold text-accent">Xem tất cả hợp tác →</a>
        </section>
      </>}
    </section>
  );
}

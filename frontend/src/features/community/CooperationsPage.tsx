import { useSyncExternalStore } from 'react';
import { PageHeader } from '../../shared/ui/PageHeader';
import { Tabs } from '../../shared/ui/Tabs';
import { Button } from '../../shared/ui/Button';
import {
  areaHref,
  navigateTo,
  subscribeToLocation,
} from '../../app/router/location';
import { useCommunityResource, panelClass } from './community.api';
import { Pagination } from './CommunityPagination';
import { proposalStatuses, requestStatuses } from './marketplace.api';
type Item = {
  id: number;
  title: string;
  status: string;
  project_id: number | null;
  request_id: number | null;
  proposal_id: number | null;
  team_name?: string;
  update_required?: boolean;
  kickoff_pending?: boolean;
  request_status?: string;
};
const views = {
  projects: 'Dự án hợp tác',
  requests: 'Tôi thuê đội',
  proposals: 'Đề xuất đội tôi',
};
export function CooperationsPage() {
  const search = useSyncExternalStore(
    subscribeToLocation,
    () => location.search,
  );
  const params = new URLSearchParams(search);
  const rawView = params.get('view') ?? 'projects';
  const view: keyof typeof views = Object.hasOwn(views, rawView)
    ? (rawView as keyof typeof views)
    : 'projects';
  const statuses =
    view === 'requests'
      ? requestStatuses
      : view === 'proposals'
        ? proposalStatuses
        : {
            ACTIVE: 'Đang thực hiện',
            COMPLETED: 'Đã nghiệm thu',
            PROPOSED: 'Chờ xác nhận',
          };
  const rawStatus = params.get('status') ?? 'ALL';
  const status = Object.hasOwn(statuses, rawStatus) ? rawStatus : 'ALL';
  const rawPage = params.get('page') ?? '0';
  const page =
    /^\d{1,5}$/.test(rawPage) && Number(rawPage) <= 10000 ? Number(rawPage) : 0;
  const resource = useCommunityResource<{ items: Item[]; total: number }>(
    `community/cooperations?view=${view}&status=${status}&page=${page}`,
  );
  function navigate(changes: {
    view?: keyof typeof views;
    status?: string;
    page?: number;
  }) {
    const url = new URL(location.href);
    url.searchParams.set('view', changes.view ?? view);
    url.searchParams.set('status', changes.status ?? status);
    url.searchParams.set('page', String(changes.page ?? 0));
    navigateTo(url.pathname + url.search);
  }
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {resource.refreshError && <p role="status" className="rounded-xl border border-line bg-panel p-3 text-sm text-muted">Chưa thể cập nhật dữ liệu mới. Nội dung đang hiển thị là lần tải thành công gần nhất. <button className="text-accent underline" onClick={() => void resource.reload()}>Thử lại</button></p>}
      <PageHeader
        title="Hợp tác của tôi"
        description="Theo dõi yêu cầu, đề xuất và dự án từ lúc kết nối đến nghiệm thu."
      />
      <div className="flex justify-end">
        <Button kind="ghost" onClick={() => void resource.reload()}>
          Tải dữ liệu mới
        </Button>
      </div>
      <Tabs
        value={view}
        onChange={(value) => navigate({ view: value, status: 'ALL' })}
        items={Object.entries(views).map(([value, label]) => ({
          value: value as keyof typeof views,
          label,
        }))}
      />
      <label className="block text-sm">
        Trạng thái
        <select
          className="ml-3 rounded-xl border border-line bg-surface px-3 py-2"
          value={status}
          onChange={(event) => {
            navigate({ status: event.target.value });
          }}
        >
          <option value="ALL">Tất cả</option>
          {Object.entries(statuses).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {resource.error ? (
        <div role="alert" className={panelClass}>
          {resource.error}
          <Button kind="ghost" onClick={() => void resource.reload()}>
            Thử lại
          </Button>
        </div>
      ) : !resource.data ? (
        <p role="status">Đang tải thông tin hợp tác…</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {resource.data.items.map((item) => (
              <article key={item.id} className={panelClass + ' space-y-3'}>
                <p className="text-xs text-muted">
                  {item.team_name ?? views[view]}
                </p>
                <h2 className="break-words text-lg font-semibold">
                  {item.title}
                </h2>
                <p className="text-sm text-accent">
                  {view === 'requests'
                    ? requestStatuses[item.status]
                    : view === 'proposals'
                      ? proposalStatuses[item.status]
                      : item.status === 'COMPLETED'
                        ? 'Đã nghiệm thu'
                        : item.status === 'PROPOSED'
                          ? 'Chờ xác nhận hợp tác'
                          : 'Đang hợp tác'}
                </p>
                {item.update_required && (
                  <p className="text-sm text-warning">
                    Khách hàng đã thay đổi yêu cầu. Cần gửi lại đề xuất theo
                    phạm vi mới.
                  </p>
                )}
                {item.kickoff_pending && (
                  <p className="text-sm text-warning">
                    Đang chờ chủ đội chọn nhân sự và khởi động dự án.
                  </p>
                )}
                <div className="flex flex-wrap gap-3">
                  {item.request_id && (
                    <a
                      className="text-sm font-semibold text-accent"
                      href={
                        '/requests/' +
                        item.request_id +
                        (view === 'proposals' && item.proposal_id
                          ? '?proposal=' + item.proposal_id + '&discussion=1'
                          : '')
                      }
                    >
                      {view === 'proposals'
                        ? 'Mở đề xuất & trao đổi'
                        : 'Xem yêu cầu'}
                    </a>
                  )}
                  {item.project_id && (
                    <a
                      className="text-sm font-semibold text-accent"
                      href={'/projects/' + item.project_id + '?tab=overview'}
                    >
                      Mở dự án trong Làm việc →
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
          {!resource.data.items.length && (
            <p className={panelClass + ' text-muted'}>
              Chưa có thông tin ở trạng thái này.{' '}
              <a
                className="text-accent"
                href={areaHref(view === 'requests' ? '/requests' : '/teams')}
              >
                Khám phá cơ hội hợp tác
              </a>
            </p>
          )}
          <Pagination
            page={page}
            total={resource.data.total}
            size={12}
            onChange={(value) => navigate({ page: value })}
          />
        </>
      )}
    </div>
  );
}

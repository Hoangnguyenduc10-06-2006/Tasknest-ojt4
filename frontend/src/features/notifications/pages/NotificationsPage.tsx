import { useState } from 'react';
import { BrowserPushSettings } from './BrowserPushSettings';
import { navigateTo } from '../../../app/router/location';
import { Button } from '../../../shared/ui/Button';
import { Icon, type IconName } from '../../../shared/ui/Icon';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { Pagination } from '../../../shared/ui/Pagination';
import type { NotificationItem } from '../api/inbox.api';
import type { useInbox } from '../hooks/useInbox';
import { notificationDestination } from '../model/notification-destination';

function iconCategory(item: NotificationItem) {
  const type = item.eventType ?? '';
  if (type.startsWith('discovery.')) return 'discovery';
  if (type === 'discovery.chat.message') return 'comment';
  if (/comment/.test(type)) return 'comment';
  if (/invitation|join|member/.test(type)) return 'invite';
  if (/warning|deadline|estimate|overdue|alert|due_soon/.test(type)) return 'warning';
  return 'task';
}
const icons: Record<string, IconName> = { comment: 'message', invite: 'users', warning: 'alert', task: 'check', discovery: 'users' };

export function NotificationsPage({ inbox, userId }: { inbox: ReturnType<typeof useInbox>; userId: string }) {
  const { unreadOnly, setUnreadOnly, category: filter, setCategory: setFilter } = inbox;
  const [pending, setPending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const normalizedSearch = searchQuery.trim().toLocaleLowerCase('vi');
  const items = (inbox.data?.items ?? []).filter(item =>
    !normalizedSearch ||
    `${item.title} ${item.body}`.toLocaleLowerCase('vi').includes(normalizedSearch)
  );

  async function open(item: NotificationItem) {
    if (pending) return;
    setPending(true);
    try {
      if (!item.readAt && !(await inbox.read(item.id))) return;
      const href = notificationDestination(item);
      if (href) navigateTo(href);
    } finally { setPending(false); }
  }

  return (
    <main className="notifications-page space-y-6">
      <PageHeader eyebrow="KHÔNG GIAN CÁ NHÂN" title="Thông báo"
        description="Cập nhật từ nhiệm vụ, dự án và yêu cầu tham gia."
        actions={<Button kind="secondary" loading={pending} disabled={!inbox.data?.unreadCount}
          onClick={async () => {
            setPending(true);
            try { await inbox.readAll(); } finally { setPending(false); }
          }}>Đánh dấu tất cả đã đọc</Button>} />
      <BrowserPushSettings key={userId} userId={userId} />
      <div className="notification-toolbar">
        <div className="segmented" role="group" aria-label="Trạng thái thông báo">
          <button type="button" className={!unreadOnly ? 'active' : ''} aria-pressed={!unreadOnly} onClick={() => setUnreadOnly(false)}>Tất cả <span>{inbox.data?.matchingTotal ?? inbox.data?.total ?? 0}</span></button>
          <button type="button" className={unreadOnly ? 'active' : ''} aria-pressed={unreadOnly} onClick={() => setUnreadOnly(true)}>Chưa đọc <span>{inbox.data?.matchingUnreadCount ?? inbox.data?.unreadCount ?? 0}</span></button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="button secondary">
            <Icon name="search" size={16} />
            <input
              type="search"
              aria-label="Tìm thông báo"
              placeholder="Tìm tiêu đề hoặc nội dung…"
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              className="w-44 bg-transparent text-xs text-ink outline-none sm:w-56"
            />
          </label>
          <label className="button secondary">
            <Icon name="filter" />
            <select aria-label="Loại thông báo" className="bg-surface text-ink outline-none" value={filter} onChange={event => setFilter(event.target.value)}>
              <option value="all">Loại thông báo</option><option value="task">Nhiệm vụ</option><option value="discovery">Khám phá</option>
              <option value="comment">Bình luận</option><option value="invite">Lời mời & thành viên</option><option value="warning">Cảnh báo</option>
            </select>
          </label>
        </div>
      </div>
      {inbox.error && <p role="alert" className="rounded-xl bg-danger-soft p-4 text-sm text-danger">{inbox.error} <button type="button" className="ml-3 underline" onClick={() => void inbox.refresh()}>Thử lại</button></p>}
      <section className="panel notification-list" aria-label="Danh sách thông báo">
        {!inbox.data && !inbox.error && <p role="status" className="p-10 text-center text-muted">Đang tải thông báo…</p>}
        {items.map(item => (
          <button type="button" key={item.id} disabled={pending} onClick={() => void open(item)} className={`notification-row ${!item.readAt ? 'unread' : ''}`}>
            <span className={`notification-symbol ${iconCategory(item)}`}><Icon name={icons[iconCategory(item)]} /></span>
            <span className="notification-copy">
              <strong>{item.title} {!item.readAt && <i aria-label="Chưa đọc" />}</strong>
              <p>{item.body}</p>
              <time className="block text-[10px] text-muted" dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</time>
            </span>
            <Icon name="chevron" size={16} />
          </button>
        ))}
        {inbox.data && !items.length && <p className="p-10 text-center text-sm text-muted">{unreadOnly || filter !== 'all' ? 'Không có thông báo phù hợp trên trang này.' : 'Bạn chưa có thông báo nào.'}</p>}
        <div className="notification-policy"><Icon name="alert" /><p>Trạng thái đã đọc trong ứng dụng không thay đổi trạng thái email.</p></div>
        {inbox.data && <Pagination page={inbox.page} total={inbox.data.total} size={inbox.size} onChange={inbox.setPage} />}
      </section>
    </main>
  );
}

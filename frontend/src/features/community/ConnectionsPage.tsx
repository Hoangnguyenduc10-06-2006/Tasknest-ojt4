import { useState, type ReactNode } from 'react';
import { Button } from '../../shared/ui/Button';
import { EmptyState } from '../../shared/ui/EmptyState';
import { PageHeader } from '../../shared/ui/PageHeader';
import { TextField } from '../../shared/ui/TextField';
import { ChatLink } from '../messaging/ChatLink';
import { UserAvatar } from '../profile/components/UserAvatar';
import { communityRequest, errorMessage, panelClass, useCommunityResource } from './community.api';

export type ConnectionState = 'NONE' | 'INCOMING' | 'OUTGOING' | 'ACCEPTED' | 'UNAVAILABLE';
type Action = 'REQUEST' | 'ACCEPT' | 'DECLINE' | 'CANCEL' | 'REMOVE';
type Connection = { userId: string; name: string; state: ConnectionState };

export function ConnectionActions({ userId, onChanged, inChat = false, chatState, whenFriends }: {
  userId: string;
  onChanged?: () => void | Promise<void>;
  chatState?: ConnectionState;
  whenFriends?: ReactNode;
  inChat?: boolean;
}) {
  const resource = useCommunityResource<ConnectionState>(chatState === undefined ? 'community/connections/' + userId : null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function change(action: Action) {
    if (pending || !resource.user) return;
    setPending(true);
    setError('');
    try {
      await communityRequest('community/connections/' + userId, resource.user, { action }, 'PUT');
      if (chatState === undefined) await resource.reload();
      await onChanged?.();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setPending(false);
    }
  }
  const state = chatState ?? resource.data;
  if (resource.error) return <Button kind="ghost" onClick={() => void resource.reload()}>Tải lại trạng thái kết bạn</Button>;
  if (!state || state === 'UNAVAILABLE' || (inChat && state === 'ACCEPTED')) return null;
  return (
    <div className={inChat ? 'flex shrink-0 flex-wrap items-center gap-2 border-t border-line bg-panel/40 px-3 py-2 sm:px-4' : 'flex flex-wrap items-center gap-2'}>
      {inChat && <p className="min-w-0 flex-1 text-xs font-medium text-muted">
        {state === 'OUTGOING' ? 'Đã gửi lời mời kết bạn.' : state === 'INCOMING'
          ? 'Người này đã gửi bạn lời mời kết bạn.' : 'Hãy kết bạn để kết nối và trò chuyện dễ dàng hơn.'}
      </p>}
      {state === 'NONE' && <Button size={inChat ? 'sm' : undefined} icon="plus" loading={pending} onClick={() => void change('REQUEST')}>Kết bạn</Button>}
      {state === 'INCOMING' && <>
        <Button size={inChat ? 'sm' : undefined} loading={pending} onClick={() => void change('ACCEPT')}>Chấp nhận kết bạn</Button>
        <Button size={inChat ? 'sm' : undefined} kind="secondary" disabled={pending} onClick={() => void change('DECLINE')}>Từ chối</Button>
      </>}
      {state === 'OUTGOING' && <Button size={inChat ? 'sm' : undefined} kind="secondary" loading={pending} onClick={() => void change('CANCEL')}>Hủy lời mời đã gửi</Button>}
      {state === 'ACCEPTED' && whenFriends}
      {state === 'ACCEPTED' && <details>
        <summary className="cursor-pointer rounded-xl bg-success-soft px-3 py-2 text-sm font-semibold text-success">Đã kết bạn</summary>
        <Button kind="ghost" loading={pending} onClick={() => void change('REMOVE')}>Hủy kết bạn</Button>
      </details>}
      {error && <p role="alert" className="basis-full text-sm text-danger">{error}</p>}
    </div>
  );
}

const labels: Partial<Record<ConnectionState, string>> = {
  INCOMING: 'Lời mời đến',
  OUTGOING: 'Đã gửi lời mời',
  ACCEPTED: 'Bạn bè',
};

export function ConnectionsPage() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const resource = useCommunityResource<{ items: Connection[]; hasMore: boolean }>('community/connections?page=' + page);
  const people = useCommunityResource<{ id: string; fullName: string }[]>(query.length >= 2 ? 'community/chat/people?' + new URLSearchParams({search: query}) : null);
  return (
    <section className="mx-auto max-w-4xl space-y-5">
      <PageHeader title="Kết nối" description="Tìm người dùng TaskNest, quản lý lời mời và nhắn tin với bạn bè." />
      <form className={panelClass + ' flex flex-wrap items-end gap-3'} onSubmit={(event) => { event.preventDefault(); setQuery(search.trim().length >= 2 ? search.trim() : ''); }}>
        <div className="min-w-0 flex-1">
          <TextField label="Tìm người dùng" placeholder="Tên hoặc email đầy đủ" minLength={2} maxLength={100} required value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <Button type="submit" icon="search">Tìm</Button>
        {query && <Button kind="ghost" onClick={() => { setSearch(''); setQuery(''); }}>Xóa tìm kiếm</Button>}
      </form>
      {query && <div className={panelClass + ' space-y-3'}>
        <h2 className="font-semibold">Kết quả tìm kiếm</h2>
        {people.error ? <p role="alert" className="text-danger">{people.error}</p> : !people.data ? <p role="status">Đang tìm…</p> : !people.data.length ? <p className="text-muted">Không tìm thấy tài khoản phù hợp.</p> : people.data.map((person) =>
          <a key={person.id} href={'/members/' + person.id} className="flex items-center gap-3 rounded-xl p-2 font-semibold hover:bg-panel">
            <UserAvatar userId={person.id} name={person.fullName} publicProfile />{person.fullName}
          </a>
        )}
      </div>}
      {resource.error ? (
        <div className={panelClass} role="alert">
          <p>{resource.error}</p><Button kind="ghost" onClick={() => void resource.reload()}>Thử lại</Button>
        </div>
      ) : !resource.data ? (
        <p role="status">Đang tải kết nối…</p>
      ) : resource.data.items.length === 0 ? (
        <EmptyState title="Chưa có kết nối" description="Tìm người dùng hoặc mở hồ sơ từ cuộc trò chuyện để gửi lời mời kết bạn." />
      ) : (
        <ul className="space-y-3">
          {resource.data.items.map((item) => (
            <li key={item.userId} className={panelClass + ' flex flex-wrap items-center justify-between gap-3'}>
              <a href={'/members/' + item.userId} className="flex min-w-0 items-center gap-3 hover:text-accent">
                <UserAvatar userId={item.userId} name={item.name} publicProfile />
                <div className="min-w-0"><p className="break-words font-semibold">{item.name}</p><p className="text-xs text-muted">{labels[item.state]}</p></div>
              </a>
              <div className="flex flex-wrap items-center gap-2">
                <ConnectionActions userId={item.userId} onChanged={() => void resource.reload()} />
                {item.state === 'ACCEPTED' && <ChatLink destination={{ kind: 'user', id: item.userId }}>Nhắn tin</ChatLink>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {(page > 0 || resource.data?.hasMore) && <div className="flex gap-2">
        <Button kind="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Trước</Button>
        <Button kind="secondary" disabled={!resource.data?.hasMore} onClick={() => setPage(page + 1)}>Sau</Button>
      </div>}
    </section>
  );
}

import { PostMedia } from './PostMedia';
import { useState } from 'react';
import { navigateTo } from '../../app/router/location';
import { Button } from '../../shared/ui/Button';
import { EmptyState } from '../../shared/ui/EmptyState';
import { PageHeader } from '../../shared/ui/PageHeader';
import { TextField } from '../../shared/ui/TextField';
import { Pagination } from './CommunityPagination';
import { communityRequest, dateLabel, errorMessage, panelClass, useCommunityResource } from './community.api';
import { useSession } from '../auth';
import { splitSkills } from './skill-matching';

type Post = {
  kind: 'REQUEST' | 'OPENING';
  id: number;
  team_id: number | null;
  title: string;
  description: string;
  author: string;
  skills: string;
  published_at: string;
  reference_url?: string | null;
  image_count?: number;
};

function feedLink(params: URLSearchParams, changes: Record<string, string>) {
  const next = new URLSearchParams(params);
  for (const [key, value] of Object.entries(changes)) {
    if (value) next.set(key, value);
    else next.delete(key);
  }
  return '/discovery' + (next.size ? '?' + next.toString() : '');
}

export function DiscoveryFeed() {
  const session = useSession();
  const customerOnly = session.status === 'authenticated' && session.user.accountPurpose === 'CLIENT';
  const params = new URLSearchParams(location.search);
  if (customerOnly && params.has('kind')) {
    if (params.get('kind') !== 'REQUEST') params.delete('page');
    params.delete('kind');
  }
  const skill = (params.get('skill') ?? '').slice(0, 300);
  const query = (params.get('search') ?? '').slice(0, 100);
  const requestedKind = params.get('kind');
  const kind = customerOnly ? 'REQUEST' : requestedKind === 'REQUEST' || requestedKind === 'OPENING' ? requestedKind : 'ALL';
  const page = Math.max(0, Math.min(10000, Math.trunc(Number(params.get('page')) || 0)));
  const [search, setSearch] = useState(query);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const user = session.status === 'authenticated' ? session.user.id : undefined;
  const savedOnly = params.get('view') === 'saved' && Boolean(user);
  const preferences = useCommunityResource<{ saved: string[]; skills: string[] }>(user ? 'community/feed/preferences' : null);
  const following = preferences.data?.skills.includes(skill.trim().toLowerCase()) ?? false;
  const resource = useCommunityResource<{ items: Post[]; total: number }>(
    session.status === 'checking' ? null : (savedOnly ? 'community/feed/saved?' : 'community/feed?') + new URLSearchParams({ skill, search: query, kind, page: String(page) }),
  );
  async function updatePreference(path: string, body: unknown) {
    if (!user || saving) return;
    setSaving(true);
    setSaveError('');
    try {
      await communityRequest('community/feed/' + path, user, body, 'PUT');
      await preferences.reload();
      if (savedOnly) await resource.reload();
    } catch (error) {
      setSaveError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  const createPath = '/requests?view=mine&compose=1';

  return (
    <section className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        title="Bảng tin Khám phá"
        description={customerOnly
          ? 'Đăng yêu cầu dự án và tìm đội phát triển theo kỹ năng bạn cần.'
          : 'Tìm đội thực hiện dự án hoặc tìm vị trí để tham gia một đội phát triển.'}
      />
      <div className={customerOnly ? 'flex' : 'grid gap-2 sm:grid-cols-2'}>
        <a href={resource.user ? createPath : '/login?returnTo=' + encodeURIComponent(createPath)} className="rounded-xl bg-accent px-4 py-3 text-center text-sm font-semibold text-on-accent hover:bg-accent-hover">
          Đăng yêu cầu tìm đội
        </a>
        {!customerOnly && <a href="/team-management" className="rounded-xl border border-line bg-surface px-4 py-3 text-center text-sm font-semibold hover:bg-panel">
          Tuyển thành viên cho đội
        </a>}
      </div>
      {user && <nav className="flex flex-wrap items-center gap-2" aria-label="Bảng tin của bạn">
        <a href={feedLink(params, { view: '', page: '' })} className="button secondary" aria-current={!savedOnly ? 'page' : undefined}>Tất cả bài</a>
        <a href={feedLink(params, { view: 'saved', page: '' })} className="button secondary" aria-current={savedOnly ? 'page' : undefined}>Bài đã lưu</a>
        {preferences.data?.skills.map(tag => (
          <a key={tag} href={feedLink(params, { skill: tag, view: '', search: '', page: '' })} className="max-w-full break-words rounded-lg bg-panel px-2 py-1 text-xs font-semibold text-accent">#{tag}</a>
        ))}
      </nav>}
      {(saveError || preferences.error) && <p role="alert" className="text-sm text-danger">{saveError || preferences.error}</p>}
      <div className={panelClass + ' space-y-4'}>
        <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => {
          event.preventDefault();
          navigateTo(feedLink(params, search.trim().startsWith('#')
            ? { skill: search.trim().slice(1).trim(), search: '', page: '' }
            : { search: search.trim(), skill: '', page: '' }));
        }}>
          <div className="min-w-0 flex-1">
            <TextField label="Tìm trên bảng tin" placeholder={customerOnly ? 'Tên dự án hoặc #React' : 'Tên dự án, đội hoặc #React'} maxLength={100} value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <Button type="submit" icon="search">{skill ? 'Tìm mọi hashtag' : 'Tìm'}</Button>
          {skill && <Button type="button" kind="secondary" onClick={() =>
            navigateTo(feedLink(params, { search: search.trim(), page: '' }))}>
            Tìm trong #{skill}
          </Button>}
        </form>
        {!customerOnly && <nav aria-label="Loại bài đăng" className="flex flex-wrap gap-2">
          {[['ALL', 'Tất cả'], ['REQUEST', 'Tìm đội thực hiện'], ['OPENING', 'Tuyển thành viên']].map(([value, label]) => (
            <a key={value} aria-current={kind === value ? 'page' : undefined} href={feedLink(params, { kind: value === 'ALL' ? '' : value, page: '' })} className={'rounded-lg border px-3 py-2 text-xs font-semibold ' + (kind === value ? 'border-accent bg-tint text-accent' : 'border-line hover:bg-panel')}>{label}</a>
          ))}
        </nav>}
        {skill && (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <a href={feedLink(params, { skill: '', page: '' })} aria-label={'Bỏ lọc ' + skill} className="max-w-full break-words rounded-lg bg-tint px-3 py-1 font-semibold text-accent">#{skill} ×</a>
            {preferences.data && skill.length <= 100 && <Button kind="secondary" aria-pressed={following} disabled={saving}
              onClick={() => void updatePreference('skills', { skill, selected: !following })}>
              {following ? 'Bỏ theo dõi hashtag' : 'Theo dõi hashtag'}
            </Button>}
            <a className="font-semibold text-accent hover:underline" href={'/teams?' + new URLSearchParams({ skill })}>Tìm đội có kỹ năng này →</a>
          </div>
        )}
      </div>
      {resource.error ? (
        <div className={panelClass} role="alert">
          <p className="mb-3 text-danger">{resource.error}</p>
          <Button onClick={() => void resource.reload()}>Thử lại</Button>
        </div>
      ) : !resource.data ? (
        <p role="status" className="text-muted">Đang tải bảng tin…</p>
      ) : resource.data.items.length === 0 ? (
        <EmptyState
          title={savedOnly ? 'Chưa có bài đã lưu phù hợp' : 'Chưa có bài đăng phù hợp'}
          description="Thử bỏ bộ lọc hoặc tìm bằng một kỹ năng khác."
          action={<a href="/discovery" className="font-semibold text-accent hover:underline">Xem tất cả bài đăng</a>}
        />
      ) : (
        <div className="space-y-3">
          {resource.data.items.map((post) => {
            const opening = post.kind === 'OPENING';
            const saved = preferences.data?.saved.includes(post.kind + post.id) ?? false;
            const destination = opening ? `/teams/${post.team_id}?opening=${post.id}` : `/requests/${post.id}`;
            return (
              <article key={post.kind + post.id} className={panelClass + ' min-w-0 space-y-3'}>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span className="rounded-full bg-tint px-2.5 py-1 font-semibold text-accent">{opening ? 'Tuyển thành viên' : 'Tìm đội thực hiện'}</span>
                  <span className="break-words font-semibold text-ink">{post.author}</span>
                  <span>· {dateLabel(post.published_at)}</span>
                </div>
                <h2 className="break-words text-lg font-semibold"><a className="hover:text-accent" href={destination}>{post.title}</a></h2>
                <p className="line-clamp-3 whitespace-pre-line break-words text-sm leading-6 text-muted">{post.description}</p>
                <PostMedia kind={post.kind} id={post.id} imageCount={post.image_count} reference={post.reference_url} />
                <div className="flex flex-wrap gap-2">
                  {splitSkills(post.skills).map((tag) => (
                    <a key={tag} href={feedLink(params, { skill: tag, page: '' })} className="max-w-full break-words rounded-lg bg-panel px-2 py-1 text-xs font-medium text-accent hover:bg-tint">#{tag}</a>
                  ))}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <a href={destination} className="inline-flex min-h-10 items-center font-semibold text-accent hover:underline">
                    {opening ? 'Xem vị trí và ứng tuyển →' : customerOnly ? 'Xem chi tiết yêu cầu →' : 'Xem yêu cầu và gửi đề xuất →'}
                  </a>
                  {preferences.data && <Button kind="secondary" disabled={saving} aria-pressed={saved}
                    onClick={() => void updatePreference(`saved/${post.kind}/${post.id}`, { selected: !saved })}>
                    {saved ? 'Bỏ lưu' : 'Lưu bài'}
                  </Button>}
                </div>
              </article>
            );
          })}
          <Pagination page={page} total={resource.data.total} size={12} onChange={(next) => navigateTo(feedLink(params, { page: String(next) }))} />
        </div>
      )}
    </section>
  );
}

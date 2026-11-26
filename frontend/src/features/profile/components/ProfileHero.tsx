import { useEffect, useState, type ReactNode } from 'react';
import { authenticatedAccessToken } from '../../auth';
import { ApiError, requestBlob, requestJson } from '../../../shared/api/client';
import { Button } from '../../../shared/ui/Button';
import { Icon } from '../../../shared/ui/Icon';
import { Modal } from '../../../shared/ui/Modal';
import { UserAvatar } from './UserAvatar';

const coverPath = '/api/identity/profile/cover';

async function encodeCover(file: File) {
  if (file.size > 5 * 1024 * 1024 || !['image/png', 'image/jpeg'].includes(file.type))
    throw new Error('Chọn ảnh PNG hoặc JPG tối đa 5 MB.');
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error('Không đọc được ảnh đã chọn.'));
    reader.readAsDataURL(file);
  });
}

export function ProfileHero({ userId, name, headline, bio, subtitle, own = false, projectId, onEditAvatar, avatarRevision, coverAction, children }: {
  userId: string;
  name: string;
  headline?: string;
  bio?: string;
  subtitle?: ReactNode;
  projectId?: string;
  avatarRevision?: number;
  onEditAvatar?: () => void;
  own?: boolean;
  coverAction?: ReactNode;
  children?: ReactNode;
}) {
  const [cover, setCover] = useState<{ key: string; url: string }>();
  const [loadingError, setLoadingError] = useState('');
  const [revision, refresh] = useState(0);
  const [photo, setPhoto] = useState<File>();
  const [visible, setVisible] = useState(false);
  const [editingCover, setEditingCover] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const coverKey = `${userId}/${own}/${revision}`;
  useEffect(() => {
    let active = true;
    let url: string | undefined;
    void (async () => {
      try {
        const token = own ? await authenticatedAccessToken(userId) : undefined;
        const blob = await requestBlob(own ? coverPath : '/api/identity/public/covers/' + encodeURIComponent(userId), token);
        if (active) {
          url = URL.createObjectURL(blob);
          setCover({ key: coverKey, url });
          setLoadingError('');
        }
      } catch (error) {
        if (active) {
          setCover(undefined);
          setLoadingError(own && !(error instanceof ApiError && error.status === 404) ? 'Không tải được ảnh bìa.' : '');
        }
      }
    })();
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [own, userId, coverKey]);
  const coverUrl = cover?.key === coverKey ? cover.url : undefined;

  async function save(remove = false) {
    if (busy || (!remove && !photo)) return;
    setBusy(true);
    setMessage('');
    try {
      await requestJson(coverPath, {
        method: remove ? 'DELETE' : 'PUT',
        body: remove ? undefined : { imageBase64: await encodeCover(photo!), visible },
        accessToken: await authenticatedAccessToken(userId),
        csrf: true,
      });
      setPhoto(undefined);
      setEditingCover(false);
      refresh(previous => previous + 1);
      setMessage(remove ? 'Đã gỡ ảnh bìa.' : 'Đã lưu ảnh bìa.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không cập nhật được ảnh bìa.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="cover-hero-card relative isolate overflow-hidden rounded-3xl border border-line bg-surface shadow-panel">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-br from-tint via-panel to-accent/30">
        {coverUrl && <img src={coverUrl} alt="" className="size-full object-cover object-top" />}
      </div>
      <div aria-hidden="true" className="cover-hero-fade pointer-events-none absolute inset-0" />
      <div className="cover-hero-spacer relative">
        {coverAction && <div className="absolute right-3 top-3 z-10 sm:right-5 sm:top-5">{coverAction}</div>}
        {own && (
          <Button kind="secondary" size="sm" className="absolute bottom-3 right-3 z-10 !bg-surface shadow-sm"
            onClick={() => { setPhoto(undefined); setMessage(''); setEditingCover(true); }}>
            <Icon name="camera" size={16} /> Chỉnh sửa ảnh bìa
          </Button>
        )}
      </div>
      <div className="relative -mt-9 space-y-3 px-4 pb-5 sm:-mt-12 sm:px-6">
        <div className="relative w-fit">
          <UserAvatar key={avatarRevision} userId={userId} projectId={projectId} name={name} publicProfile={!own} connectedProfile={!own}
            className="!size-[4.5rem] border-4 border-surface !text-xl sm:!size-24" />
          {onEditAvatar && (
            <button type="button" aria-label="Chỉnh sửa ảnh đại diện" title="Chỉnh sửa ảnh đại diện"
              className="absolute bottom-0 right-0 grid size-8 place-items-center rounded-full border-2 border-surface bg-accent text-on-accent shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              onClick={onEditAvatar}>
              <Icon name="plus" size={17} />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-bold tracking-tight sm:text-3xl">{name}</h1>
            {headline && <p className="mt-2 flex gap-2 text-sm text-muted">
              <Icon name="briefcase" size={16} className="mt-0.5 shrink-0 text-accent" />
              <span className="min-w-0 break-words"><span className="font-semibold text-ink">Chuyên môn</span> · {headline}</span>
            </p>}
            {bio && <p className="mt-2 flex gap-2 text-sm text-muted">
              <Icon name="person" size={16} className="mt-0.5 shrink-0 text-accent" />
              <span className="min-w-0 whitespace-pre-wrap break-words"><span className="font-semibold text-ink">Giới thiệu bản thân</span> · {bio}</span>
            </p>}
            {subtitle && <div className="mt-1 break-words text-sm text-muted">{subtitle}</div>}
          </div>
          {children}
        </div>
        {own && (
          <Modal open={editingCover} onClose={() => { if (!busy) setEditingCover(false); }} title="Chỉnh sửa ảnh bìa">
            <div className="mt-2 flex flex-wrap items-center gap-3 rounded-xl border border-line p-3">
              <input key={revision} type="file" aria-label="Chọn ảnh bìa" accept="image/png,image/jpeg" disabled={busy}
                className="max-w-full text-xs" onChange={event => setPhoto(event.target.files?.[0])} />
              {photo && <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={visible} disabled={busy} onChange={event => setVisible(event.target.checked)} />
                Hiện trên trang cá nhân công khai
              </label>}
              <Button size="sm" disabled={!photo || busy} onClick={() => void save()}>Lưu ảnh bìa</Button>
              {coverUrl && <Button size="sm" kind="secondary" disabled={busy} onClick={() => void save(true)}>Gỡ ảnh bìa</Button>}
            </div>
            {message && <p role="alert" className="mt-2 text-sm text-danger">{message}</p>}
          </Modal>
        )}
        {!editingCover && (message || loadingError) && <p role="status" className="text-xs text-muted">{message || loadingError}</p>}
      </div>
    </section>
  );
}

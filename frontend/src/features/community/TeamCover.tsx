import { useEffect, useRef, useState, type ReactNode } from 'react';
import { requestBlob, requestForm, requestJson } from '../../shared/api/client';
import { Button } from '../../shared/ui/Button';
import { Icon } from '../../shared/ui/Icon';
import { Modal } from '../../shared/ui/Modal';
import { authenticatedAccessToken } from '../auth';
import { validateAvatar } from '../profile/model/profile.validation';
import { errorMessage } from './community.api';

export function CoverImage({ src, onAvailable, className = "" }: { src: string; onAvailable?: () => void; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img src={src} alt="" loading="lazy" className={`absolute inset-0 size-full object-cover ${className}`}
      onLoad={onAvailable} onError={() => setFailed(true)} />
  );
}

export function MemberCover({ userId, own }: { userId: string; own: boolean }) {
  const [privateUrl, setPrivateUrl] = useState<string>();
  useEffect(() => {
    if (!own) return;
    let active = true;
    let url: string | undefined;
    void authenticatedAccessToken(userId)
      .then(token => requestBlob('/api/identity/profile/cover', token))
      .then(blob => {
        if (!active) return;
        url = URL.createObjectURL(blob);
        setPrivateUrl(url);
      })
      .catch(() => {});
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [own, userId]);

  const src = own ? privateUrl : `/api/identity/public/covers/${encodeURIComponent(userId)}`;
  return src ? <CoverImage key={src} src={src} /> : null;
}

const coverWidth = 1600;
const coverHeight = 900;

export function TeamCover({ id, editor, coverAction }: { id: string; editor?: string; coverAction?: ReactNode }) {
  const [editing, setEditing] = useState(false);
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState('');
  const [zoom, setZoom] = useState(1);
  const [horizontal, setHorizontal] = useState(50);
  const [vertical, setVertical] = useState(50);
  const [source, setSource] = useState<{ url: string; image: HTMLImageElement }>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [revision, setRevision] = useState(0);
  const [hasCover, setHasCover] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const path = `/api/work/community/teams/${encodeURIComponent(id)}/cover`;
  const src = revision ? `${path}?revision=${revision}` : path;

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  useEffect(() => {
    if (!preview) return;
    const image = new Image();
    let active = true;
    image.src = preview;
    void image.decode().then(() => {
      if (active) setSource({ url: preview, image });
    }).catch(() => {
      if (active) setError('Không đọc được ảnh bìa. Vui lòng chọn ảnh khác.');
    });
    return () => { active = false; };
  }, [preview]);

  const image = source?.url === preview ? source?.image : undefined;
  useEffect(() => {
    const context = canvasRef.current?.getContext('2d');
    if (!image || !context) return;
    const scale = Math.max(coverWidth / image.naturalWidth, coverHeight / image.naturalHeight) * zoom;
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    context.fillStyle = '#fff';
    context.fillRect(0, 0, coverWidth, coverHeight);
    context.drawImage(image, (coverWidth - width) * horizontal / 100, (coverHeight - height) * vertical / 100, width, height);
  }, [image, zoom, horizontal, vertical]);

  function selectFile(next?: File) {
    setFile(next);
    const validSize = next && next.size > 0 && next.size <= 5 * 1024 * 1024;
    setPreview(validSize ? URL.createObjectURL(next) : '');
    setZoom(1);
    setHorizontal(50);
    setVertical(50);
    setError(next && !validSize ? 'Chọn ảnh PNG hoặc JPG tối đa 5 MB.' : '');
  }

  async function save(remove = false) {
    if (!editor || busy || (!remove && !file)) return;
    setBusy(true);
    setError('');
    try {
      const token = await authenticatedAccessToken(editor);
      if (remove) {
        await requestJson(path, { method: 'DELETE', csrf: true, accessToken: token });
      } else if (file) {
        const validation = await validateAvatar(file);
        if (validation) throw new Error(validation);
        const canvas = canvasRef.current;
        if (!canvas || !image) throw new Error('Ảnh chưa sẵn sàng. Vui lòng chọn lại ảnh.');
        const cropped = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(blob => {
            if (blob) resolve(blob);
            else reject(new Error('Không thể chuẩn bị ảnh bìa.'));
          }, 'image/jpeg', 0.92);
        });
        const body = new FormData();
        body.set('file', cropped, 'team-cover.jpg');
        await requestForm(path, body, token);
      }
      setHasCover(false);
      setRevision(previous => previous + 1);
      selectFile();
      setEditing(false);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-br from-tint via-panel to-accent/30">
        <CoverImage key={src} src={src} onAvailable={() => setHasCover(true)} className="object-top" />
      </div>
      <div aria-hidden="true" className="cover-hero-fade pointer-events-none absolute inset-0" />
      <div className="cover-hero-spacer relative">
      {coverAction && <div className="absolute right-3 top-3 z-10 sm:right-5 sm:top-5">{coverAction}</div>}
      {editor && (
        <>
          <Button kind="secondary" size="sm" className="absolute bottom-3 right-3 !bg-surface shadow-md"
            onClick={() => { selectFile(); setEditing(true); }}>
            <Icon name="camera" size={16} /> Chỉnh sửa ảnh bìa đội
          </Button>
          <Modal open={editing} onClose={() => { if (!busy) { selectFile(); setEditing(false); } }} title="Chỉnh ảnh bìa đội" maxWidth="lg"
            description="Ảnh xuất hiện trên hồ sơ công khai của đội. Chọn ảnh PNG hoặc JPG tối đa 5 MB.">
            <input type="file" accept="image/png,image/jpeg" aria-label="Chọn ảnh bìa đội" disabled={busy}
              className="max-w-full text-sm" onChange={event => selectFile(event.target.files?.[0])} />
            {image && (
              <div className="mt-4 space-y-3">
                <canvas ref={canvasRef} width={coverWidth} height={coverHeight} role="img" aria-label="Xem trước ảnh bìa đội"
                  className="block aspect-video w-full rounded-xl border border-line" />
                <label className="block text-sm font-medium">
                  Thu phóng · {Math.round(zoom * 100)}%
                  <input type="range" min="1" max="3" step=".05" value={zoom} disabled={busy}
                    className="mt-1 block w-full accent-accent" onChange={event => setZoom(event.target.valueAsNumber)} />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-medium">
                    Dịch ngang
                    <input type="range" min="0" max="100" value={horizontal} disabled={busy}
                      className="mt-1 block w-full accent-accent" onChange={event => setHorizontal(event.target.valueAsNumber)} />
                  </label>
                  <label className="block text-sm font-medium">
                    Dịch dọc
                    <input type="range" min="0" max="100" value={vertical} disabled={busy}
                      className="mt-1 block w-full accent-accent" onChange={event => setVertical(event.target.valueAsNumber)} />
                  </label>
                </div>
              </div>
            )}
            {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              {hasCover && <Button kind="secondary" disabled={busy} onClick={() => void save(true)}>Gỡ ảnh</Button>}
              <Button loading={busy} disabled={!image} onClick={() => void save()}>Lưu ảnh bìa</Button>
            </div>
          </Modal>
        </>
      )}
      </div>
    </>
  );
}

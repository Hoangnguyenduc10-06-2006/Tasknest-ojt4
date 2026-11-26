import { Icon } from '../../shared/ui/Icon';
import { useEffect, useState } from 'react';
import { authenticatedAccessToken } from '../auth';
import { requestBlob } from '../../shared/api/client';
import { Button } from '../../shared/ui/Button';

type Kind = 'REQUEST' | 'OPENING';
const maxImages = 4;

function imagePath(kind: Kind, post: number, position: number) {
  return `/api/work/community/post-images/${kind}/${post}/${position}`;
}

function readImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(new Error('Không đọc được ảnh đã chọn.'));
    reader.readAsDataURL(file);
  });
}

export function PostImagePicker({ value, onChange, existing }: {
  value: string[];
  onChange: (value: string[]) => void;
  existing?: { positions: number[]; id: number; privateUser?: string; remove: (position: number) => void };
}) {
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);
  const count = value.length + (existing?.positions.length ?? 0);
  async function add(files: File[]) {
    setError('');
    if (count + files.length > maxImages) {
      setError('Mỗi bài đăng được đính kèm tối đa 4 ảnh.');
      return;
    }
    if (files.some(file => !['image/png', 'image/jpeg'].includes(file.type) || file.size > 1024 * 1024)) {
      setError('Chọn ảnh PNG hoặc JPG tối đa 1 MB mỗi ảnh.');
      return;
    }
    setReading(true);
    try {
      onChange([...value, ...await Promise.all(files.map(readImage))]);
    } catch {
      setError('Không đọc được ảnh đã chọn.');
    } finally {
      setReading(false);
    }
  }
  return (
    <div className="space-y-2 rounded-xl border border-line p-3">
      <label className="block text-sm font-semibold">
        Ảnh đính kèm ({count}/{maxImages})
        <input type="file" multiple aria-label="Chọn ảnh đính kèm" accept="image/png,image/jpeg" disabled={reading || count === maxImages}
          className="mt-2 block max-w-full text-xs" onChange={event => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = '';
            if (files.length) void add(files);
          }} />
      </label>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {existing?.positions.map(position => (
          <div key={'existing-' + position}>
            <PostImage path={imagePath('REQUEST', existing.id, position)} position={position} privateUser={existing.privateUser} />
            <Button size="sm" kind="ghost" disabled={reading} onClick={() => existing.remove(position)}>Gỡ ảnh {position}</Button>
          </div>
        ))}
        {value.map((image, index) => (
          <div key={index}>
            <img src={'data:image/' + (image.startsWith('iVBOR') ? 'png' : 'jpeg') + ';base64,' + image}
              alt={'Xem trước ảnh đính kèm ' + (index + 1)} className="aspect-square w-full rounded-lg bg-panel object-cover" />
            <Button size="sm" kind="ghost" disabled={reading} onClick={() => onChange(value.filter((_, position) => position !== index))}>
              Gỡ ảnh mới {index + 1}
            </Button>
          </div>
        ))}
      </div>
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    </div>
  );
}

function PostImage({ path, position, privateUser, cover = false }: { path: string; position: number; privateUser?: string; cover?: boolean }) {
  const [privateImage, setPrivateImage] = useState<{ path: string; url: string }>();
  useEffect(() => {
    if (!privateUser) return;
    let active = true;
    let url: string | undefined;
    void authenticatedAccessToken(privateUser).then(token => requestBlob(path, token)).then(blob => {
      if (active) {
        url = URL.createObjectURL(blob);
        setPrivateImage({ path, url });
      }
    }).catch(() => {});
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [path, privateUser]);
  const image = privateUser ? (privateImage?.path === path ? privateImage.url : undefined) : path;
  if (!image) return null;
  return (
    <a href={image} target="_blank" rel="noopener noreferrer" className={cover ? "block size-full focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-accent" : "block overflow-hidden rounded-xl bg-panel"}>
      <img src={image} loading={cover ? "eager" : "lazy"} alt={'Ảnh đính kèm bài đăng ' + position} className={cover ? "size-full object-contain" : "mx-auto max-h-96 w-full object-contain"} />
    </a>
  );
}

export function RequestImageSlideshow({ id, imageCount, privateUser }: {
  id: number;
  imageCount: number;
  privateUser?: string;
}) {
  const [selected, setSelected] = useState(0);
  const count = Math.min(maxImages, Math.max(0, imageCount));
  if (!count) return null;
  const slide = Math.min(selected, count - 1);
  const move = (offset: number) => setSelected((slide + offset + count) % count);
  return (
    <section aria-label="Ảnh tham khảo" aria-roledescription="trình chiếu"
      className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800"
      onKeyDown={event => {
        if (count < 2 || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
        event.preventDefault();
        move(event.key === 'ArrowLeft' ? -1 : 1);
      }}>
      <div className="flex h-[clamp(12rem,34vw,27rem)] motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out"
        style={{ transform: `translateX(-${slide * 100}%)` }}>
        {Array.from({ length: count }, (_, index) => (
          <div key={index} inert={index !== slide} aria-hidden={index !== slide} className="min-w-full shrink-0">
            <PostImage cover path={imagePath('REQUEST', id, index + 1)} position={index + 1} privateUser={privateUser} />
          </div>
        ))}
      </div>
      {count > 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center bg-gradient-to-t from-black/70 to-transparent px-3 pb-3 pt-8">
          <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/20 bg-slate-950/85 px-2 py-1 text-white">
            <button type="button" aria-label="Ảnh trước" onClick={() => move(-1)}
              className="grid size-9 place-items-center rounded-full hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white">
              <Icon name="chevron" size={16} className="rotate-180" />
            </button>
            <span aria-live="polite" className="min-w-10 text-center text-xs font-semibold tabular-nums">{slide + 1} / {count}</span>
            <button type="button" aria-label="Ảnh tiếp theo" onClick={() => move(1)}
              className="grid size-9 place-items-center rounded-full hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white">
              <Icon name="chevron" size={16} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export function PostMedia({ kind, id, imageCount = 0, reference, privateUser }: {
  kind: Kind;
  id: number;
  imageCount?: number;
  reference?: string | null;
  privateUser?: string;
}) {
  const count = Math.min(maxImages, Math.max(0, imageCount));
  if (count === 0 && !reference) return null;
  return (
    <div className="space-y-2">
      {count > 0 && <div className={'grid gap-2 ' + (count > 1 ? 'grid-cols-2' : '')}>
        {Array.from({ length: count }, (_, index) => (
          <PostImage key={index} path={imagePath(kind, id, index + 1)} position={index + 1} privateUser={privateUser} />
        ))}
      </div>}
      {reference && /^https?:\/\//i.test(reference) && (
        <a href={reference} className="inline-flex max-w-full break-all rounded-lg border border-line bg-panel px-3 py-2 text-sm font-semibold text-accent hover:underline" target="_blank" rel="noopener noreferrer">
          Xem liên kết đính kèm ↗
        </a>
      )}
    </div>
  );
}

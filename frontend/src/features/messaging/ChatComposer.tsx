import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { Button } from '../../shared/ui/Button';
import { Icon } from '../../shared/ui/Icon';
import { errorMessage } from '../community/community.api';
import {
  clearChatReplyTarget,
  getChatComposerState,
  updateChatComposerState,
  useChatComposerState,
} from './chat-drafts';
import {
  chatImageMaxBytes,
  chatImagesMaxCount,
  sendChatMessage,
  type ChatDraft,
} from './messaging.api';

type ChatComposerProps = {
  conversationId: number;
  userId: string;
  onSent: () => void | Promise<void>;
  compact?: boolean;
  disabled?: boolean;
};
const noImages: File[] = [];

export function ChatComposer({
  conversationId,
  userId,
  onSent,
  compact = false,
  disabled = false,
}: ChatComposerProps) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const active = useRef(false);
  const { draft, sending = false, error } = useChatComposerState(userId, conversationId);
  const body = draft?.body ?? '';
  const images = draft?.images ?? noImages;
  const replyTo = draft?.replyTo;
  const [previews, setPreviews] = useState<{ image: File; url: string }[]>([]);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, [conversationId, userId]);
  useEffect(() => {
    const next = images.map((image) => ({ image, url: URL.createObjectURL(image) }));
    // Initialize after commit; object URLs must not be created during render.
    const timer = window.setTimeout(() => setPreviews(next), 0);
    return () => {
      window.clearTimeout(timer);
      next.forEach(({ url }) => URL.revokeObjectURL(url));
    };
  }, [images]);

  function edit(text: string, selectedImages = images) {
    if (disabled || getChatComposerState(userId, conversationId).sending) return;
    const reply = getChatComposerState(userId, conversationId).draft?.replyTo;
    updateChatComposerState(
      userId,
      conversationId,
      text || selectedImages.length || reply
        ? { draft: { body: text, clientId: crypto.randomUUID(), images: selectedImages, replyTo: reply } }
        : {},
    );
  }

  function chooseImages(selected: File[]) {
    if (disabled || getChatComposerState(userId, conversationId).sending) return;
    const currentImages = getChatComposerState(userId, conversationId).draft?.images ?? [];
    if (currentImages.length + selected.length > chatImagesMaxCount) {
      updateChatComposerState(userId, conversationId, {
        draft: getChatComposerState(userId, conversationId).draft,
        error: `Mỗi tin nhắn gửi tối đa ${chatImagesMaxCount} ảnh.`,
      });
      return;
    }
    for (const file of selected) {
      if (!file.size || file.size > chatImageMaxBytes) {
        updateChatComposerState(userId, conversationId, {
          draft: getChatComposerState(userId, conversationId).draft,
          error: 'Mỗi ảnh cần có dung lượng từ 1 byte đến 5 MB.',
        });
        return;
      }
      if (!/\.(png|jpe?g)$/i.test(file.name) ||
          (file.type && !['image/jpeg', 'image/png'].includes(file.type))) {
        updateChatComposerState(userId, conversationId, {
          draft: getChatComposerState(userId, conversationId).draft,
          error: 'Chỉ hỗ trợ ảnh PNG hoặc JPG.',
        });
        return;
      }
    }
    edit(body, [...currentImages, ...selected]);
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    const current = getChatComposerState(userId, conversationId);
    const payload: ChatDraft | undefined = current.draft;
    if (disabled || current.sending || !payload || (!payload.body.trim() && !payload.images?.length)) return;

    updateChatComposerState(userId, conversationId, { draft: payload, sending: true });
    try {
      await sendChatMessage(conversationId, userId, payload);
    } catch (cause) {
      if (getChatComposerState(userId, conversationId).draft === payload) {
        updateChatComposerState(userId, conversationId, { draft: payload, error: errorMessage(cause) });
      }
      return;
    }
    if (getChatComposerState(userId, conversationId).draft === payload) {
      updateChatComposerState(userId, conversationId, {});
    }
    if (active.current) await onSent();
    window.dispatchEvent(new Event('tasknest:chat-sent'));
  }

  const locked = disabled || sending;
  return (
    <form
      ref={form}
      onSubmit={(event) => void send(event)}
      className={'shrink-0 border-t border-line/80 bg-gradient-to-t from-surface to-panel/25 ' + (compact ? 'p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]' : 'p-4')}
      aria-busy={sending || undefined}
    >
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-success" />
          {sending ? 'Đang gửi tin nhắn' : 'Trao đổi trong TaskNest'}
        </p>
        {!compact && <span className="text-[11px] text-muted">Tin nhắn riêng tư</span>}
      </div>
      {!!images.length && (
        <div className="mb-2 rounded-2xl border border-accent/20 bg-tint/60 p-2.5 shadow-sm">
          <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
            <p className="text-xs font-semibold text-ink">Ảnh đính kèm</p>
            <span className="text-[11px] text-muted">{images.length}/{chatImagesMaxCount}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {images.map((image, index) => {
              const preview = previews.find((item) => item.image === image);
              return (
                <div key={`${image.name}-${index}`} className="relative size-16 overflow-hidden rounded-xl border border-line bg-panel sm:size-[4.5rem]">
                  {preview ? (
                    <img src={preview.url} alt={`Xem trước ảnh ${index + 1}`} className="size-full object-cover" />
                  ) : <span aria-hidden="true" className="grid size-full place-items-center text-muted"><Icon name="paperclip" size={18} /></span>}
                  <button
                    type="button"
                    disabled={locked}
                    aria-label={`Bỏ ảnh ${index + 1}`}
                    title="Bỏ ảnh"
                    onClick={() => edit(body, images.filter((_, imageIndex) => imageIndex !== index))}
                    className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-ink/75 text-white shadow-sm transition hover:bg-danger focus-visible:outline-2 focus-visible:outline-white disabled:opacity-50"
                  >
                    <Icon name="close" size={13} />
                  </button>
                </div>
              );
            })}
            {images.length < chatImagesMaxCount && (
              <button type="button" disabled={locked} onClick={() => input.current?.click()} className="grid size-16 place-items-center rounded-xl border border-dashed border-line bg-surface/70 text-muted transition hover:border-accent/40 hover:text-accent sm:size-[4.5rem]" aria-label="Thêm ảnh">
                <Icon name="plus" size={20} />
              </button>
            )}
          </div>
          <p className="mt-2 truncate text-[10px] text-muted" title={images.map((item) => item.name).join(', ')}>{images.map((item) => item.name).join(' · ')}</p>
        </div>
      )}
      {replyTo && (
        <div className="mb-2 flex items-center gap-2 rounded-2xl border border-accent/20 border-l-4 bg-tint/60 px-3 py-2.5 shadow-sm">
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-bold uppercase tracking-wide text-accent">Đang trả lời {replyTo.sender_user_id === userId ? 'tin nhắn của bạn' : replyTo.sender_name}</span>
            <span className="mt-0.5 block truncate text-xs text-muted">{replyTo.has_image && !replyTo.body ? 'Đã gửi ảnh' : replyTo.body}</span>
          </span>
          <Button
            kind="ghost"
            icon="close"
            size="sm"
            disabled={locked}
            aria-label="Bỏ trả lời tin nhắn"
            title="Bỏ trả lời"
            className="size-9 !min-h-9 !p-0"
            onClick={() => clearChatReplyTarget(userId, conversationId)}
          />
        </div>
      )}
      <div className="rounded-[1.25rem] border border-line bg-field p-1.5 shadow-sm transition focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/10">
        <label className="sr-only" htmlFor={inputId}>Tin nhắn</label>
        <textarea
          id={inputId}
          className={'block w-full border-0 bg-transparent px-2.5 py-1.5 text-sm leading-6 text-ink placeholder:text-muted/70 focus:outline-none ' + (compact ? 'max-h-24 min-h-11 resize-none' : 'max-h-36 min-h-16 resize-y')}
          rows={compact ? 1 : 2}
          maxLength={4000}
          disabled={locked}
          value={body}
          onChange={(event) => edit(event.target.value, images)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              form.current?.requestSubmit();
            }
          }}
          placeholder="Viết tin nhắn…"
        />
        <div className="flex items-center justify-between gap-2 px-1.5 pt-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <input
              ref={input}
              type="file"
              hidden
              disabled={locked}
              multiple
              aria-label="Tệp ảnh tin nhắn"
              accept=".png,.jpg,.jpeg,image/png,image/jpeg"
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                event.target.value = '';
                if (files.length) chooseImages(files);
              }}
            />
            <Button kind="ghost" icon="paperclip" size="sm" title={`Đính kèm tối đa ${chatImagesMaxCount} ảnh PNG/JPG, mỗi ảnh tối đa 5 MB`} aria-label="Đính kèm ảnh" disabled={locked || images.length >= chatImagesMaxCount} onClick={() => input.current?.click()} className="size-11 !min-h-11 !rounded-full !p-0" />
            {!compact && <span className="hidden text-[11px] text-muted sm:inline">Tối đa 5 ảnh · mỗi ảnh 5 MB</span>}
          </div>
          <div className="flex items-center gap-2">
            {!compact && body.length > 0 && <span className="text-[10px] tabular-nums text-muted">{body.length}/4000</span>}
            <Button type="submit" size="sm" loading={sending} disabled={disabled || (!body.trim() && !images.length)} aria-label={sending ? 'Đang gửi tin nhắn' : 'Gửi tin nhắn'} className={compact ? 'size-11 !min-h-11 !rounded-full !p-0' : ''}>
              {compact && !sending ? <Icon name="arrow" size={16} /> : sending ? 'Đang gửi…' : 'Gửi tin nhắn'}
            </Button>
          </div>
        </div>
      </div>
      {error && <p role="alert" className="mt-2 break-words rounded-lg bg-danger/10 px-2.5 py-1.5 text-xs text-danger">{error}</p>}
      {!compact && !error && <p className="mt-1.5 px-1 text-[10px] text-muted">Enter để gửi · Shift + Enter để xuống dòng</p>}
    </form>
  );
}

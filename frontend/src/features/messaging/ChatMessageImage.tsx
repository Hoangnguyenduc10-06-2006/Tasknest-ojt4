import { useEffect, useRef, useState } from 'react';
import { Modal } from '../../shared/ui/Modal';
import { chatImageBlob } from './messaging.api';

type ChatMessageImageProps = {
  conversationId: number;
  messageId: number;
  userId: string;
  compact?: boolean;
  imageSlot?: number;
  fluid?: boolean;
};

type ImageState =
  | { key: string; url: string; downloadName: string }
  | { key: string; error: string };

export function ChatMessageImage({
  conversationId,
  messageId,
  userId,
  compact = false,
  imageSlot = 1,
  fluid = false,
}: ChatMessageImageProps) {
  const frame = useRef<HTMLDivElement>(null);
  const key = `${userId}/${conversationId}/${messageId}/${imageSlot}`;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<ImageState>();
  const [opened, setOpened] = useState<string>();
  const current = state?.key === key ? state : undefined;

  useEffect(() => {
    const anchor = frame.current;
    let active = true;
    let started = false;
    let url: string | undefined;

    function load() {
      if (!active || started) return;
      started = true;
      void chatImageBlob(conversationId, messageId, userId, imageSlot)
        .then((blob) => {
          if (!active) return;
          url = URL.createObjectURL(blob);
          setState({
            key,
            url,
            downloadName: `tasknest-${messageId}-${imageSlot}.${blob.type === 'image/png' ? 'png' : 'jpg'}`,
          });
        })
        .catch(() => {
          if (active) setState({ key, error: 'Không thể tải ảnh.' });
        });
    }

    let observer: IntersectionObserver | undefined;
    if (anchor && typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer?.disconnect();
          load();
        }
      });
      observer.observe(anchor);
    } else {
      load();
    }
    return () => {
      active = false;
      observer?.disconnect();
      if (url) URL.revokeObjectURL(url);
    };
  }, [attempt, conversationId, imageSlot, key, messageId, userId]);

  return (
    <div ref={frame} className={'mt-1 max-w-full ' + (fluid ? 'w-full min-w-0' : compact ? 'w-40' : 'w-60')}>
      {current && 'url' in current ? (
        <>
          <button
            type="button"
            aria-label={`Xem ảnh ${imageSlot} đã gửi`}
            onClick={() => setOpened(key)}
            className="group block w-full overflow-hidden rounded-2xl border border-line/70 bg-panel shadow-sm focus-visible:outline-2 focus-visible:outline-accent"
          >
            <img
              src={current.url}
              alt={`Ảnh ${imageSlot} đính kèm tin nhắn`}
              className="aspect-[4/3] w-full bg-panel object-contain transition duration-200 group-hover:scale-[1.02]"
            />
          </button>
          {opened === key && (
            <Modal open title="Ảnh đính kèm" maxWidth="xl" onClose={() => setOpened(undefined)}>
              <img
                src={current.url}
                alt={`Ảnh ${imageSlot} đính kèm tin nhắn`}
                className="mx-auto max-h-[65dvh] max-w-full rounded-lg object-contain"
              />
              <a
                className="mt-4 inline-block rounded-lg px-2 py-1 text-sm font-semibold text-accent hover:bg-panel"
                href={current.url}
                download={current.downloadName}
              >
                Tải ảnh xuống
              </a>
            </Modal>
          )}
        </>
      ) : (
        <div className="grid aspect-[4/3] place-content-center gap-1 rounded-2xl border border-line/70 bg-panel px-2 text-center text-xs text-muted">
          {current && 'error' in current ? (
            <>
              <p>{current.error}</p>
              <button
                type="button"
                className="font-semibold text-accent hover:underline"
                onClick={() => {
                  setState(undefined);
                  setAttempt((value) => value + 1);
                }}
              >
                Tải lại ảnh
              </button>
            </>
          ) : (
            <span>Ảnh đính kèm</span>
          )}
        </div>
      )}
    </div>
  );
}

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from 'react';
import { Icon } from './Icon';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
  scrollBody?: boolean;
  footer?: ReactNode;
}
const widths = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  maxWidth = 'md',
  scrollBody = false,
  footer,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  const id = useId();
  useLayoutEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    dialog
      .querySelector<HTMLElement>('input:not([type="file"]), textarea, select')
      ?.focus();
    const cancel = (event: Event) => {
      if (event.target !== dialog) return;
      event.preventDefault();
      closeRef.current();
    };
    dialog.addEventListener('cancel', cancel);
    return () => {
      dialog.removeEventListener('cancel', cancel);
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
        previousFocus.focus();
    };
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={`${id}-title`}
      aria-describedby={description ? `${id}-description` : undefined}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            onClose();
        }
      }}
      className={`motion-dialog m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] ${widths[maxWidth]} rounded-2xl border border-line bg-surface text-ink shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm ${scrollBody ? 'overflow-hidden open:flex open:flex-col' : 'overflow-y-auto p-5 sm:p-7'}`}
    >
      {open && (
        <>
          <div
            className={
              'flex shrink-0 items-start justify-between gap-4 border-b border-line ' +
              (scrollBody ? 'p-5 sm:px-6' : 'pb-5')
            }
          >
            <div>
              <h2
                id={`${id}-title`}
                className="text-xl font-bold tracking-tight text-ink"
              >
                {title}
              </h2>
              {description && (
                <p id={`${id}-description`} className="mt-1 text-xs text-muted">
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng cửa sổ"
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-panel hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
            >
              <Icon name="close" size={16} />
            </button>
          </div>
          <div
            className={
              'figma-form ' +
              (scrollBody ? 'min-h-0 overflow-y-auto p-5 sm:px-6' : 'mt-6')
            }
          >
            {children}
          </div>
          {footer && (
            <div className="shrink-0 border-t border-line bg-surface p-4 sm:px-6">
              {footer}
            </div>
          )}
        </>
      )}
    </dialog>
  );
}

import { useId, useSyncExternalStore, type ComponentProps } from 'react';
import { Button } from '../../shared/ui/Button';
import { readStoredDraft, subscribeDrafts } from './draftStorage';

export function DraftButton({
  storageKey,
  className = '',
  ...props
}: ComponentProps<typeof Button> & { storageKey: string | null }) {
  const descriptionId = useId();
  const hasDraft = useSyncExternalStore(
    subscribeDrafts,
    () => {
      const draft = storageKey ? readStoredDraft(storageKey) : null;
      return draft !== null && Object.keys(draft).length > 0;
    },
    () => false,
  );
  return (
    <span className="inline-flex max-w-full flex-col items-start gap-2">
      <Button
        {...props}
        className={`${className} ${hasDraft ? 'outline-2 outline-solid outline-accent/60 outline-offset-4' : ''}`}
        data-has-draft={hasDraft || undefined}
        aria-describedby={
          [props['aria-describedby'], hasDraft ? descriptionId : undefined]
            .filter(Boolean)
            .join(' ') || undefined
        }
      />
      {hasDraft && (
        <span
          id={descriptionId}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent"
        >
          <span
            aria-hidden="true"
            className="size-1.5 rounded-full bg-accent"
          />
          Có bản nháp
        </span>
      )}
    </span>
  );
}

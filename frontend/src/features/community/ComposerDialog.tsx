import { DraftButton } from './DraftButton';
import {
  composerDraftStorageKey,
  readStoredDraft,
  writeStoredDraft,
  removeStoredDraft,
} from './draftStorage';
import {
  ComposerContext,
  type Field,
  type Status,
  type Value,
} from './composer.state';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { Modal } from '../../shared/ui/Modal';
import { Button } from '../../shared/ui/Button';
import { useSession } from '../auth';
import { UserAvatar } from '../profile/components/UserAvatar';

function same(a: Value, b: Value) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function ComposerDialog({
  user,
  scope,
  title,
  submitLabel,
  onClose,
  onDraftSaved,
  children,
  disabled = false,
}: {
  user: string;
  scope: string;
  title: string;
  submitLabel: string;
  onClose: () => void;
  onDraftSaved?: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  const session = useSession();
  const formId = useId();
  const key = composerDraftStorageKey(user, scope);
  const [draft] = useState(() => readStoredDraft(key) ?? {});
  const [fields, setFields] = useState<Record<string, Field>>({});
  const [status, setStatus] = useState<Status>({ busy: false, error: '' });
  const [confirm, setConfirm] = useState(false);
  const [storageError, setStorageError] = useState('');
  const contentRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLDivElement>(null);
  const dirty = Object.values(fields).some(
    (item) => !same(item.value, item.initial),
  );
  const reportField = useCallback(
    (name: string, value: Value, initial: Value, persist: boolean) => {
      setFields((current) =>
        current[name] &&
        same(current[name].value, value) &&
        same(current[name].initial, initial)
          ? current
          : { ...current, [name]: { value, initial, persist } },
      );
    },
    [],
  );
  const reportStatus = useCallback((next: Status) => {
    setStatus((current) =>
      current.busy === next.busy && current.error === next.error
        ? current
        : next,
    );
  }, []);
  function clear() {
    removeStoredDraft(key);
  }
  function close() {
    if (!status.busy) {
      if (dirty) setConfirm(true);
      else onClose();
    }
  }
  function complete() {
    try {
      clear();
    } catch {
      /* The server already saved the content. */
    }
    onClose();
  }
  function captureSubmit(event: FormEvent) {
    const button = (event.nativeEvent as SubmitEvent).submitter;
    if (!(button instanceof HTMLButtonElement) || button.value !== 'save-draft')
      return;
    event.preventDefault();
    event.stopPropagation();
    if (status.busy) return;
    try {
      writeStoredDraft(
        key,
        Object.fromEntries(
          Object.entries(fields)
            .filter(([, field]) => field.persist)
            .map(([name, field]) => [name, field.value]),
        ),
      );
      (onDraftSaved ?? onClose)();
    } catch {
      setStorageError(
        'Không thể lưu bản nháp trên thiết bị này. Bạn có thể tiếp tục chỉnh sửa và thử lại.',
      );
    }
  }
  useEffect(() => {
    if (!dirty && !status.busy) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, status.busy]);
  useEffect(() => {
    if (confirm) confirmRef.current?.querySelector('button')?.focus();
  }, [confirm]);
  const name =
    session.status === 'authenticated' ? session.user.fullName : 'Bạn';
  return (
    <ComposerContext.Provider
      value={{
        formId,
        draft,
        field: reportField,
        status: reportStatus,
        complete,
      }}
    >
      <Modal
        open
        title={title}
        onClose={close}
        maxWidth="xl"
        scrollBody
        footer={
          !confirm && (
            <div className="flex justify-end">
              <Button
                type="submit"
                form={formId}
                loading={status.busy}
                disabled={disabled}
              >
                {submitLabel}
              </Button>
            </div>
          )
        }
      >
        {confirm && (
          <div
            ref={confirmRef}
            className="space-y-4"
            role="group"
            aria-label="Lưu bản nháp hoặc hủy bỏ"
          >
            <h3 className="text-lg font-semibold">
              Lưu bản nháp trước khi thoát?
            </h3>
            <p className="text-sm text-muted">
              Bạn có thể lưu để tiếp tục sau trên thiết bị này hoặc hủy bỏ nội
              dung đang soạn.
            </p>
            {(storageError || status.error) && (
              <p role="alert" className="text-sm text-danger">
                {storageError || status.error}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                kind="secondary"
                onClick={() => {
                  setConfirm(false);
                  setStorageError('');
                  requestAnimationFrame(() =>
                    contentRef.current
                      ?.querySelector<HTMLElement>('input, textarea, select')
                      ?.focus(),
                  );
                }}
              >
                Tiếp tục chỉnh sửa
              </Button>
              <Button
                kind="danger"
                onClick={() => {
                  try {
                    clear();
                    onClose();
                  } catch {
                    setStorageError('Chưa thể xóa bản nháp. Vui lòng thử lại.');
                  }
                }}
              >
                Hủy bỏ
              </Button>
              <Button
                type="submit"
                form={formId}
                name="intent"
                value="save-draft"
                formNoValidate
              >
                Lưu bản nháp
              </Button>
            </div>
          </div>
        )}
        <div ref={contentRef} hidden={confirm} onSubmitCapture={captureSubmit}>
          <div className="mb-5 flex items-center gap-3">
            <UserAvatar userId={user} name={name} />
            <p className="font-semibold">{name}</p>
          </div>
          <fieldset disabled={status.busy || disabled} className="min-w-0">
            {children}
          </fieldset>
        </div>
      </Modal>
    </ComposerContext.Provider>
  );
}
export function ComposerEntry({
  title,
  user,
  scope,
  submitLabel,
  children,
  disabled = false,
}: {
  title: string;
  user: string;
  scope: string;
  submitLabel: string;
  children: ReactNode;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  return (
    <div className="space-y-2">
      <DraftButton
        storageKey={composerDraftStorageKey(user, scope)}
        kind="secondary"
        aria-haspopup="dialog"
        disabled={disabled}
        onClick={() => {
          setSaved(false);
          setOpen(true);
        }}
      >
        {title}
      </DraftButton>
      {saved && (
        <p role="status" className="text-sm text-muted">
          Đã lưu bản nháp trên thiết bị này. Mở lại để tiếp tục chỉnh sửa.
        </p>
      )}
      {open && (
        <ComposerDialog
          user={user}
          scope={scope}
          title={title}
          submitLabel={submitLabel}
          disabled={disabled}
          onClose={() => setOpen(false)}
          onDraftSaved={() => {
            setOpen(false);
            setSaved(true);
          }}
        >
          {children}
        </ComposerDialog>
      )}
    </div>
  );
}

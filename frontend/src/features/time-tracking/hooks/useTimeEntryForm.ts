import { useRef, useState } from 'react';
import { useWorkspace, type TimeEntry } from '../../workspace';
import {
  fromLocalTime,
  toLocalTime,
  validateTimeRange,
} from '../model/timesheet';
import type { ManualTimeInput } from '../model/timesheet.types';
export function useTimeEntryForm(
  initial: TimeEntry | undefined,
  onSave: (input: ManualTimeInput) => Promise<unknown>,
  onSaved: () => void,
) {
  const workspace = useWorkspace();
  const [start, setStart] = useState(
    initial ? toLocalTime(initial.startedAt) : '',
  );
  const [end, setEnd] = useState(
    initial?.endedAt ? toLocalTime(initial.endedAt) : '',
  );
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const submit = async () => {
    if (busy.current) return;
    if (!workspace.data) {
      setError('Chưa tải được dữ liệu giờ làm. Vui lòng thử lại.');
      return;
    }
    const message = validateTimeRange(
      start,
      end,
      reason,
      workspace.data.timeEntries,
      Date.now(),
      initial?.id,
    );
    if (message) {
      setError(message);
      return;
    }
    busy.current = true;
    setSaving(true);
    setError('');
    try {
      await onSave({
        startedAt:
          initial && start === toLocalTime(initial.startedAt)
            ? initial.startedAt
            : new Date(fromLocalTime(start)).toISOString(),
        endedAt:
          initial?.endedAt && end === toLocalTime(initial.endedAt)
            ? initial.endedAt
            : new Date(fromLocalTime(end)).toISOString(),
        reason: reason.trim(),
      });
      await workspace.refresh();
      onSaved();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Không thể lưu phiên.');
      await workspace.refresh();
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };
  return {
    start,
    setStart,
    end,
    setEnd,
    reason,
    setReason,
    error,
    saving,
    busy,
    submit,
  };
}

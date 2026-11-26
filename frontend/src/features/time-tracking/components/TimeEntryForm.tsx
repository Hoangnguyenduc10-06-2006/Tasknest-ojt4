import { Button } from '../../../shared/ui/Button';
import type { ReactNode } from 'react';
import type { useTimeEntryForm } from '../hooks/useTimeEntryForm';
export function TimeEntryForm({
  form,
  children,
  onClose,
  submitLabel,
}: {
  form: ReturnType<typeof useTimeEntryForm>;
  children?: ReactNode;
  onClose: () => void;
  submitLabel: string;
}) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void form.submit();
      }}
      className="space-y-4"
    >
      {children}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium">
          Ngày giờ bắt đầu
          <input
            type="datetime-local"
            step="1"
            required
            value={form.start}
            disabled={form.saving}
            onChange={(event) => form.setStart(event.target.value)}
            className="min-w-0 rounded-xl border border-line bg-field p-3 text-ink"
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Ngày giờ kết thúc
          <input
            type="datetime-local"
            step="1"
            required
            value={form.end}
            disabled={form.saving}
            onChange={(event) => form.setEnd(event.target.value)}
            className="min-w-0 rounded-xl border border-line bg-field p-3 text-ink"
          />
        </label>
      </div>
      <p className="text-xs text-muted">
        Thời gian theo múi giờ Việt Nam (UTC+7). Có thể ghi phiên qua đêm; không
        ghi thời gian tương lai hoặc trùng phiên khác.
      </p>
      <label className="grid gap-2 text-sm font-medium">
        Lý do
        <textarea
          required
          maxLength={4000}
          rows={3}
          value={form.reason}
          disabled={form.saving}
          onChange={(event) => form.setReason(event.target.value)}
          className="rounded-xl border border-line bg-field p-3 text-ink"
        />
      </label>
      {form.error && (
        <p role="alert" className="text-sm text-danger">
          {form.error}
        </p>
      )}
      <p className="rounded-xl bg-panel p-3 text-xs text-muted">
        Hệ thống lưu người thực hiện, lý do và lịch sử thay đổi sau khi máy chủ
        xác nhận.
      </p>
      <div className="flex justify-end gap-3">
        <Button variant="secondary" disabled={form.saving} onClick={onClose}>
          Hủy
        </Button>
        <Button type="submit" loading={form.saving}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

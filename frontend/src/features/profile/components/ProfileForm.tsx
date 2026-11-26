import { useId, useRef } from 'react';
import { Button } from '../../../shared/ui/Button';
import { TextField } from '../../../shared/ui/TextField';
import { useProfileForm } from '../hooks/useProfileForm';
import type { SessionUser } from '../../auth';

type Props = {
  user: SessionUser;
  onSaved?: (user: SessionUser) => void;
  submitLabel?: string;
  showJobTitle?: boolean;
  mode?: 'full' | 'avatar' | 'details';
};
export function ProfileForm({
  user,
  onSaved,
  submitLabel = 'Lưu hồ sơ',
  showJobTitle = true,
  mode = 'full',
}: Props) {
  const { email, emailVerified } = user;
  const form = useProfileForm(user);
  const fileInput = useRef<HTMLInputElement>(null);
  const bioId = useId();
  const initials =
    form.values.fullName
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .slice(-2)
      .join('')
      .toUpperCase() || 'T';
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void form.save().then((saved) => {
          if (saved) onSaved?.(saved);
        });
      }}
      className="panel profile-form"
      noValidate
    >
      <fieldset disabled={form.saving} className="min-w-0">
        <legend className="sr-only">Thông tin hồ sơ</legend>
        {mode !== 'details' && <div className="flex flex-wrap items-center gap-4 border-b border-line pb-6">
          <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-tint text-xl font-bold text-accent">
            {form.photo ? (
              <img
                src={form.photo}
                alt="Ảnh đại diện"
                className="size-full object-cover"
              />
            ) : (
              <span aria-label="Ảnh đại diện bằng chữ viết tắt">
                {initials}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">Ảnh đại diện</h2>
            <p className="mt-1.5 text-xs text-muted">PNG, JPG tối đa 5 MB</p>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg"
            aria-label="Chọn ảnh đại diện"
            className="sr-only"
            tabIndex={-1}
            onChange={(event) => {
              void form.choosePhoto(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
          <Button
            variant="secondary"
            size="sm"
            loading={form.readingPhoto}
            onClick={() => fileInput.current?.click()}
          >
            Thay ảnh
          </Button>
          {form.photoError && (
            <p role="alert" className="w-full text-sm text-danger">
              {form.photoError}
            </p>
          )}
        </div>}
        {mode !== 'avatar' && <>
        <div className={showJobTitle ? "mt-6 grid gap-5 sm:grid-cols-2" : "mt-6"}>
          <TextField
            label="Họ và tên"
            autoComplete="name"
            name="fullName"
            required
            value={form.values.fullName}
            error={form.errors.fullName}
            onChange={(event) => form.update('fullName', event.target.value)}
          />
          {showJobTitle && <TextField
            label="Chức danh"
            autoComplete="organization-title"
            name="jobTitle"
            placeholder="Ví dụ: Product Designer"
            value={form.values.jobTitle}
            error={form.errors.jobTitle}
            onChange={(event) => form.update('jobTitle', event.target.value)}
          />}
        </div>
        <div className="mt-5">
          <label htmlFor={bioId} className="mb-2 block text-sm font-medium">
            Giới thiệu ngắn
          </label>
          <textarea
            id={bioId}
            name="bio"
            rows={4}
            value={form.values.bio}
            placeholder="Chia sẻ một chút về công việc và sở thích của bạn…"
            onChange={(event) => form.update('bio', event.target.value)}
            aria-invalid={!!form.errors.bio}
            aria-describedby={`${bioId}-hint`}
            className={`min-h-28 w-full resize-y rounded-xl border bg-field px-3.5 py-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 ${form.errors.bio ? 'border-danger' : 'border-line'}`}
          />
          <p
            id={`${bioId}-hint`}
            className={`mt-1 text-xs ${form.errors.bio ? 'text-danger' : 'text-muted'}`}
          >
            {form.errors.bio ||
              `${Array.from(form.values.bio).length}/500 ký tự`}
          </p>
        </div>
        <div className="mt-5">
          <TextField
            label="Email đăng nhập"
            name="email"
            type="email"
            readOnly
            value={email}
            hint="Email đăng nhập không thể thay đổi trong phiên bản hiện tại."
            className="bg-panel text-muted"
            trailing={
              <span
                className={`whitespace-nowrap rounded-md px-2 py-1 text-[10px] font-semibold ${emailVerified ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning'}`}
              >
                {emailVerified ? 'Đã xác nhận' : 'Chưa xác nhận'}
              </span>
            }
          />
        </div>
        </>}
        {mode !== 'details' && <label className="mt-5 flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={form.avatarPublic}
            onChange={(event) => form.setAvatarPublic(event.target.checked)}
          />
          <span>
            Cho phép hiển thị ảnh đại diện trên hồ sơ công khai của tôi.
          </span>
        </label>}
        <div className="mt-6 flex items-center justify-end border-t border-line pt-5">
          <Button
            type="submit"
            loading={form.saving}
            disabled={form.readingPhoto}
          >
            {submitLabel}
          </Button>
        </div>
      </fieldset>
      {form.message && (
        <p
          role="status"
          className="mt-4 rounded-xl bg-tint p-3 text-sm leading-6 text-ink"
        >
          {form.message}
        </p>
      )}
    </form>
  );
}

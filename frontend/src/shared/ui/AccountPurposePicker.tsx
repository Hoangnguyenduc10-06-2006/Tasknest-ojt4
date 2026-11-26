import { useId } from 'react';
import { purposeLabels } from '../account-purpose';
const descriptions: Record<string, string> = {
  CLIENT: 'Đăng yêu cầu, tìm đội phát triển và nghiệm thu sản phẩm.',
  DEVELOPER: 'Giới thiệu năng lực, tìm đội và tham gia dự án.',
  BOTH: 'Vừa thuê đội cho dự án của bạn, vừa tham gia phát triển sản phẩm.',
};
export function AccountPurposePicker({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const group = useId();
  return (
    <fieldset disabled={disabled} className="space-y-3">
      <legend className="mb-3 text-lg font-semibold">
        Bạn muốn làm gì trên TaskNest?
      </legend>
      {(['CLIENT', 'DEVELOPER', 'BOTH'] as const).map((purpose) => (
        <label
          key={purpose}
          className={
            'flex cursor-pointer items-start gap-3 rounded-xl border p-4 ' +
            (value === purpose
              ? 'border-accent bg-tint'
              : 'border-line bg-surface')
          }
        >
          <input
            type="radio"
            name={group}
            value={purpose}
            checked={value === purpose}
            required
            onChange={() => onChange(purpose)}
            className="mt-1"
          />
          <span>
            <strong className="block text-sm">{purpose === 'BOTH' ? 'Cả hai' : purposeLabels[purpose]}</strong>
            <span className="mt-1 block text-xs leading-5 text-muted">
              {descriptions[purpose]}
            </span>
          </span>
        </label>
      ))}
      <p className="text-xs leading-5 text-muted">
        Chọn một phương án để tiếp tục. Bạn có thể cập nhật nhu cầu trong trang cá nhân.
      </p>
    </fieldset>
  );
}

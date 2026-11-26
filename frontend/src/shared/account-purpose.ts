export const purposeLabels: Record<string, string> = {
  CLIENT: 'Thuê đội phát triển',
  DEVELOPER: 'Tham gia phát triển sản phẩm',
  BOTH: 'Thuê đội và tham gia phát triển',
  UNDECIDED: 'Chưa chọn nhu cầu',
};
export function hasPurpose(value: string, purpose: 'CLIENT' | 'DEVELOPER') {
  return value === purpose || value === 'BOTH';
}
export function togglePurpose(
  value: string,
  purpose: 'CLIENT' | 'DEVELOPER',
  checked: boolean,
) {
  const client = purpose === 'CLIENT' ? checked : hasPurpose(value, 'CLIENT');
  const developer =
    purpose === 'DEVELOPER' ? checked : hasPurpose(value, 'DEVELOPER');
  return client && developer
    ? 'BOTH'
    : client
      ? 'CLIENT'
      : developer
        ? 'DEVELOPER'
        : 'UNDECIDED';
}

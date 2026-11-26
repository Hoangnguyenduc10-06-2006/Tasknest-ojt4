export type ProfileValues = { fullName: string; jobTitle: string; bio: string };
export type ProfileErrors = Partial<Record<keyof ProfileValues, string>>;
export function validateProfile(values: ProfileValues): ProfileErrors {
  const errors: ProfileErrors = {};
  const length = Array.from(values.fullName.trim()).length;
  if (length < 2 || length > 100) errors.fullName = 'Họ và tên cần có từ 2 đến 100 ký tự.';
  if (Array.from(values.jobTitle.trim()).length > 100) errors.jobTitle = 'Chức danh tối đa 100 ký tự.';
  if (Array.from(values.bio.trim()).length > 500) errors.bio = 'Giới thiệu ngắn tối đa 500 ký tự.';
  return errors;
}
export async function validateAvatar(file: File): Promise<string | undefined> {
  if (file.size === 0 || file.size > 5 * 1024 * 1024) return 'Chọn ảnh có dung lượng tối đa 5 MB.';
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte);
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (!((file.type === 'image/png' && png) || (file.type === 'image/jpeg' && jpeg))) return 'Vui lòng chọn ảnh PNG hoặc JPG hợp lệ.';
}

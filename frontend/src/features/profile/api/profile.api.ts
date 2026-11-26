import {
  authenticatedAccessToken,
  updateSessionUser,
  type SessionUser,
} from '../../auth';
import { requestBlob, requestJson } from '../../../shared/api/client';
import type { ProfileValues } from '../model/profile.validation';

function encodeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',', 2)[1]);
    reader.onerror = () => reject(new Error('Không thể đọc ảnh đại diện.'));
    reader.readAsDataURL(file);
  });
}
export async function saveProfile(
  userId: string,
  values: ProfileValues,
  version: number,
  photo?: File,
  avatarPublic?: boolean,
) {
  const accessToken = await authenticatedAccessToken(userId);
  const avatarBase64 = photo ? await encodeImage(photo) : undefined;
  const response = await requestJson<{ data: SessionUser }>(
    '/api/identity/profile',
    {
      method: 'PUT',
      csrf: true,
      accessToken,
      body: { ...values, version, avatarBase64, avatarPublic },
    },
  );
  updateSessionUser(response.data);
  return response.data;
}
export async function loadAvatar(userId: string) {
  return requestBlob(
    '/api/identity/profile/avatar',
    await authenticatedAccessToken(userId),
  );
}

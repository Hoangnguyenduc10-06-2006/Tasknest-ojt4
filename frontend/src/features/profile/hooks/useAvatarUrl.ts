import { useEffect, useState } from 'react';
import { loadAvatar } from '../api/profile.api';

type Avatar = {
  userId: string;
  version?: number;
  url: string;
};

export function useAvatarUrl(
  userId?: string,
  hasAvatar?: boolean,
  version?: number,
) {
  const [avatar, setAvatar] = useState<Avatar>();

  useEffect(() => {
    if (!userId || !hasAvatar) return;

    let active = true;

    void loadAvatar(userId)
      .then((blob) => {
        if (!active) return;

        setAvatar({
          userId,
          version,
          url: URL.createObjectURL(blob),
        });
      })
      .catch(() => {
        if (active) setAvatar(undefined);
      });

    return () => {
      active = false;
    };
  }, [userId, hasAvatar, version]);

  // Giải phóng URL khi thay ảnh hoặc rời component.
  useEffect(() => {
    return () => {
      if (avatar) URL.revokeObjectURL(avatar.url);
    };
  }, [avatar]);

  // Chỉ hiển thị ảnh đúng tài khoản và phiên bản hồ sơ.
  if (
    !userId ||
    !hasAvatar ||
    avatar?.userId !== userId ||
    avatar.version !== version
  ) {
    return undefined;
  }

  return avatar.url;
}
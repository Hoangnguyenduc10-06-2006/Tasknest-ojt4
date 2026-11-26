import { useEffect, useState, type ComponentProps } from 'react';
import { authenticatedAccessToken, useSession } from '../../auth';
import { requestBlob } from '../../../shared/api/client';
import { Avatar } from '../../../shared/ui/Avatar';

export function UserAvatar({
  userId,
  projectId,
  teamId,
  conversationId,
  connectedProfile = false,
  publicProfile = false,
  ...props
}: ComponentProps<typeof Avatar> & {
  userId?: string;
  projectId?: string;
  teamId?: number | string;
  conversationId?: number | string;
  connectedProfile?: boolean;
  publicProfile?: boolean;
}) {
  const session = useSession();
  const self = session.status === 'authenticated' && session.user.id === userId;
  const version =
    self && session.status === 'authenticated'
      ? session.user.version
      : undefined;
  const selfHasAvatar =
    self && session.status === 'authenticated'
      ? session.user.hasAvatar
      : undefined;
  const [image, setImage] = useState<{ key: string; url: string }>();
  const memberId = encodeURIComponent(userId ?? '');
  const scopedPath = conversationId != null
    ? `/api/work/community/chat/${encodeURIComponent(conversationId)}/participants/${memberId}/avatar`
    : teamId != null
      ? `/api/work/community/teams/${encodeURIComponent(teamId)}/members/${memberId}/avatar`
      : projectId
        ? `/api/work/projects/${encodeURIComponent(projectId)}/members/${memberId}/avatar`
        : undefined;
  const friendPath = connectedProfile && session.status === 'authenticated'
    ? `/api/work/community/members/${memberId}/avatar`
    : undefined;
  const key = `${scopedPath}/${friendPath}/${userId}/${version}/${publicProfile}`;
  useEffect(() => {
    if (!userId || (!self && !scopedPath && !friendPath && !publicProfile)) return;
    if (self && !selfHasAvatar) return;
    let active = true;
    let url: string | undefined;
    const publicPath = `/api/identity/public/avatars/${memberId}`;
    async function load() {
      if (self)
        return requestBlob('/api/identity/profile/avatar', await authenticatedAccessToken());
      for (const path of [scopedPath, friendPath]) {
        if (!path) continue;
        try {
          const token = await authenticatedAccessToken();
          return await requestBlob(path, token);
        } catch (error) {
          if (!publicProfile) throw error;
        }
      }
      return requestBlob(publicPath);
    }
    void load()
      .then((blob) => {
        if (active) {
          url = URL.createObjectURL(blob);
          setImage({ key, url });
        }
      })
      .catch(() => {
        if (active) setImage(undefined);
      });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [
    userId,
    scopedPath,
    friendPath,
    memberId,
    key,
    self,
    publicProfile,
    session.status,
    selfHasAvatar,
  ]);
  return <Avatar {...props} src={image?.key === key ? image.url : undefined} />;
}

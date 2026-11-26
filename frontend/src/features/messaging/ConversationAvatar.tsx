import { Avatar } from '../../shared/ui/Avatar';
import { UserAvatar } from '../profile/components/UserAvatar';
import type { Conversation } from './messaging.api';

export function ConversationAvatar({ room, className, linked = true }: { room?: Conversation; className: string; linked?: boolean }) {
  if (room?.kind === 'DIRECT' && room.peerId) {
    const avatar = <UserAvatar userId={room.peerId} name={room.title} conversationId={room.id} publicProfile className={className} />;
    if (!linked) return avatar;
    return (
      <a
        href={'/members/' + room.peerId}
        aria-label={'Mở hồ sơ của ' + room.title}
        className="inline-flex shrink-0 rounded-full transition hover:ring-2 hover:ring-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {avatar}
      </a>
    );
  }
  return <Avatar name={room?.title ?? 'Cuộc trò chuyện'} tone={room?.kind === 'PROJECT' ? 'purple' : 'neutral'} className={className} />;
}

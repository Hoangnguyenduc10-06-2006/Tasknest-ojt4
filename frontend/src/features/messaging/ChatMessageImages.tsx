import { ChatMessageImage } from './ChatMessageImage';

type ChatMessageImagesProps = {
  conversationId: number;
  messageId: number;
  userId: string;
  count: number;
  compact?: boolean;
};

export function ChatMessageImages({
  conversationId,
  messageId,
  userId,
  count,
  compact = false,
}: ChatMessageImagesProps) {
  const imageCount = Math.min(5, Math.max(0, Math.trunc(count)));
  if (!imageCount) return null;
  const widthClass = imageCount === 1
    ? compact ? 'w-40' : 'w-60'
    : 'w-[min(22rem,70vw)]';

  return (
    <div className={'mt-1 grid max-w-full gap-1.5 ' + widthClass + (imageCount === 1 ? ' grid-cols-1' : ' grid-cols-2')}>
      {Array.from({ length: imageCount }, (_, index) => (
        <ChatMessageImage
          key={index + 1}
          conversationId={conversationId}
          messageId={messageId}
          userId={userId}
          imageSlot={index + 1}
          compact={compact}
          fluid={imageCount > 1}
        />
      ))}
    </div>
  );
}

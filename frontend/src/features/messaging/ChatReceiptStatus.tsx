import type { ChatHistory } from './messaging.api';
import { chatReceipt } from './chat-receipts';

export function ChatReceiptStatus({
  messageId,
  user,
  participants,
  compact = false,
}: {
  messageId: number;
  user: string;
  participants: ChatHistory['participants'];
  compact?: boolean;
}) {
  const receipt = chatReceipt(messageId, user, participants);
  if (!receipt) return null;
  const label = receipt.status === 'seen'
    ? `Đã xem bởi: ${receipt.readers.join(', ') || receipt.seenBy + ' thành viên'}`
    : 'Đã gửi';

  return (
    <span title={label} className={'max-w-[18rem] break-words font-medium ' + (compact ? 'text-[9px]' : 'text-[10px]')}>
      {label}
    </span>
  );
}

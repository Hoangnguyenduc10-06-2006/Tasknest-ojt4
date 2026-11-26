export type ChatReceiptParticipant = {
  userId: string;
  name?: string;
  readId: number;
};

export type ChatReceipt = {
  status: 'sent' | 'seen';
  seenBy: number;
  recipients: number;
  readers: string[];
};

/**
 * Derive a receipt from the server's monotonic per-participant read markers.
 * A message is considered seen once any current recipient has read through it;
 * callers can use the counts to explain group receipts.
 */
export function chatReceipt(
  messageId: number,
  senderId: string,
  participants: ChatReceiptParticipant[],
): ChatReceipt | undefined {
  if (!Number.isSafeInteger(messageId) || messageId < 1) return undefined;

  const recipients = participants.filter((participant) => participant.userId !== senderId);
  const readers = recipients.filter(
    (participant) => Number.isSafeInteger(participant.readId) && participant.readId >= messageId,
  );
  const seenBy = readers.length;

  return {
    status: seenBy > 0 ? 'seen' : 'sent',
    seenBy,
    recipients: recipients.length,
    readers: readers.map((participant) => participant.name?.trim() || 'Thành viên'),
  };
}

/** AI copy supplements existing UI; it must not expose protocol text or fake actions. */
export function insightCopy(value?: string, existing: string[] = []): string {
  if (!value) return '';
  const text = value.replace(/\*\*|\x60/g, '').replace(/^[-•✦]\s*/, '').replace(/\s+/g, ' ').trim();
  if (!text || text.length > 240 || /[{}]|https?:\/\/|IN_PROGRESS|IN_REVIEW|tasksNeedingMyReview|viewerIsAssignee/i.test(text)) return '';
  if (/đã (tự động )?(giao|duyệt|cập nhật|thay đổi|gửi thông báo|điều chỉnh)/i.test(text)) return '';
  const normalize = (input: string) => input.toLocaleLowerCase('vi').replace(/[.,!;:]/g, '').trim();
  if (existing.some(item => normalize(item) === normalize(text))) return '';
  return text;
}

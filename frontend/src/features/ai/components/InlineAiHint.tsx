import { insightCopy } from '../model/insight-copy';

export function InlineAiHint({ text, existing = [] }: { text?: string; existing?: string[] }) {
  const copy = insightCopy(text, existing);
  if (!copy) return null;
  return <span className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-muted">
    <span className="shrink-0 font-medium text-accent" title="Gợi ý AI" aria-label="Gợi ý AI">✦</span>
    <span>{copy}</span>
  </span>;
}

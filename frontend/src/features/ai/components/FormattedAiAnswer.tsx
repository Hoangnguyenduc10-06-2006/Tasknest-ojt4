import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function FormattedAnswer({ text }: { text: string }) {
  return (
    <div className="ai-answer-markdown text-sm leading-relaxed text-ink">
      <Markdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        disallowedElements={['a', 'img']}
        unwrapDisallowed
        components={{
          table: ({ children }) => <div className="overflow-x-auto"><table>{children}</table></div>,
        }}
      >
        {text}
      </Markdown>
    </div>
  );
}

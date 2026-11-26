import { Component, lazy, Suspense, type ReactNode } from 'react';
const FormattedAnswer = lazy(() => import('./FormattedAiAnswer'));

export function AiAnswerMarkdown({ text }: { text: string }) {
  return (
    <AnswerRenderBoundary key={text} text={text}>
      <Suspense fallback={<p role="status" className="text-sm text-muted">Đang định dạng câu trả lời…</p>}>
        <FormattedAnswer text={text} />
      </Suspense>
    </AnswerRenderBoundary>
  );
}

class AnswerRenderBoundary extends Component<{ text: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed
      ? <p className="whitespace-pre-wrap wrap-break-word text-sm leading-relaxed text-ink">{this.props.text}</p>
      : this.props.children;
  }
}

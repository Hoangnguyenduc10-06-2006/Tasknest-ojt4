import { Component, Suspense, type ReactNode } from 'react';

class RouteErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <section role="alert" className="rounded-xl border border-line bg-surface p-6 text-center">
        <p>Không thể mở màn hình này. Hãy tải lại trang để thử lại.</p>
        <button
          type="button"
          className="mt-3 font-semibold text-accent underline"
          onClick={() => window.location.reload()}
        >
          Tải lại trang
        </button>
      </section>
    );
  }
}

export function RouteContent({ routeKey, children }: { routeKey: string; children: ReactNode }) {
  return (
    <RouteErrorBoundary key={routeKey}>
      <Suspense fallback={<p role="status" className="p-6 text-center text-muted">Đang tải màn hình…</p>}>
        <div key={routeKey} className="route-page-enter">
          {children}
        </div>
      </Suspense>
    </RouteErrorBoundary>
  );
}

export function Pagination({ page, total, onChange, size = 20, disabled = false }: {
  page: number; total: number; size?: number; onChange: (page: number) => void; disabled?: boolean;
}) {
  const pageSize = Math.max(1, size);
  const count = Math.max(0, total);
  const pages = Math.max(1, Math.ceil(count / pageSize));
  const current = Math.max(0, Math.min(page, pages - 1));
  const visible = [...new Set([0, current - 1, current, current + 1, pages - 1])]
    .filter(value => value >= 0 && value < pages).sort((a, b) => a - b);
  return <nav aria-label="Phân trang" className="app-pagination">
    <span aria-live="polite">{count ? current * pageSize + 1 : 0}–{Math.min((current + 1) * pageSize, count)} trong {count} kết quả</span>
    <div className="app-pagination-controls">
      <button type="button" disabled={disabled || current === 0} onClick={() => onChange(current - 1)}>Trước</button>
      {visible.map((value, index) => <span key={value} className="contents">
        {index > 0 && value - visible[index - 1] > 1 && <span className="pagination-gap" aria-hidden="true">…</span>}
        <button type="button" aria-label={`Trang ${value + 1}`} aria-current={current === value ? 'page' : undefined}
          disabled={disabled} className={current === value ? 'active' : ''} onClick={() => onChange(value)}>{value + 1}</button>
      </span>)}
      <button type="button" disabled={disabled || current + 1 >= pages} onClick={() => onChange(current + 1)}>Sau</button>
    </div>
  </nav>;
}

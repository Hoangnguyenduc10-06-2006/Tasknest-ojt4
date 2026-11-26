import { Icon } from '../../../shared/ui/Icon';

function duration(hours: number) {
  const minutes = Math.max(0, Math.round(hours * 60));
  return `${Math.floor(minutes / 60)} giờ${minutes % 60 ? ` ${minutes % 60} phút` : ''}`;
}

export function TaskTimeBudget({ estimated, logged }: { estimated: number; logged?: number }) {
  if (logged === undefined || estimated <= 0 || !Number.isFinite(logged) || !Number.isFinite(estimated)) return null;
  const ratio = logged / estimated;
  if (ratio < .8) return null;
  const over = logged > estimated;
  const difference = Math.abs(logged - estimated);
  return <section aria-label="So sánh thời gian với ước tính" className={`mt-5 rounded-xl border p-4 ${over ? 'border-danger/30 bg-danger-soft' : 'border-warning/30 bg-warning-soft'}`}>
    <div className="flex items-start gap-3">
      <span className={over ? 'text-danger' : 'text-warning'}><Icon name="alert" size={20} /></span>
      <div className="min-w-0 flex-1">
        <h2 className={`text-sm font-semibold ${over ? 'text-danger' : 'text-warning'}`}>{over ? `Vượt ${duration(difference)} so với ước tính` : logged === estimated ? 'Đã dùng hết thời gian ước tính' : `Còn ${duration(difference)} trong ước tính`}</h2>
        <p className="mt-1 text-xs text-muted">{over ? `Thời gian đã ghi bằng ${ratio.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} lần ước tính ban đầu.` : 'Nhiệm vụ đã sử dụng ít nhất 80% thời gian dự kiến.'}</p>
        <dl className="my-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[{ label: 'Ước tính ban đầu', value: duration(estimated) }, { label: 'Thời gian đã ghi', value: duration(logged) }, { label: over ? 'Phần vượt ước tính' : 'Thời gian còn lại', value: duration(difference) }].map((item, index) => <div key={item.label} className="rounded-lg bg-surface/70 p-3"><dt className="text-[11px] text-muted">{item.label}</dt><dd className={`mt-1 text-sm font-semibold ${index === 2 && over ? 'text-danger' : 'text-ink'}`}>{item.value}</dd></div>)}
        </dl>
        <div className="flex h-3 overflow-hidden rounded-full bg-surface" role="img" aria-label={`Đã ghi ${duration(logged)}, ước tính ${duration(estimated)}${over ? `, vượt ${duration(difference)}` : ''}`}>
          <span className="h-full bg-accent" style={{ width: `${Math.min(1, over ? estimated / logged : ratio) * 100}%` }} />
          {over && <span className="h-full flex-1 bg-danger" />}
        </div>
        <div className="mt-2 flex flex-wrap justify-between gap-2 text-[11px] text-muted"><span>● Trong ước tính: {duration(Math.min(logged, estimated))}</span>{over && <span className="text-danger">● Vượt: {duration(difference)}</span>}</div>
        <p className="mt-3 border-t border-line/60 pt-3 text-[11px] leading-5 text-muted">Đây là so sánh thời gian, không phải tiến độ hoàn thành hay đánh giá năng suất. Nếu số giờ bất thường, hãy kiểm tra các phiên ghi giờ; đăng xuất không tự dừng timer.</p>
      </div>
    </div>
  </section>;
}

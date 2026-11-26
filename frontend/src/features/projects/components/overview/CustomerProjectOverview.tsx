import type { CustomerProgress } from '../../../workspace/api/workspace.api';
import type { MyProjectItem } from '../../model/project.types';
import { Button } from '../../../../shared/ui/Button';
import { ChatLink } from '../../../messaging/ChatLink';
export function CustomerProjectOverview({
  project,
  progress,
  onNavigate,
}: {
  project: MyProjectItem;
  progress?: CustomerProgress;
  onNavigate: (
    tab: 'milestones' | 'reputation',
  ) => void;
}) {
  const total = progress?.total ?? 0;
  const done = progress?.done ?? 0;
  const percent = total ? Math.round((done / total) * 100) : 0;
  return (
    <section
      className="space-y-5"
      aria-label="Theo dõi dự án dành cho khách hàng"
    >
      <div className="rounded-2xl border border-line bg-surface p-5">
        <p className="text-xs font-semibold text-accent">
          KHÔNG GIAN KHÁCH HÀNG
        </p>
        <h2 className="mt-2 text-xl font-semibold">
          Theo dõi tiến độ và xác nhận bàn giao
        </h2>
        <p className="mt-2 text-sm text-muted">
          Bạn là đại diện khách hàng trong dự án này. Trao đổi với đội, kiểm tra
          sản phẩm bàn giao và gửi phản hồi tại các mốc nghiệm thu.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button onClick={() => onNavigate('milestones')}>
            Xem mốc bàn giao
          </Button>
          <Button kind="secondary" onClick={() => onNavigate('reputation')}>
            Nghiệm thu & đánh giá
          </Button>
          <ChatLink destination={{ kind: 'project', id: project.id }}>
            Trao đổi với đội
          </ChatLink>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          [total, 'Nhiệm vụ trong kế hoạch'],
          [done, 'Nhiệm vụ đã hoàn thành'],
          [total - done, 'Nhiệm vụ còn thực hiện'],
        ].map(([value, label]) => (
          <div
            key={String(label)}
            className="rounded-2xl border border-line bg-surface p-5"
          >
            <p className="text-2xl font-semibold">{value}</p>
            <p className="mt-1 text-xs text-muted">{label}</p>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-line bg-surface p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold">Tiến độ nhiệm vụ</h3>
          <span className="text-sm font-semibold text-accent">{percent}%</span>
        </div>
        <progress
          aria-label="Tiến độ nhiệm vụ"
          value={done}
          max={total || 1}
          className="mt-3 h-2 w-full accent-accent"
        />
        <p className="mt-3 text-sm text-muted">
          {total
            ? 'Kết quả bàn giao được xác nhận riêng tại mốc nghiệm thu.'
            : 'Đội thực hiện đang chuẩn bị kế hoạch công việc cho dự án.'}
        </p>

      </div>
    </section>
  );
}

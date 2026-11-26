import { Badge } from '../../../shared/ui/Badge';
import { Icon } from '../../../shared/ui/Icon';
import { addBusinessDays, businessToday } from '../../../shared/utils/business-date';
import type { TaskStatus } from '../model/task.types';
import { useEffect, useState } from 'react';

export function TaskDeadlineAlert({ task, now, expanded = false }: {
  task: { status: TaskStatus; deadline?: string; acceptedSubmittedAt?: string; acceptedDeadlineOn?: string };
  now?: number; expanded?: boolean;
}) {
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    if (now !== undefined) return;
    const timer = window.setInterval(() => setClock(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, [now]);
  if (!task.deadline || task.status === 'CANCELLED') return null;
  const today = businessToday(now ?? clock);
  const tomorrow = addBusinessDays(today, 1);
  const overdue = task.deadline < today;
  let label = '';
  let explanation = '';
  let danger = false;
  if (overdue && ['TODO', 'IN_PROGRESS', 'BLOCKED'].includes(task.status)) {
    const days = Math.round((Date.parse(today + 'T00:00:00Z') - Date.parse(task.deadline + 'T00:00:00Z')) / 86400000);
    label = `Quá hạn ${days} ngày`; danger = true;
    explanation = `Deadline ${task.deadline} đã qua nhưng nhiệm vụ chưa được gửi chờ duyệt.`;
  } else if (overdue && task.status === 'REVIEW') {
    label = 'Chờ duyệt sau deadline';
    explanation = 'Cần Owner hoặc Manager xem xét kết quả. Đây chưa phải kết luận người phụ trách nộp trễ.';
  } else if (task.status === 'DONE' && task.acceptedSubmittedAt && task.acceptedDeadlineOn && businessToday(Date.parse(task.acceptedSubmittedAt)) > task.acceptedDeadlineOn) {
    label = 'Hoàn thành · Nộp trễ hạn'; danger = true;
    explanation = 'Lần nộp kết quả được chấp nhận diễn ra sau deadline tại thời điểm nộp.';
  } else if (task.deadline === today && ['TODO', 'IN_PROGRESS'].includes(task.status)) {
    label = 'Đến hạn hôm nay'; explanation = 'Hạn thực hiện kết thúc vào cuối ngày hôm nay, theo giờ Việt Nam.';
  } else if (task.deadline === tomorrow && ['TODO', 'IN_PROGRESS'].includes(task.status)) {
    label = 'Sắp đến hạn · Ngày mai'; explanation = 'Còn 1 ngày trước deadline (theo giờ Việt Nam). Hãy chủ động xử lý.';
  }
  if (!label) return null;
  return expanded ? <div role="status" className={`mt-4 flex gap-3 rounded-xl border p-4 ${danger ? 'border-danger/30 bg-danger-soft text-danger' : 'border-warning/30 bg-warning-soft text-warning'}`}><Icon name="alert" /><div><strong className="text-sm">{label}</strong><p className="mt-1 text-xs leading-5">{explanation}</p></div></div>
    : <Badge tone={danger ? 'red' : 'amber'} className="max-w-full whitespace-normal"><Icon name="alert" size={12} />{label}</Badge>;
}

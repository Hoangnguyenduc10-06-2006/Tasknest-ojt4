import type { Task } from '../../tasks';
import { businessToday } from '../../../shared/utils/business-date';

function isBlocked(task: Task) {
  return task.isBlocked || task.status === 'BLOCKED';
}

export function projectHealth(tasks: Task[], now = new Date()) {
  const today = businessToday(now.getTime());
  const active = tasks.filter(task => task.status !== 'DONE' && task.status !== 'CANCELLED');
  const overdue = (task: Task) => Boolean(task.deadline && task.deadline < today);
  const highRisk = (task: Task) => task.decision?.level === 'high';

  const attention = active.flatMap(task => {
    const blocked = isBlocked(task);
    const late = overdue(task);
    const risk = highRisk(task);
    const reasons = [
      ...(blocked ? ['Bị chặn'] : []),
      ...(late ? [task.status === 'REVIEW' ? 'Chờ duyệt quá hạn' : 'Quá hạn thực hiện'] : []),
      ...(risk ? ['Rủi ro cao'] : []),
    ];
    return reasons.length ? [{ task, reasons, order: blocked ? 0 : late ? 1 : 2 }] : [];
  }).sort((a, b) => a.order - b.order ||
    (a.task.deadline ?? '9999').localeCompare(b.task.deadline ?? '9999') ||
    (b.task.decision?.score ?? 0) - (a.task.decision?.score ?? 0));

  return {
    open: active.length,
    overdue: active.filter(overdue).length,
    blocked: active.filter(isBlocked).length,
    risky: active.filter(highRisk).length,
    attention,
  };
}

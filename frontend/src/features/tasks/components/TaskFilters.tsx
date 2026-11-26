import { Icon } from '../../../shared/ui/Icon';
import { taskColumns, statusLabels, type BoardFilters } from '../model/task-board';
import type { TaskAssignee, TaskStatus } from '../model/task.types';

export function TaskFilters({ filters, assignees, onChange, onReset, view, onView }: {
  filters: BoardFilters; assignees: TaskAssignee[];
  onChange: (patch: Partial<BoardFilters>) => void; onReset: () => void;
  view: 'list' | 'kanban' | 'calendar'; onView: (view: 'list' | 'kanban' | 'calendar') => void;
}) {
  return <div className="task-filterbar" aria-label="Bộ lọc nhiệm vụ">
    <label className="task-filter-search"><Icon name="search" size={20} /><input aria-label="Tìm nhiệm vụ" placeholder="Tìm theo tên hoặc mã..." value={filters.search} onChange={e => onChange({ search: e.target.value })} /></label>
    <label className="task-filter-select"><Icon name="filter" /><select aria-label="Lọc người phụ trách" value={filters.assignee} onChange={e => onChange({ assignee: e.target.value })}>
      <option value="ALL">Người phụ trách</option>{assignees.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
    </select></label>
    <label className="task-filter-select"><select aria-label="Lọc trạng thái nhiệm vụ" value={filters.status} onChange={e => onChange({ status: e.target.value as BoardFilters['status'] })}>
      <option value="ALL">Trạng thái</option>{[...taskColumns.map(column => column.status), 'BLOCKED', 'CANCELLED'].map(status => <option key={status} value={status}>{statusLabels[status as TaskStatus]}</option>)}
    </select></label>
    <label className="task-filter-select"><select aria-label="Lọc độ ưu tiên" value={filters.priority} onChange={e => onChange({ priority: e.target.value as BoardFilters['priority'] })}>
      <option value="ALL">Ưu tiên</option><option value="LOW">Thấp</option><option value="MEDIUM">Trung bình</option><option value="HIGH">Cao</option><option value="URGENT">Khẩn cấp</option>
    </select></label>
    <details className="task-filter-date">
      <summary className={filters.todayOnly || filters.fromDate || filters.toDate ? 'text-accent' : ''}>Deadline</summary>
      <div className="task-date-popover">
        <label className="flex items-center gap-2"><input type="checkbox" checked={filters.todayOnly} onChange={e => onChange({ todayOnly: e.target.checked })} />Đến hạn hôm nay</label>
        <label>Từ ngày<input type="date" aria-label="Deadline từ" value={filters.fromDate ?? ''} onChange={e => onChange({ fromDate: e.target.value })} /></label>
        <label>Đến ngày<input type="date" aria-label="Deadline đến" value={filters.toDate ?? ''} onChange={e => onChange({ toDate: e.target.value })} /></label>
        <label>Sắp xếp<select aria-label="Sắp xếp nhiệm vụ" value={filters.sort ?? 'DEADLINE'} onChange={e => onChange({ sort: e.target.value as BoardFilters['sort'] })}><option value="DEADLINE">Deadline</option><option value="PRIORITY">Ưu tiên</option><option value="CREATED">Mới nhất</option><option value="NAME">Tên A–Z</option></select></label>
      </div>
    </details>
    <label className="task-filter-select"><select aria-label="Lọc cảnh báo" value={filters.alert ?? 'ALL'} onChange={e => onChange({ alert: e.target.value as BoardFilters['alert'] })}>
      <option value="ALL">Cảnh báo</option><option value="DUE_SOON">Sắp đến hạn</option><option value="OVERDUE">Quá hạn thực hiện</option><option value="REVIEW_OVERDUE">Chờ duyệt sau deadline</option><option value="RISK">Rủi ro vượt ước tính</option><option value="OVERRUN">Vượt ước tính</option>
    </select></label>
    <button className="task-filter-clear" type="button" onClick={onReset}>Xóa lọc</button>
    <div className="task-filter-view" role="group" aria-label="Chế độ xem">
      {(['list', 'kanban', 'calendar'] as const).map(mode => <button key={mode} type="button" aria-pressed={view === mode} className={view === mode ? 'active' : ''} onClick={() => onView(mode)}><Icon name={mode === 'list' ? 'list' : mode === 'kanban' ? 'board' : 'calendar'} />{mode === 'list' ? 'Danh sách' : mode === 'kanban' ? 'Kanban' : 'Lịch'}</button>)}
    </div>
  </div>;
}

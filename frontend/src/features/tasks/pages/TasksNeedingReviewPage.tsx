import { useState } from 'react';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { Pagination } from '../../../shared/ui/Pagination';
import { UserAvatar } from '../../profile/components/UserAvatar';
import type { MyProjectItem } from '../../projects';
import type { Task } from '../model/task.types';
import { selectTasksNeedingReview } from '../model/task.selectors';
import { TaskPriorityBadge } from '../components/TaskStatusBadge';

export function TasksNeedingReviewPage({ tasks, projects }: { tasks: Task[]; projects: MyProjectItem[] }) {
  const [search, setSearch] = useState('');
  const [projectId, setProjectId] = useState('ALL');
  const [page, setPage] = useState(0);
  const pending = selectTasksNeedingReview(tasks, projects);
  const managed = projects.filter(project => project.status === 'ACTIVE' && ['owner', 'manager'].includes(project.role.toLowerCase()));
  const query = search.trim().toLocaleLowerCase('vi');
  const filtered = pending.filter(task => (projectId === 'ALL' || task.projectId === projectId) && `${task.code} ${task.title} ${task.assignee.name}`.toLocaleLowerCase('vi').includes(query));
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 20) - 1));
  return <main className="page">
    <PageHeader eyebrow="QUẢN LÝ CÔNG VIỆC" title="Nhiệm vụ cần duyệt" description="Kết quả của thành viên trong dự án bạn làm Owner hoặc Manager." />
    <div className="panel my-5 flex flex-wrap items-center gap-3 p-4">
      <label className="field min-w-56 flex-1"><span>Tìm nhiệm vụ</span><input type="search" placeholder="Tên, mã nhiệm vụ hoặc người phụ trách..." value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} /></label>
      <label className="field"><span>Dự án</span><select value={projectId} onChange={event => { setProjectId(event.target.value); setPage(0); }}><option value="ALL">Tất cả dự án quản lý</option>{managed.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
      <span className="text-sm text-muted">{filtered.length} nhiệm vụ cần duyệt</span>
    </div>
    <section className="panel overflow-hidden" aria-label="Danh sách nhiệm vụ cần duyệt">
      {filtered.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-line bg-field text-muted"><tr>{['Nhiệm vụ', 'Dự án', 'Người phụ trách', 'Ưu tiên', ''].map((label, index) => <th key={index} className="p-4 font-medium">{label}</th>)}</tr></thead><tbody>{filtered.slice(currentPage * 20, (currentPage + 1) * 20).map(task => <tr key={task.id} className="border-b border-line last:border-0 hover:bg-field">
        <td className="p-4"><small className="text-muted">{task.code}</small><a className="mt-1 block font-semibold hover:text-accent" href={`/tasks/${task.id}`}>{task.title}</a></td>
        <td className="p-4">{projects.find(project => project.id === task.projectId)?.name}</td>
        <td className="p-4"><span className="flex items-center gap-2"><UserAvatar projectId={task.projectId} userId={task.assignee.id} name={task.assignee.name}/>{task.assignee.name}</span></td>
        <td className="p-4"><TaskPriorityBadge priority={task.priority}/></td>
        <td className="p-4"><a className="whitespace-nowrap font-semibold text-accent hover:underline" href={`/tasks/${task.id}`}>Xem kết quả →</a></td>
      </tr>)}</tbody></table></div> : <div className="p-10 text-center"><h2 className="font-semibold">{pending.length ? 'Không tìm thấy nhiệm vụ phù hợp' : 'Không có nhiệm vụ cần duyệt'}</h2><p className="mt-2 text-sm text-muted">{pending.length ? 'Thử thay đổi từ khóa hoặc bộ lọc dự án.' : 'Nhiệm vụ của thành viên sẽ xuất hiện khi họ gửi kết quả chờ duyệt.'}</p></div>}
      {filtered.length > 0 && <Pagination page={currentPage} total={filtered.length} onChange={setPage}/>}
    </section>
  </main>;
}

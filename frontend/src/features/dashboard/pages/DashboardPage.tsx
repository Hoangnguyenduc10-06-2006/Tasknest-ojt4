import { InlineAiHint, useDashboardAiBrief } from '../../ai';
import { Button } from '../../../shared/ui/Button';
import { ActiveProjectList } from '../components/ActiveProjectList';
import { ActiveTimerCard, type ActiveTimer } from '../../time-tracking';
import { AttentionTaskList } from '../components/AttentionTaskList';
import { TaskStatCards } from '../components/TaskStatCards';
import type { DashboardData } from '../model/dashboard.types';
import { DashboardPanel } from '../components/DashboardPanel';
import { ProjectProgressSummary } from '../components/ProjectProgressSummary';
import { PageHeader } from '../../../shared/ui/PageHeader';

function formatToday(date: Date) {
  const text = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Ho_Chi_Minh' }).format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

type DashboardPageProps = {
  data: DashboardData;
  timer: ActiveTimer | null;
  onCreateTask: () => void;
  onStopTimer: () => void;
};

export function DashboardPage({ data, timer, onCreateTask, onStopTimer }: DashboardPageProps) {
  const ai = useDashboardAiBrief();
  const insights = ai.brief?.insights;
  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-5">
      <PageHeader
        eyebrow={formatToday(new Date())}
        title={`Chào ${data.userName}`}
        description="Theo dõi công việc cá nhân và tiến độ các dự án bạn tham gia."
        actions={<Button icon="plus" onClick={onCreateTask}>Tạo nhiệm vụ</Button>}
      />
      <TaskStatCards stats={data.stats} />
      {timer && <ActiveTimerCard timer={timer} onStop={onStopTimer} />}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <AttentionTaskList tasks={data.attentionTasks} taskHints={insights?.taskHints} />
        <div className="grid min-w-0 gap-5">
          <ProjectProgressSummary projects={data.activeProjects} />
          <ActiveProjectList projects={data.activeProjects} />
        </div>
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-2">
        {[
          { id: 'dashboard-awaiting', title: 'Chờ duyệt', description: 'Nhiệm vụ của bạn đã gửi và đang chờ duyệt.', tasks: data.awaitingTasks, href: '/my-tasks?scope=active&status=awaiting_review' },
          { id: 'dashboard-review', title: 'Cần duyệt', description: 'Nhiệm vụ của người khác trong dự án bạn làm Owner/Manager.', tasks: data.reviewTasks, href: '/tasks-needing-review' },
        ].map(section => (
          <DashboardPanel id={section.id} key={section.id} title={section.title} description={section.description} viewAllHref={section.href}>
            {section.tasks?.length ? (
              <ul className="divide-y divide-line px-5">
                {section.tasks.map(task => (
                  <li key={task.id}>
                    <a className="block py-3 hover:text-accent focus-visible:outline-2 focus-visible:outline-accent" href={`/tasks/${task.id}`}>
                      <strong className="block break-words text-sm">{task.title}</strong>
                      <small className="text-muted">{task.projectName} · {task.assigneeName}</small>
                      <InlineAiHint text={insights?.taskHints[task.id]} />
                    </a>
                  </li>
                ))}
              </ul>
            ) : <p className="px-5 py-6 text-sm text-muted">Không có nhiệm vụ {section.title.toLowerCase()}.</p>}
          </DashboardPanel>
        ))}
      </div>
    </div>
  );
}

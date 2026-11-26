import { Icon } from '../../../shared/ui/Icon';
import { Button } from '../../../shared/ui/Button';
import { formatDuration, type ActiveTimer } from '../model/timer';

export function ActiveTimerCard({ timer, onStop }: { timer: ActiveTimer; onStop: () => void }) {
  const ratio = timer.estimateSeconds > 0 ? Math.min((timer.spentSeconds ?? timer.elapsedSeconds) / timer.estimateSeconds, 1) : 0;
  return <section aria-label="Đang ghi giờ" className="running-card">
    <span className="running-icon"><Icon name="clock" size={24} /></span>
    <div className="running-copy min-w-0">
      <span>ĐANG GHI GIỜ · {timer.taskCode}</span>
      <strong className="truncate">{timer.taskTitle}</strong>
      <small>{timer.projectName}</small>
    </div>
    <div className="running-time"><strong>{formatDuration(timer.elapsedSeconds)}</strong><span>đã dùng / {formatDuration(timer.estimateSeconds)} ước tính</span></div>
    <div className="time-bar" role="progressbar" aria-label="Thời gian đã dùng so với ước tính" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratio * 100)}>
      <span style={{ width: `${ratio * 100}%` }} />
    </div>
    <Button kind="secondary" icon="pause" onClick={onStop}>Dừng</Button>
  </section>;
}

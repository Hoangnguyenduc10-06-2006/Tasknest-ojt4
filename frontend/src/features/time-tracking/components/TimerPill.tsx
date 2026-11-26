import { formatDuration, type ActiveTimer } from '../model/timer';

type TimerPillProps = { timer: ActiveTimer; onStop: () => void };

export function TimerPill({ timer, onStop }: TimerPillProps) {
  return (
    <div className="global-timer">
      <span aria-hidden="true" className="pulse" />
      <span className="font-mono text-xs font-semibold tabular-nums" aria-live="off">{formatDuration(timer.elapsedSeconds)}</span>
      <button type="button" onClick={onStop} aria-label="Dừng ghi giờ" className="inline-flex size-6 items-center justify-center rounded-lg bg-tint text-accent hover:bg-accent-hover hover:text-on-accent focus-visible:outline-2 focus-visible:outline-accent">
        <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2" /></svg>
      </button>
    </div>
  );
}

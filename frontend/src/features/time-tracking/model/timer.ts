export type TimerSession = {
  taskId: string;
  taskCode: string;
  taskTitle: string;
  projectName: string;
  /** UTC epoch milliseconds; map the server timestamp at the API boundary. */
  startedAt: number;
  estimateSeconds: number;
  spentSeconds?: number;
};

export type ActiveTimer = TimerSession & { elapsedSeconds: number };

export function getElapsedSeconds(startedAt: number, now: number) {
  return Math.max(0, Math.floor((now - startedAt) / 1000));
}

export function formatDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((value) => String(value).padStart(2, '0')).join(':');
}

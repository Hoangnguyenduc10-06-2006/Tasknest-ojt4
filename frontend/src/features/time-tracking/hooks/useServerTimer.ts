import { stopTimer as stopServerTimer } from '../api/timer.api';
import { useEffect, useRef, useState } from 'react';
import { useWorkspace } from '../../workspace';
import type { ActiveTimer } from '../model/timer';
export function useServerTimer() {
  const workspace = useWorkspace();
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string>();
  const busy = useRef(false);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const running = workspace.data?.timeEntries.find((entry) => !entry.endedAt);
  const task = workspace.data?.tasks.find(
    (task) => task.id === String(running?.taskId),
  );
  const timer: ActiveTimer | null = running
    ? {
        taskId: String(running.taskId),
        taskCode: `TSK-${running.taskId}`,
        taskTitle: running.taskTitle,
        projectName: running.projectName,
        startedAt: Date.parse(running.startedAt),
        elapsedSeconds: Math.max(
          0,
          Math.floor((now - Date.parse(running.startedAt)) / 1000),
        ),
        spentSeconds: task?.spentHours === undefined ? undefined : task.spentHours * 3600 + Math.max(0, (now - (workspace.loadedAt ?? now)) / 1000),
        estimateSeconds: (task?.estimatedHours ?? 0) * 3600,
      }
    : null;
  const stopTimer = async () => {
    if (!running || !workspace.userId || busy.current) return;
    busy.current = true;
    setError(undefined);
    try {
      await stopServerTimer(workspace.userId, running.projectId, running.id);
      await workspace.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Chưa đồng bộ được thao tác dừng.',
      );
    } finally {
      busy.current = false;
    }
  };
  return { timer, now, error, stopTimer };
}

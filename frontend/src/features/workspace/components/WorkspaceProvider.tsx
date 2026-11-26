import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { readWorkspace, type WorkspaceData } from '../api/workspace.api';

type State = { userId?: string; loadedAt?: number; data?: WorkspaceData; error?: string };
type Context = State & { refresh: () => Promise<void>; loading: boolean };
const WorkspaceContext = createContext<Context | null>(null);
export function WorkspaceProvider({
  userId,
  children,
}: {
  userId?: string;
  children: ReactNode;
}) {
  const [state, setState] = useState<State>({});
  const generation = useRef(0);
  const activeUser = useRef(userId);
  const refresh = useCallback(async () => {
    if (!userId || activeUser.current !== userId) return;
    const request = ++generation.current;
    try {
      const data = await readWorkspace(userId);
      if (generation.current === request && activeUser.current === userId)
        setState({ userId, data, loadedAt: Date.now() });
    } catch (error) {
      if (generation.current === request && activeUser.current === userId)
        setState((previous) => ({
          userId,
          data: previous.userId === userId ? previous.data : undefined,
          loadedAt: previous.userId === userId ? previous.loadedAt : undefined,
          error:
            error instanceof Error ? error.message : 'Không thể tải dữ liệu.',
        }));
    }
  }, [userId]);
  useEffect(() => {
    activeUser.current = userId;
    void refresh();
    const onFocus = () => {
      void refresh();
    };
    window.addEventListener('focus', onFocus);
    window.addEventListener('tasknest:sync', onFocus);
    const interval = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, 30000);
    const cancelPending = () => {
      generation.current++;
      activeUser.current = undefined;
    };
    return () => {
      cancelPending();
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('tasknest:sync', onFocus);
    };
  }, [refresh, userId]);
  const current = state.userId === userId ? state : {};
  return (
    <WorkspaceContext.Provider
      value={{
        ...current,
        userId,
        refresh,
        loading: !current.data && !current.error,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}
// Kept beside the provider so all screens observe the same user-scoped snapshot.
// eslint-disable-next-line react-refresh/only-export-components
export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('WorkspaceProvider is required.');
  return context;
}

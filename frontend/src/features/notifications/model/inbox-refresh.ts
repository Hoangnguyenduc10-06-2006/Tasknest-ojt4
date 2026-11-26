// Apply each response before fetching again. Bursts of realtime events need at
// most one follow-up request and must not continually invalidate useful results.
export function createInboxRefresh(load: () => Promise<void>) {
  let flight: Promise<void> | undefined;
  let pending = false;

  return function refresh(): Promise<void> {
    pending = true;
    if (!flight) {
      flight = (async () => {
        while (pending) {
          pending = false;
          await load();
        }
      })().finally(() => { flight = undefined; });
    }
    return flight;
  };
}

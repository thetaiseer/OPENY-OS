// ============================================================
// OPENY OS – Shared CRUD Utilities
// ============================================================

/**
 * Races a promise against a timeout so that a slow/offline Firestore
 * write never leaves the UI frozen indefinitely.
 *
 * Default: 8 seconds.  Enough for a cold Firestore start on slow
 * connections, but short enough to give the user a clear error quickly.
 */
export function withTimeout<T>(promise: Promise<T>, ms = 8000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Operation timed out after ${ms}ms`)),
      ms
    );
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

/**
 * Runs a secondary side-effect (activity log, notification, cascade clean-up)
 * without blocking the calling operation.  Errors are swallowed to avoid
 * unhandled-rejection warnings – callers must never depend on the result.
 */
export function fireAndForget(promise: Promise<unknown>): void {
  promise.catch((err) => console.error("[OPENY] Side-effect error:", err));
}

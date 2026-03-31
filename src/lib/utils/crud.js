 function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }// ============================================================
// OPENY OS – Shared CRUD Utilities
// ============================================================

/**
 * Races a promise against a timeout so that a slow/offline Firestore
 * write never leaves the UI frozen indefinitely.
 *
 * Default: 10 seconds.  Enough for a cold Firestore start on slow
 * connections, but short enough to give the user a clear error quickly.
 */
export function withTimeout(promise, ms = 10000) {
  return new Promise((resolve, reject) => {
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
export function fireAndForget(promise) {
  promise.catch((err) => console.error("[OPENY] Side-effect error:", err));
}

/**
 * Converts a raw Firestore / Firebase error (or any caught value) into a
 * human-readable message in the requested language.
 *
 * Handles:
 *  - Our own withTimeout() timeout errors
 *  - Firebase SDK error codes (permission-denied, unavailable, …)
 *  - Generic JS Error messages
 *  - Unknown / non-Error thrown values
 */
export function parseFirestoreError(err, isAr = false) {
  if (!err) return isAr ? "خطأ غير معروف" : "Unknown error";

  const msg = err instanceof Error ? err.message : String(err);

  // ── Timeout (from withTimeout) ────────────────────────────
  if (msg.toLowerCase().includes("timed out") || msg.toLowerCase().includes("timeout")) {
    return isAr
      ? "انتهت مهلة العملية — تحقق من اتصالك بالإنترنت وأعد المحاولة"
      : "Operation timed out — check your internet connection and try again";
  }

  // ── Firebase SDK error codes ──────────────────────────────
  const code = _optionalChain([(err ), 'optionalAccess', _ => _.code]) ;

  if (code === "permission-denied") {
    return isAr
      ? "رُفض الإذن — تواصل مع مسؤول النظام"
      : "Permission denied — contact your workspace admin";
  }
  if (code === "unauthenticated") {
    return isAr
      ? "غير مصادق — يرجى تسجيل الدخول مجدداً"
      : "Not authenticated — please sign in again";
  }
  if (code === "unavailable" || code === "resource-exhausted") {
    return isAr
      ? "الخدمة غير متاحة مؤقتاً — تحقق من الاتصال وأعد المحاولة"
      : "Service temporarily unavailable — check your connection and retry";
  }
  if (code === "not-found") {
    return isAr
      ? "السجل غير موجود — ربما تم حذفه مسبقاً"
      : "Record not found — it may have been deleted already";
  }
  if (code === "invalid-argument") {
    return isAr
      ? "بيانات غير صالحة — تحقق من المدخلات وأعد المحاولة"
      : "Invalid data — check your inputs and try again";
  }
  if (code === "already-exists") {
    return isAr ? "هذا السجل موجود بالفعل" : "Record already exists";
  }
  if (code === "deadline-exceeded") {
    return isAr
      ? "انتهت المهلة — تحقق من الاتصال وأعد المحاولة"
      : "Deadline exceeded — check your connection and retry";
  }
  if (code === "failed-precondition") {
    return isAr
      ? "مسار قاعدة البيانات مفقود — تحقق من إعداد Firestore"
      : "Invalid Firestore path — check database setup";
  }
  if (code === "internal") {
    return isAr ? "خطأ داخلي في الخادم" : "Internal server error";
  }
  if (code === "cancelled") {
    return isAr ? "تم إلغاء العملية" : "Operation was cancelled";
  }

  // ── Network / offline ─────────────────────────────────────
  const lower = msg.toLowerCase();
  if (
    lower.includes("network") ||
    lower.includes("offline") ||
    lower.includes("failed to fetch") ||
    lower.includes("net::err")
  ) {
    return isAr
      ? "خطأ في الشبكة — تحقق من اتصالك بالإنترنت"
      : "Network error — check your internet connection";
  }

  // ── Missing workspace / collection path ───────────────────
  if (lower.includes("workspaces") || lower.includes("missing or insufficient")) {
    return isAr
      ? "مساحة العمل غير موجودة أو لا يوجد إذن للوصول إليها"
      : "Workspace missing or access denied";
  }

  // ── Return raw message if it is short and readable ────────
  if (msg && msg !== "[object Object]" && msg.length < 200) {
    return msg;
  }

  return isAr ? "خطأ غير معروف في الخادم" : "Unknown server error";
}

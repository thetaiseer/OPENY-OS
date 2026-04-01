// ============================================================
// OPENY OS – Firebase (re-export from canonical client entry)
// The single source of truth for frontend Firebase usage is
// src/lib/firebase/client.ts — this file simply re-exports
// everything so that existing imports (@/lib/firebase) continue
// to work without any changes.
// ============================================================
export {
  DEFAULT_WORKSPACE_ID,
  db,
  auth,
  wsCol,
  getAnalyticsInstance,
  FCM_VAPID_KEY,
  getFCMToken,
  requestPushPermission,
  default,
} from "./firebase/client";

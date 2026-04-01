# Firebase Integration — OPENY OS

This document describes how Firebase services are integrated into the OPENY OS Next.js application.

---

## 1. Firebase Services Used

| Service | Purpose |
|---------|---------|
| **Firestore** | Primary real-time database for all business data |
| **Firebase Authentication** | Email/password sign-in and session management |
| **Cloud Messaging (FCM)** | Web push notifications |
| **Google Analytics** | Client-side usage tracking |
| **Trigger Email Extension** | Sends emails via the `mail` root collection |

**Project:** `openy-suite`  
**Config file:** `src/lib/firebase.ts`  
**Deployment files:** `firebase.json`, `.firebaserc`, `firestore.rules`, `firestore.indexes.json`

---

## 2. Initialization & Configuration

**File:** `src/lib/firebase.ts`

Firebase is initialised once per process and shared across the entire app:

```ts
// Prevent duplicate initialisation across Next.js hot-reloads / SSR
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// In-memory cache: writes resolve immediately without waiting for server ACK.
// Eliminates cross-tab IndexedDB lock hangs; server sync happens in background.
export const db = initializeFirestore(app, { localCache: memoryLocalCache() });
export const auth = getAuth(app);
```

### Workspace scope

All business data lives under a single fixed workspace path so every device sees the same shared data:

```ts
export const DEFAULT_WORKSPACE_ID = "main";

// Usage: wsCol("clients") → collection(db, "workspaces", "main", "clients")
export function wsCol(collectionName: string) {
  return collection(db, "workspaces", DEFAULT_WORKSPACE_ID, collectionName);
}
```

Use `wsCol()` everywhere instead of calling `collection(db, name)` directly.

---

## 3. Firestore Data Schema

### Workspace collections (`workspaces/main/{collection}`)

| Collection | Key fields | Purpose |
|---|---|---|
| `clients` | `name`, `email`, `phone`, `website`, `createdAt`, `updatedAt` | Client / company records |
| `team` | `name`, `email`, `teamRole`, `uid`, `createdAt` | Team members and roles |
| `tasks` | `clientId`, `title`, `status`, `assigneeId`, `scheduledYear`, `scheduledMonth`, `createdAt` | One-time and recurring task instances |
| `contentItems` | `clientId`, `title`, `platform`, `status`, `priority`, `scheduledDate`, `approvalStatus`, `publishedAt`, `createdAt` | Social / marketing content items |
| `approvals` | `contentItemId`, `clientId`, `status`, `assignedTo`, `internalComments[]`, `clientComments[]`, `createdAt` | Content approval workflows |
| `assets` | `clientId`, `name`, `type`, `fileUrl`, `thumbnailUrl`, `fileSize`, `format`, `tags`, `folder`, `uploadedBy`, `createdAt` | Media files (images, videos) |
| `activities` | `type`, `message`, `detail`, `entityId`, `clientId`, `timestamp` | Audit log / activity stream |
| `notifications` | `type`, `title`, `message`, `entityId`, `userId`, `isRead`, `createdAt` | In-app user notifications |
| `invitations` | `email`, `token`, `createdAt` | Pending team-member invitations |
| `calendarEvents` | `clientId`, `title`, `startAt`, `endAt`, `createdAt` | Calendar entries |
| `bankEntries` | financial fields | Accounting / bank transaction records |
| `clientNotes` | `clientId`, `content`, `createdAt` | Free-form client notes |
| `publishingEvents` | `contentItemId`, `scheduledAt`, `status`, `updatedAt` | Scheduled publish queue |
| `publishingFailures` | `contentItemId`, `error`, `createdAt` | Publishing error log |
| `recurringTaskTemplates` | `isActive`, `createdAt` | Recurring task template definitions |
| `userPreferences` | `uid`, `language`, `theme` | Per-user UI preferences (synced across devices) |
| `userNotificationPreferences` | `userId`, notification settings | Per-user notification opt-ins |

### Client subcollections (`workspaces/main/clients/{clientId}/…`)

| Subcollection | Key fields | Purpose |
|---|---|---|
| `contracts` | `title`, `fileUrl`, `storagePath`, `startDate`, `endDate`, `status`, `uploadedBy`, `createdAt` | Contracts linked to a client |
| `assets` | Same as root `assets` | Assets linked to a specific client |
| `notes` | `content`, `createdAt` | Notes linked to a specific client |

### Root-level system collections (not workspace-scoped)

| Collection | Purpose |
|---|---|
| `fcmTokens` | Web push tokens registered by `requestPushPermission()` |
| `mail` | Managed by the Trigger Email Firebase Extension |
| `users` | Root user profiles (document ID = Firebase Auth UID) |

---

## 4. Authentication

**File:** `src/lib/AuthContext.tsx`

### Sign-in method

Email and password via `signInWithEmailAndPassword()`. No social or multi-factor auth is currently configured.

### Auth flow

1. `onAuthStateChanged` fires → `user` (Firebase Auth user) is set.
2. The team member document is fetched from `workspaces/main/team` where `email == user.email`.
3. The `member` object (including `teamRole`) and derived boolean helpers are exposed through the context.

### Context API

```ts
const {
  user,              // Firebase Auth user object
  member,            // TeamMember document from Firestore
  role,              // "admin" | "account_manager" | "creative"
  loading,           // boolean — true while auth state is resolving
  isAdmin,
  isAccountManager,
  isCreative,
  signIn,            // (email: string, password: string) => Promise<void>
  signOut,           // () => Promise<void>
} = useAuth();
```

### Roles

Roles are stored as the `teamRole` field on the team member document.

| Role | Description |
|---|---|
| `admin` | Full system access |
| `account_manager` | Client and task management |
| `creative` | Content creation and approval |

---

## 5. Firestore Security Rules

**File:** `firestore.rules`

> ⚠️ **The current rules allow open read/write access (`if true`). This is intentional for development only. Proper role-based rules must be applied before a production deployment.**

The only scoped rule today is `userPreferences`, which is restricted to the authenticated user's own document:

```js
match /workspaces/{workspaceId}/userPreferences/{docId} {
  allow read, write: if request.auth != null && request.auth.uid == docId;
}
```

**Deploy rules and indexes:**

```bash
firebase deploy --only firestore
```

---

## 6. Firestore Indexes

**File:** `firestore.indexes.json`

17 composite indexes are defined for the most common query patterns.

| Collection | Indexed fields | Query purpose |
|---|---|---|
| `contentItems` | `clientId`, `createdAt` DESC | Client content sorted by date |
| `contentItems` | `clientId`, `scheduledDate` ASC | Upcoming content by client |
| `contentItems` | `platform`, `publishStatus` ASC | Content by platform and status |
| `approvals` | `clientId`, `createdAt` DESC | Client approvals by date |
| `approvals` | `status`, `dueDate` ASC | Approvals by status and due date |
| `tasks` | `clientId`, `scheduledYear`, `scheduledMonth` | Tasks by month |
| `tasks` | `assigneeId`, `status` ASC | Tasks assigned to a user |
| `notifications` | `userId`, `createdAt` DESC | User notifications by date |
| `calendarEvents` | `clientId`, `startAt` ASC | Client calendar events |
| `recurringTaskTemplates` | `isActive`, `createdAt` DESC | Active recurring templates |

All indexes use `COLLECTION_GROUP` scope.

---

## 7. Firestore Service Layer

**Directory:** `src/lib/firestore/`

Each file exposes subscribe, create, update, and delete functions for one collection. Contexts import from this layer; they never call the Firestore SDK directly.

```
activities.ts        approvals.ts       assets.ts
bankEntries.ts       calendarEvents.ts  clientNotes.ts
clients.ts           content.ts         contentVersions.ts
contracts.ts         invitations.ts     notifications.ts
publishing.ts        recurringTasks.ts  tasks.ts
team.ts              userPreferences.ts workspace.ts
```

### Standard pattern

```ts
// Real-time subscription
export function subscribeToClients(callback, onError?) {
  const q = query(wsCol("clients"), orderBy("createdAt", "desc"));
  return onSnapshot(q,
    (snap) => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    (err)  => onError?.(err),
  );
}

// Create
export async function createClient(payload) {
  return (await addDoc(wsCol("clients"), payload)).id;
}

// Update
export async function updateClient(id, payload) {
  await updateDoc(doc(db, "workspaces", "main", "clients", id), payload);
}

// Delete
export async function deleteClient(id) {
  await deleteDoc(doc(db, "workspaces", "main", "clients", id));
}
```

Debug log lines use the `[OPENY:{collection}]` prefix and are emitted only in development.

---

## 8. CRUD Utilities

**File:** `src/lib/utils/crud.ts`

### `withTimeout<T>(promise, ms = 10_000)`

Races any Firestore operation against a 10-second timeout. Prevents the UI from hanging on slow or offline connections. All context CRUD calls must wrap Firestore operations with this helper.

### `fireAndForget(promise)`

For secondary side effects (activity logs, notification triggers) where errors should not surface to the user. Errors are caught and logged silently.

### `parseFirestoreError(err, isAr?)`

Converts Firebase error codes into human-readable English or Arabic messages. Handles `permission-denied`, `unauthenticated`, `unavailable`, `not-found`, and others.

### Batch writes

Used for bulk deletes (e.g. clearing activities). Up to 500 operations per `writeBatch` commit.

---

## 9. Real-Time Sync

All contexts subscribe to Firestore collections via `onSnapshot`. The in-memory local cache means:

- **Writes resolve immediately** from the local cache (no waiting for server ACK).
- **Reads** receive the cached version first, then server updates as they arrive.
- **Offline** — the local cache persists for the lifetime of the page; writes are queued and synced when the connection is restored.

---

## 10. Cloud Messaging (Push Notifications)

**Functions exposed from `src/lib/firebase.ts`:**

```ts
// Prompt the browser for permission and store the FCM token in Firestore
await requestPushPermission();
// → stores { token, createdAt, userAgent } under fcmTokens/{auto-id}

// Retrieve the current FCM token (for use in cloud functions / server sends)
const token = await getFCMToken();
```

The VAPID public key (`FCM_VAPID_KEY`) is defined in `firebase.ts`. It was generated in the Firebase console under **Project Settings → Cloud Messaging → Web Push certificates**.

---

## 11. Analytics

Analytics is lazy-loaded on the client to avoid SSR errors and bundle size impact:

```ts
const analytics = await getAnalyticsInstance();
// Returns null on the server or when window is unavailable.
```

---

## 12. Deployment

```bash
# Install Firebase CLI (once)
npm install -g firebase-tools

# Authenticate
firebase login

# Deploy Firestore rules and indexes
firebase deploy --only firestore

# Deploy all configured targets (rules, indexes, hosting, functions, etc.)
firebase deploy
```

The default project (`openy-suite`) is defined in `.firebaserc`.

---

## 13. Key Conventions

| Convention | Detail |
|---|---|
| **Workspace scope** | All business data lives under `workspaces/main/` |
| **Helper** | Always use `wsCol("name")` instead of `collection(db, "name")` |
| **Timestamps** | `createdAt` / `updatedAt` are ISO 8601 strings |
| **Document IDs** | Auto-generated by Firestore, except `userPreferences/{uid}` and `users/{uid}` |
| **Denormalisation** | `clientId` is repeated in nested documents to enable compound index queries |
| **Timeout protection** | Wrap every Firestore operation in `withTimeout()` |
| **Side effects** | Use `fireAndForget()` for activity logs and notification writes |
| **Error messages** | Use `parseFirestoreError()` for bilingual (EN/AR) user-facing messages |

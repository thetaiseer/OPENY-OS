# OPENY OS

Premium Operations Management System built with **Next.js 16**, **Firebase Firestore**, and **Firebase Auth**.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Local Setup](#2-local-setup)
3. [Firebase Project Setup](#3-firebase-project-setup)
4. [Deploy Firestore Rules & Indexes](#4-deploy-firestore-rules--indexes)
5. [Deploy to Firebase Hosting](#5-deploy-to-firebase-hosting)
6. [Deploy to Vercel (alternative)](#6-deploy-to-vercel-alternative)
7. [Architecture Overview](#7-architecture-overview)
8. [Firestore Data Structure](#8-firestore-data-structure)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 18 |
| npm | ≥ 9 |
| Firebase CLI | ≥ 13 |

Install the Firebase CLI globally:

```bash
npm install -g firebase-tools
```

---

## 2. Local Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy the environment template
cp .env.example .env.local

# 3. Fill in your Firebase project values in .env.local
#    (see Section 3 for where to find them)

# 4. Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## 3. Firebase Project Setup

### 3.1 Get your Firebase config

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project (`openy-suite`)
3. Click the gear icon → **Project settings** → **General**
4. Scroll to **Your apps** → click your web app → **Config**
5. Copy the values into `.env.local`:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=openy-suite.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=openy-suite
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=openy-suite.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XXXXXXX
```

### 3.2 Enable Firestore

Firebase Console → **Firestore Database** → **Create database** → choose **Production mode** → pick a region.

### 3.3 Enable Authentication

Firebase Console → **Authentication** → **Sign-in method** → enable **Email/Password**.

---

## 4. Deploy Firestore Rules & Indexes

```bash
# Login once
firebase login

# Deploy rules + composite indexes
npm run firebase:deploy:firestore
```

This deploys `firestore.rules` (open read/write for now — **⚠️ tighten before any production use; current rules allow unauthenticated writes to all collections**) and `firestore.indexes.json` (composite indexes required by the app's queries).

---

## 5. Deploy to Firebase Hosting

OPENY OS uses **Next.js web-frameworks support** in the Firebase CLI, which automatically detects Next.js, runs `next build`, and deploys:

- Static pages → Firebase CDN
- Server-rendered (dynamic) routes → Cloud Functions (Blaze plan required)

### 5.1 One-time setup

```bash
firebase login
firebase experiments:enable webframeworks
```

### 5.2 Deploy

```bash
npm run firebase:deploy:hosting
```

Your app will be live at:

- `https://openy-os.web.app`
- `https://openy-os.firebaseapp.com`

### 5.3 Full deploy (hosting + firestore)

```bash
npm run firebase:deploy
```

> **Note:** Cloud Functions (required for SSR routes like `/clients/[id]`) need the **Blaze (pay-as-you-go) plan**.  
> If you are on the Spark (free) plan, deploy to **Vercel** instead (Section 6).

---

## 6. Deploy to Vercel (alternative)

Vercel natively supports Next.js and requires **no Blaze plan**.

1. Push the repo to GitHub.
2. Go to [vercel.com](https://vercel.com) → **New Project** → import the repo.
3. Add the following **Environment Variables** in the Vercel dashboard:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | your value |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | your value |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | your value |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | your value |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | your value |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | your value |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | your value (optional) |

4. Click **Deploy**. Vercel runs `npm run build` automatically.

---

## 7. Architecture Overview

```
src/
├── app/                   # Next.js App Router pages
│   ├── clients/           # /clients  (list) + /clients/[id]/* (detail tabs)
│   ├── tasks/             # /tasks
│   ├── content/           # /content
│   ├── approvals/         # /approvals
│   ├── assets/            # /assets
│   └── ...
├── components/
│   ├── layout/            # AppShell, SideNav, TopBar, WorkspaceBootstrap
│   └── ui/                # Modal forms (AddClientModal, AddTaskModal, …)
└── lib/
    ├── firebase/
    │   └── client.ts      # Single Firebase initialisation + wsCol() helper
    ├── firebase.ts        # Re-export from firebase/client.ts
    ├── firestore/         # One file per collection (subscribe/create/update/delete)
    │   ├── clients.ts
    │   ├── tasks.ts
    │   ├── content.ts
    │   └── ...
    ├── AppContext.tsx      # Clients, Tasks, Team — real-time via onSnapshot
    ├── ContentContext.tsx  # Content items
    ├── AuthContext.tsx     # Firebase Auth + role-based access
    └── utils/crud.ts      # withTimeout(), fireAndForget(), parseFirestoreError()
```

**Key rule:** every Firestore call goes through `src/lib/firestore/<collection>.ts`.  
Never call `addDoc` / `getDocs` / `onSnapshot` directly from a page or component.

---

## 8. Firestore Data Structure

All business data lives under a single workspace path so every device sees the same data:

```
workspaces/
└── main/
    ├── clients/{clientId}
    │   ├── assets/{assetId}
    │   ├── contracts/{contractId}
    │   └── notes/{noteId}
    ├── tasks/{taskId}
    ├── contentItems/{contentItemId}
    │   ├── comments/{commentId}
    │   └── versions/{versionId}
    ├── approvals/{approvalId}
    ├── assets/{assetId}
    ├── team/{memberId}
    ├── activities/{activityId}
    ├── notifications/{notificationId}
    ├── invitations/{invitationId}
    ├── calendarEvents/{eventId}
    ├── bankEntries/{entryId}
    ├── clientNotes/{noteId}
    ├── publishingEvents/{eventId}
    ├── publishingFailures/{failureId}
    ├── recurringTaskTemplates/{templateId}
    ├── userPreferences/{uid}
    └── userNotificationPreferences/{userId}

# Root-level (not workspace-scoped)
users/{uid}
fcmTokens/{tokenId}
mail/{mailId}
```

---

## 9. Troubleshooting

### `/clients` page is blank or crashes

**Cause:** Firebase environment variables are missing or incorrect.

**Fix:**
1. Make sure `.env.local` exists and all `NEXT_PUBLIC_FIREBASE_*` values are filled in.
2. Restart the dev server (`npm run dev`).
3. Open the browser console — look for `[OPENY:firebase] Auth initialisation failed` or `[OPENY:clients] snapshot error`.

### "Waiting for your first release" on Firebase Hosting

**Cause:** `firebase deploy --only hosting` was never run.

**Fix:**
```bash
firebase login
firebase experiments:enable webframeworks
npm run firebase:deploy:hosting
```

### Data doesn't appear on another device

**Cause:** Firestore rules not deployed, or wrong `projectId` in `.env.local`.

**Fix:**
```bash
npm run firebase:deploy:rules
```
Then verify `NEXT_PUBLIC_FIREBASE_PROJECT_ID` matches your actual Firebase project ID.

### `permission-denied` errors in console

**Cause:** Firestore rules block the request (only affects `userPreferences` which requires auth).

**Fix:** Sign in via the `/login` page first. All other collections allow open access in the current rules.

### `withTimeout` fires and buttons stay in loading state

**Cause:** Firestore write timed out (usually a network or missing-project issue).

**Fix:** Check the browser console for the underlying Firebase error.

# OPENY OS

A modern agency workspace built with **Next.js 15**, **React 18**, **TypeScript**, **Tailwind CSS**, **Supabase**, and **Google Drive** storage.

## Real Architecture

| Layer | Technology |
|-------|-----------|
| Database | [Supabase](https://supabase.com) (PostgreSQL) |
| Auth | Supabase Auth (email + password) |
| Storage | Google Drive via OAuth 2.0 (active provider) |
| Sync | Google Drive → Supabase sync routes |
| AI | OpenAI GPT-4o-mini / Google Gemini (fallback) |
| Deployment | Vercel |

The storage layer uses a provider abstraction (`src/lib/storage/`) so additional providers (OneDrive, S3, local) can be added later without changing any page or route.

## OPENY Command Center Foundation (Bootstrap)

Initial architecture for the bespoke Marketing Agency Command Center is now scaffolded in:

- `src/features/command-center/domain.ts` — strict TypeScript domain contracts for:
  - **Pipeline** (Kanban columns, deadline state, workload indicator)
  - **Vault** (R2-linked asset metadata + multipart upload state)
  - **Radar** (owner dashboard snapshot contract)
- `prisma/schema.prisma` — ORM-level schema outline for core entities:
  - `User`
  - `Task`
  - `Asset`

This gives a typed foundation for implementing:

1. Drag-and-drop Pipeline states (`todo`, `in_progress`, `review`, `client_approved`)
2. 48h deadline warning and overdue state logic
3. Workload-aware task assignment
4. R2 multipart upload lifecycle persistence
5. Radar analytics aggregation contracts

## Quick Setup

1. Install dependencies:
   ```bash
   npm install --legacy-peer-deps
   ```

2. Copy the environment template and fill in your values:
   ```bash
   cp .env.example .env.local
   ```

3. Run the Supabase migrations in order (use the SQL Editor in your Supabase dashboard):
   - `supabase-schema.sql` — base schema
   - `supabase-migration-*.sql` files — incremental additions

4. Start the development server:
   ```bash
   npm run dev
   ```

## Environment Variables

See `.env.example` for the full list. Required groups:

- **Supabase** — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **Google Drive** — `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REFRESH_TOKEN`, `GOOGLE_DRIVE_FOLDER_ID`
- **Storage Provider** — `STORAGE_PROVIDER=google-drive` (default; set to switch providers in the future)

## Database Schema (Supabase)

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles with roles (`admin`, `manager`, `team`, `client`) |
| `clients` | Client records |
| `tasks` | Task lifecycle (todo → in_progress → review → done → delivered) |
| `assets` | File metadata (provider, remote IDs, preview URLs, …) |
| `activities` | Audit log |
| `automation_rules` | Trigger-based automations |
| `drive_sync_logs` | Google Drive ↔ DB sync history |
| `user_sessions` | Active session tracking |

## Assets Schema

The `assets` table stores provider-agnostic metadata:

| Column | Description |
|--------|-------------|
| `storage_provider` | `'google_drive'` (or future providers) |
| `drive_file_id` | Remote file ID |
| `drive_folder_id` | Remote folder ID |
| `preview_url` | Inline preview URL |
| `thumbnail_url` | Thumbnail URL |
| `download_url` | Direct download URL |
| `web_view_link` | Provider view link |
| `mime_type` | MIME type |
| `file_size` | Size in bytes |
| `client_id` | FK → clients |
| `month_key` | `YYYY-MM` (folder routing) |
| `content_type` | `SOCIAL_POSTS`, `VIDEOS`, etc. |

## Storage Provider Architecture

```
src/lib/storage/
  index.ts                  — public exports
  types.ts                  — StorageProvider interface + RemoteFileMeta
  factory.ts                — getStorageProvider() (reads STORAGE_PROVIDER env)
  google-drive-provider.ts  — GoogleDriveProvider implementation
```

Routes call `getStorageProvider()` — they never import from `google-drive.ts` directly. Adding a new provider only requires:

1. Implementing `StorageProvider` in a new `*-provider.ts` file.
2. Adding a `case` in `factory.ts`.
3. Setting `STORAGE_PROVIDER=<name>` in the environment.

## Stack

- Next.js 15.5
- React 18
- TypeScript 5
- Tailwind CSS v3
- Supabase (PostgreSQL + Auth)
- Google Drive API (googleapis)
- TanStack Query v5
- Recharts

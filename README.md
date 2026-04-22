# OPENY OS

A modern agency workspace built with **Next.js 15**, **React 18**, **TypeScript**, **Tailwind CSS**, **Supabase**, and **Cloudflare R2** storage.

## Real Architecture

| Layer | Technology |
|-------|-----------|
| Database | [Supabase](https://supabase.com) (PostgreSQL) |
| Auth | Supabase Auth (email + password) |
| Storage | Cloudflare R2 (unified) |
| Sync | API-driven storage + metadata persistence |
| AI | OpenAI GPT-4o-mini / Google Gemini (fallback) |
| Deployment | Vercel |

The storage layer is unified through `src/lib/storage/` and uses a single root prefix:

`openy-assets/os/...` and `openy-assets/docs/...`

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
- **Cloudflare R2** — `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`

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

## Storage Architecture

```
src/lib/storage/
  index.ts        — public exports
  path-builder.ts — deterministic path builder for `openy-assets/os|docs/...`
  service.ts      — shared upload/delete/url/list/move/multipart operations
  metadata.ts     — shared metadata persistence (`stored_files`)
```

## Stack

- Next.js 15.5
- React 18
- TypeScript 5
- Tailwind CSS v3
- Supabase (PostgreSQL + Auth)
- Google Drive API (googleapis)
- TanStack Query v5
- Recharts

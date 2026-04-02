# OPENY OS

A modern SaaS workspace built with Next.js 15, React 18, TypeScript, Tailwind CSS, and PocketBase.

## Setup

1. Install dependencies: `npm install --legacy-peer-deps`
2. Download and run PocketBase from https://pocketbase.io
3. Create `.env.local`:
   ```
   NEXT_PUBLIC_POCKETBASE_URL=http://127.0.0.1:8090
   ```
4. Run: `npm run dev`

## PocketBase Collections

Create these collections in your PocketBase admin panel:

- **users** (auth collection — built-in)
- **clients**: name, email, phone, website, industry, status (select: active/inactive/prospect), logo (file), notes
- **tasks**: title, description, status (select: todo/in_progress/done/overdue), priority (select: low/medium/high), due_date (date), client (relation→clients), assigned_to (relation→users)
- **content**: title, platform, status (select: draft/scheduled/published), schedule_date (date), client (relation→clients)
- **assets**: file (file), name, client (relation→clients)
- **approvals**: status (select: pending/approved/rejected), notes, content (relation→content)
- **activities**: type, description, user (relation→users), client (relation→clients)

## Stack

- Next.js 15.5.14
- React 18
- TypeScript
- Tailwind CSS v3
- PocketBase

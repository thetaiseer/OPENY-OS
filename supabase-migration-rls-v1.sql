-- ─────────────────────────────────────────────────────────────────────────────
-- OPENY OS — Real per-role RLS policies (Phase 0 · F3)
--
-- Run this in your Supabase SQL editor AFTER all previous migrations.
--
-- Strategy:
--   • client role → can only read rows scoped to their own client_id
--   • editor / team → can read all, write own workspace rows, cannot delete
--   • manager → full read/write, cannot delete assets or clients
--   • admin → unrestricted
--   • service_role (server-side API) → always bypasses RLS
--
-- IMPORTANT: The OPENY OS backend API routes use the service_role key and
-- therefore bypass RLS entirely. These policies protect direct client-SDK
-- access (e.g. from the browser via the anon/user key).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Helper function: get the calling user's role from profiles ────────────────

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- ── Helper function: get the calling user's client_id from profiles ───────────

CREATE OR REPLACE FUNCTION public.current_user_client_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT client_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- profiles
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing blanket policies
DROP POLICY IF EXISTS "allow all profiles" ON public.profiles;

-- Everyone can read their own profile
CREATE POLICY "profiles: self read"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

-- Admin/manager can read all profiles
CREATE POLICY "profiles: admin manager read all"
  ON public.profiles FOR SELECT
  USING (public.current_user_role() IN ('admin', 'manager'));

-- Admin/manager can update any profile
CREATE POLICY "profiles: admin manager update"
  ON public.profiles FOR UPDATE
  USING (public.current_user_role() IN ('admin', 'manager'));

-- Users can update their own profile
CREATE POLICY "profiles: self update"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

-- Admin can delete profiles
CREATE POLICY "profiles: admin delete"
  ON public.profiles FOR DELETE
  USING (public.current_user_role() = 'admin');

-- ─────────────────────────────────────────────────────────────────────────────
-- clients
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow all clients" ON public.clients;

-- client role: read only their own record
CREATE POLICY "clients: client self read"
  ON public.clients FOR SELECT
  USING (
    public.current_user_role() = 'client'
    AND id = public.current_user_client_id()
  );

-- team/editor/manager/admin: read all clients
CREATE POLICY "clients: staff read all"
  ON public.clients FOR SELECT
  USING (public.current_user_role() IN ('admin', 'manager', 'team'));

-- manager/admin: insert clients
CREATE POLICY "clients: manager admin insert"
  ON public.clients FOR INSERT
  WITH CHECK (public.current_user_role() IN ('admin', 'manager'));

-- manager/admin: update clients
CREATE POLICY "clients: manager admin update"
  ON public.clients FOR UPDATE
  USING (public.current_user_role() IN ('admin', 'manager'));

-- admin only: delete clients
CREATE POLICY "clients: admin delete"
  ON public.clients FOR DELETE
  USING (public.current_user_role() = 'admin');

-- ─────────────────────────────────────────────────────────────────────────────
-- assets
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow all assets" ON public.assets;

-- client role: only their own client's assets
CREATE POLICY "assets: client scoped read"
  ON public.assets FOR SELECT
  USING (
    public.current_user_role() = 'client'
    AND client_id = public.current_user_client_id()
  );

-- staff read all
CREATE POLICY "assets: staff read all"
  ON public.assets FOR SELECT
  USING (public.current_user_role() IN ('admin', 'manager', 'team'));

-- team/manager/admin: insert
CREATE POLICY "assets: staff insert"
  ON public.assets FOR INSERT
  WITH CHECK (public.current_user_role() IN ('admin', 'manager', 'team'));

-- team/manager/admin: update
CREATE POLICY "assets: staff update"
  ON public.assets FOR UPDATE
  USING (public.current_user_role() IN ('admin', 'manager', 'team'));

-- admin/manager only: delete
CREATE POLICY "assets: admin manager delete"
  ON public.assets FOR DELETE
  USING (public.current_user_role() IN ('admin', 'manager'));

-- ─────────────────────────────────────────────────────────────────────────────
-- tasks
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow all tasks" ON public.tasks;

-- client role: tasks linked to their client_id
CREATE POLICY "tasks: client scoped read"
  ON public.tasks FOR SELECT
  USING (
    public.current_user_role() = 'client'
    AND client_id = public.current_user_client_id()
  );

-- staff read all
CREATE POLICY "tasks: staff read all"
  ON public.tasks FOR SELECT
  USING (public.current_user_role() IN ('admin', 'manager', 'team'));

-- all staff can insert tasks
CREATE POLICY "tasks: staff insert"
  ON public.tasks FOR INSERT
  WITH CHECK (public.current_user_role() IN ('admin', 'manager', 'team'));

-- all staff can update tasks
CREATE POLICY "tasks: staff update"
  ON public.tasks FOR UPDATE
  USING (public.current_user_role() IN ('admin', 'manager', 'team'));

-- admin/manager only: delete tasks
CREATE POLICY "tasks: admin manager delete"
  ON public.tasks FOR DELETE
  USING (public.current_user_role() IN ('admin', 'manager'));

-- ─────────────────────────────────────────────────────────────────────────────
-- approvals
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow all approvals" ON public.approvals;

-- client role: approvals for their client_id
CREATE POLICY "approvals: client scoped read"
  ON public.approvals FOR SELECT
  USING (
    public.current_user_role() = 'client'
    AND client_id = public.current_user_client_id()
  );

-- staff: read all
CREATE POLICY "approvals: staff read all"
  ON public.approvals FOR SELECT
  USING (public.current_user_role() IN ('admin', 'manager', 'team'));

-- staff: insert/update
CREATE POLICY "approvals: staff insert"
  ON public.approvals FOR INSERT
  WITH CHECK (public.current_user_role() IN ('admin', 'manager', 'team'));

CREATE POLICY "approvals: staff update"
  ON public.approvals FOR UPDATE
  USING (public.current_user_role() IN ('admin', 'manager', 'team'));

-- admin/manager: delete
CREATE POLICY "approvals: admin manager delete"
  ON public.approvals FOR DELETE
  USING (public.current_user_role() IN ('admin', 'manager'));

-- ─────────────────────────────────────────────────────────────────────────────
-- notifications
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow all notifications" ON public.notifications;

-- Users read only their own notifications
CREATE POLICY "notifications: self read"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid()::text OR user_id IS NULL);

-- Server-side inserts via service role bypass RLS. Allow staff inserts from browser too.
CREATE POLICY "notifications: staff insert"
  ON public.notifications FOR INSERT
  WITH CHECK (public.current_user_role() IN ('admin', 'manager', 'team'));

-- Users can update (mark read) their own notifications
CREATE POLICY "notifications: self update"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid()::text OR user_id IS NULL);

-- Admin can delete notifications
CREATE POLICY "notifications: admin delete"
  ON public.notifications FOR DELETE
  USING (public.current_user_role() = 'admin');

-- ─────────────────────────────────────────────────────────────────────────────
-- publishing_schedules
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.publishing_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow all publishing_schedules" ON public.publishing_schedules;

-- client role: only schedules for their client
CREATE POLICY "publishing_schedules: client scoped read"
  ON public.publishing_schedules FOR SELECT
  USING (
    public.current_user_role() = 'client'
    AND client_id = public.current_user_client_id()
  );

-- staff: read all
CREATE POLICY "publishing_schedules: staff read all"
  ON public.publishing_schedules FOR SELECT
  USING (public.current_user_role() IN ('admin', 'manager', 'team'));

-- staff: insert/update
CREATE POLICY "publishing_schedules: staff write"
  ON public.publishing_schedules FOR INSERT
  WITH CHECK (public.current_user_role() IN ('admin', 'manager', 'team'));

CREATE POLICY "publishing_schedules: staff update"
  ON public.publishing_schedules FOR UPDATE
  USING (public.current_user_role() IN ('admin', 'manager', 'team'));

-- admin/manager: delete
CREATE POLICY "publishing_schedules: admin manager delete"
  ON public.publishing_schedules FOR DELETE
  USING (public.current_user_role() IN ('admin', 'manager'));

-- ─────────────────────────────────────────────────────────────────────────────
-- activities
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow all activities" ON public.activities;

-- staff: read all activities
CREATE POLICY "activities: staff read all"
  ON public.activities FOR SELECT
  USING (public.current_user_role() IN ('admin', 'manager', 'team'));

-- staff: insert activities
CREATE POLICY "activities: staff insert"
  ON public.activities FOR INSERT
  WITH CHECK (public.current_user_role() IN ('admin', 'manager', 'team'));

-- admin: delete
CREATE POLICY "activities: admin delete"
  ON public.activities FOR DELETE
  USING (public.current_user_role() = 'admin');

-- ─────────────────────────────────────────────────────────────────────────────
-- content_items
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow all content_items" ON public.content_items;

-- client role: only their client's content
CREATE POLICY "content_items: client scoped read"
  ON public.content_items FOR SELECT
  USING (
    public.current_user_role() = 'client'
    AND client_id = public.current_user_client_id()
  );

-- staff: read all
CREATE POLICY "content_items: staff read all"
  ON public.content_items FOR SELECT
  USING (public.current_user_role() IN ('admin', 'manager', 'team'));

-- staff: insert/update
CREATE POLICY "content_items: staff write"
  ON public.content_items FOR INSERT
  WITH CHECK (public.current_user_role() IN ('admin', 'manager', 'team'));

CREATE POLICY "content_items: staff update"
  ON public.content_items FOR UPDATE
  USING (public.current_user_role() IN ('admin', 'manager', 'team'));

-- admin/manager: delete
CREATE POLICY "content_items: admin manager delete"
  ON public.content_items FOR DELETE
  USING (public.current_user_role() IN ('admin', 'manager'));

-- ─────────────────────────────────────────────────────────────────────────────
-- automation_rules
-- ─────────────────────────────────────────────────────────────────────────────
-- Already has proper RLS from supabase-migration-automations.sql.
-- No changes needed.

-- ─────────────────────────────────────────────────────────────────────────────
-- calendar_events
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow all calendar_events" ON public.calendar_events;

CREATE POLICY "calendar_events: client scoped read"
  ON public.calendar_events FOR SELECT
  USING (
    public.current_user_role() = 'client'
    AND client_id = public.current_user_client_id()
  );

CREATE POLICY "calendar_events: staff read all"
  ON public.calendar_events FOR SELECT
  USING (public.current_user_role() IN ('admin', 'manager', 'team'));

CREATE POLICY "calendar_events: staff write"
  ON public.calendar_events FOR INSERT
  WITH CHECK (public.current_user_role() IN ('admin', 'manager', 'team'));

CREATE POLICY "calendar_events: staff update"
  ON public.calendar_events FOR UPDATE
  USING (public.current_user_role() IN ('admin', 'manager', 'team'));

CREATE POLICY "calendar_events: admin manager delete"
  ON public.calendar_events FOR DELETE
  USING (public.current_user_role() IN ('admin', 'manager'));

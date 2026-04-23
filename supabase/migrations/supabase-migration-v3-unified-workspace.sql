-- ─────────────────────────────────────────────────────────────────────────────
-- OPENY OS v3 — Unified Workspace Migration
--
-- Run this in your Supabase SQL editor AFTER all previous migrations.
--
-- New tables added:
--   projects, entity_links, custom_field_definitions, custom_field_values,
--   notes, note_links, templates, template_items, tags, tag_links,
--   time_entries, saved_views, dashboard_layouts, dashboard_widgets,
--   ai_sessions, ai_actions, comments_v2
--
-- All CREATE statements are idempotent (IF NOT EXISTS).
-- Safe to run multiple times.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. PROJECTS ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.projects (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid        REFERENCES public.workspaces(id) ON DELETE SET NULL,
  client_id     uuid        REFERENCES public.clients(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  description   text,
  status        text        NOT NULL DEFAULT 'active'
    CHECK (status IN ('planning', 'active', 'on_hold', 'completed', 'cancelled')),
  start_date    date,
  end_date      date,
  color         text        DEFAULT '#6366f1',
  created_by    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS projects_client_idx      ON public.projects(client_id);
CREATE INDEX IF NOT EXISTS projects_workspace_idx   ON public.projects(workspace_id);
CREATE INDEX IF NOT EXISTS projects_status_idx      ON public.projects(status);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "projects: team read"   ON public.projects;
CREATE POLICY "projects: team read"
  ON public.projects FOR SELECT
  USING (public.current_user_role() IN ('owner', 'admin', 'manager', 'team_member'));
DROP POLICY IF EXISTS "projects: admin write" ON public.projects;
CREATE POLICY "projects: admin write"
  ON public.projects FOR ALL
  USING (public.current_user_role() IN ('owner', 'admin', 'manager', 'team_member'));

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at_v3()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_projects_updated_at ON public.projects;
CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_v3();

-- Add project_id to tasks (optional FK for project-scoped tasks)
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS tasks_project_idx ON public.tasks(project_id);

-- ── 2. ENTITY LINKS (generic many-to-many relational graph) ──────────────────

CREATE TABLE IF NOT EXISTS public.entity_links (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid        REFERENCES public.workspaces(id) ON DELETE SET NULL,
  source_type   text        NOT NULL
    CHECK (source_type IN ('task', 'asset', 'content', 'client', 'project', 'note', 'template')),
  source_id     uuid        NOT NULL,
  target_type   text        NOT NULL
    CHECK (target_type IN ('task', 'asset', 'content', 'client', 'project', 'note', 'template')),
  target_id     uuid        NOT NULL,
  link_type     text        NOT NULL DEFAULT 'related'
    CHECK (link_type IN ('related', 'blocks', 'blocked_by', 'parent', 'child', 'duplicate')),
  metadata      jsonb,
  created_by    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_type, source_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS entity_links_source_idx     ON public.entity_links(source_type, source_id);
CREATE INDEX IF NOT EXISTS entity_links_target_idx     ON public.entity_links(target_type, target_id);
CREATE INDEX IF NOT EXISTS entity_links_workspace_idx  ON public.entity_links(workspace_id);

ALTER TABLE public.entity_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "entity_links: team all" ON public.entity_links;
CREATE POLICY "entity_links: team all"
  ON public.entity_links FOR ALL
  USING (public.current_user_role() IN ('owner', 'admin', 'manager', 'team_member'));

-- ── 3. CUSTOM FIELD DEFINITIONS ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.custom_field_definitions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid        REFERENCES public.workspaces(id) ON DELETE CASCADE,
  entity_type   text        NOT NULL
    CHECK (entity_type IN ('task', 'client', 'project', 'content', 'asset')),
  name          text        NOT NULL,
  field_key     text        NOT NULL,
  field_type    text        NOT NULL
    CHECK (field_type IN ('text', 'number', 'select', 'multi_select', 'date', 'boolean', 'url', 'email')),
  options       jsonb,
  required      boolean     NOT NULL DEFAULT false,
  default_value text,
  sort_order    int         NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS custom_field_defs_workspace_idx ON public.custom_field_definitions(workspace_id);
CREATE INDEX IF NOT EXISTS custom_field_defs_entity_idx   ON public.custom_field_definitions(entity_type);

ALTER TABLE public.custom_field_definitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "custom_field_defs: team all" ON public.custom_field_definitions;
CREATE POLICY "custom_field_defs: team all"
  ON public.custom_field_definitions FOR ALL
  USING (public.current_user_role() IN ('owner', 'admin', 'manager', 'team_member'));

-- ── 4. CUSTOM FIELD VALUES ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.custom_field_values (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_id uuid        NOT NULL REFERENCES public.custom_field_definitions(id) ON DELETE CASCADE,
  entity_type   text        NOT NULL,
  entity_id     uuid        NOT NULL,
  value_text    text,
  value_number  numeric,
  value_date    date,
  value_boolean boolean,
  value_json    jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (definition_id, entity_id)
);

CREATE INDEX IF NOT EXISTS custom_field_vals_entity_idx  ON public.custom_field_values(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS custom_field_vals_def_idx     ON public.custom_field_values(definition_id);

ALTER TABLE public.custom_field_values ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "custom_field_vals: team all" ON public.custom_field_values;
CREATE POLICY "custom_field_vals: team all"
  ON public.custom_field_values FOR ALL
  USING (public.current_user_role() IN ('owner', 'admin', 'manager', 'team_member'));

DROP TRIGGER IF EXISTS trg_cfv_updated_at ON public.custom_field_values;
CREATE TRIGGER trg_cfv_updated_at
  BEFORE UPDATE ON public.custom_field_values
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_v3();

-- ── 5. NOTES + NOTE_LINKS ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.notes (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid        REFERENCES public.workspaces(id) ON DELETE SET NULL,
  title         text        NOT NULL DEFAULT 'Untitled',
  content       text,
  entity_type   text
    CHECK (entity_type IS NULL OR entity_type IN ('client', 'task', 'project', 'asset', 'content')),
  entity_id     uuid,
  is_pinned     boolean     NOT NULL DEFAULT false,
  created_by    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notes_workspace_idx  ON public.notes(workspace_id);
CREATE INDEX IF NOT EXISTS notes_entity_idx     ON public.notes(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS notes_created_by_idx ON public.notes(created_by);

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notes: team all" ON public.notes;
CREATE POLICY "notes: team all"
  ON public.notes FOR ALL
  USING (public.current_user_role() IN ('owner', 'admin', 'manager', 'team_member'));

DROP TRIGGER IF EXISTS trg_notes_updated_at ON public.notes;
CREATE TRIGGER trg_notes_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_v3();

CREATE TABLE IF NOT EXISTS public.note_links (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_note_id      uuid        NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  target_note_id      uuid        REFERENCES public.notes(id) ON DELETE CASCADE,
  target_entity_type  text
    CHECK (target_entity_type IS NULL OR target_entity_type IN ('client', 'task', 'project', 'asset', 'content')),
  target_entity_id    uuid,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS note_links_source_idx ON public.note_links(source_note_id);

ALTER TABLE public.note_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "note_links: team all" ON public.note_links;
CREATE POLICY "note_links: team all"
  ON public.note_links FOR ALL
  USING (public.current_user_role() IN ('owner', 'admin', 'manager', 'team_member'));

-- ── 6. TEMPLATES + TEMPLATE ITEMS ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.templates (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid        REFERENCES public.workspaces(id) ON DELETE SET NULL,
  name          text        NOT NULL,
  description   text,
  entity_type   text        NOT NULL
    CHECK (entity_type IN ('task', 'client', 'project', 'content')),
  template_data jsonb       NOT NULL DEFAULT '{}',
  is_global     boolean     NOT NULL DEFAULT false,
  created_by    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS templates_workspace_idx   ON public.templates(workspace_id);
CREATE INDEX IF NOT EXISTS templates_entity_idx      ON public.templates(entity_type);

ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "templates: team all" ON public.templates;
CREATE POLICY "templates: team all"
  ON public.templates FOR ALL
  USING (public.current_user_role() IN ('owner', 'admin', 'manager', 'team_member'));

DROP TRIGGER IF EXISTS trg_templates_updated_at ON public.templates;
CREATE TRIGGER trg_templates_updated_at
  BEFORE UPDATE ON public.templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_v3();

CREATE TABLE IF NOT EXISTS public.template_items (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id   uuid        NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  title         text        NOT NULL,
  description   text,
  item_type     text        NOT NULL DEFAULT 'task'
    CHECK (item_type IN ('task', 'note', 'checklist_item', 'content')),
  sort_order    int         NOT NULL DEFAULT 0,
  item_data     jsonb       DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS template_items_template_idx ON public.template_items(template_id);

ALTER TABLE public.template_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "template_items: team all" ON public.template_items;
CREATE POLICY "template_items: team all"
  ON public.template_items FOR ALL
  USING (public.current_user_role() IN ('owner', 'admin', 'manager', 'team_member'));

-- ── 7. TAGS + TAG_LINKS ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tags (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid        REFERENCES public.workspaces(id) ON DELETE SET NULL,
  name          text        NOT NULL,
  color         text        NOT NULL DEFAULT '#6366f1',
  description   text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, name)
);

CREATE INDEX IF NOT EXISTS tags_workspace_idx ON public.tags(workspace_id);

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tags: team all" ON public.tags;
CREATE POLICY "tags: team all"
  ON public.tags FOR ALL
  USING (public.current_user_role() IN ('owner', 'admin', 'manager', 'team_member'));

CREATE TABLE IF NOT EXISTS public.tag_links (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id        uuid        NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  entity_type   text        NOT NULL
    CHECK (entity_type IN ('task', 'asset', 'content', 'client', 'project', 'note')),
  entity_id     uuid        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tag_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS tag_links_entity_idx ON public.tag_links(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS tag_links_tag_idx    ON public.tag_links(tag_id);

ALTER TABLE public.tag_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tag_links: team all" ON public.tag_links;
CREATE POLICY "tag_links: team all"
  ON public.tag_links FOR ALL
  USING (public.current_user_role() IN ('owner', 'admin', 'manager', 'team_member'));

-- ── 8. TIME ENTRIES ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.time_entries (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid        REFERENCES public.workspaces(id) ON DELETE SET NULL,
  task_id          uuid        REFERENCES public.tasks(id) ON DELETE SET NULL,
  client_id        uuid        REFERENCES public.clients(id) ON DELETE SET NULL,
  user_id          uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  description      text,
  started_at       timestamptz NOT NULL DEFAULT now(),
  ended_at         timestamptz,
  duration_seconds int,
  is_running       boolean     NOT NULL DEFAULT false,
  billable         boolean     NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS time_entries_task_idx      ON public.time_entries(task_id);
CREATE INDEX IF NOT EXISTS time_entries_client_idx    ON public.time_entries(client_id);
CREATE INDEX IF NOT EXISTS time_entries_user_idx      ON public.time_entries(user_id);
CREATE INDEX IF NOT EXISTS time_entries_workspace_idx ON public.time_entries(workspace_id);

ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "time_entries: team all" ON public.time_entries;
CREATE POLICY "time_entries: team all"
  ON public.time_entries FOR ALL
  USING (public.current_user_role() IN ('owner', 'admin', 'manager', 'team_member'));

DROP TRIGGER IF EXISTS trg_time_entries_updated_at ON public.time_entries;
CREATE TRIGGER trg_time_entries_updated_at
  BEFORE UPDATE ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_v3();

-- ── 9. SAVED VIEWS ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.saved_views (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid        REFERENCES public.workspaces(id) ON DELETE SET NULL,
  user_id       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  entity_type   text        NOT NULL
    CHECK (entity_type IN ('task', 'asset', 'content', 'client', 'project')),
  name          text        NOT NULL,
  view_type     text        NOT NULL DEFAULT 'list'
    CHECK (view_type IN ('list', 'kanban', 'calendar', 'timeline', 'table', 'grid', 'pipeline')),
  filters       jsonb       DEFAULT '{}',
  sort_config   jsonb       DEFAULT '{}',
  group_by      text,
  columns       jsonb       DEFAULT '[]',
  is_default    boolean     NOT NULL DEFAULT false,
  is_shared     boolean     NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS saved_views_user_idx    ON public.saved_views(user_id);
CREATE INDEX IF NOT EXISTS saved_views_entity_idx  ON public.saved_views(entity_type);

ALTER TABLE public.saved_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "saved_views: team all" ON public.saved_views;
CREATE POLICY "saved_views: team all"
  ON public.saved_views FOR ALL
  USING (public.current_user_role() IN ('owner', 'admin', 'manager', 'team_member'));

-- ── 10. DASHBOARD LAYOUTS + WIDGETS ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.dashboard_layouts (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid        REFERENCES public.workspaces(id) ON DELETE SET NULL,
  user_id       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  name          text        NOT NULL DEFAULT 'Default',
  is_default    boolean     NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dashboard_layouts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dashboard_layouts: team all" ON public.dashboard_layouts;
CREATE POLICY "dashboard_layouts: team all"
  ON public.dashboard_layouts FOR ALL
  USING (public.current_user_role() IN ('owner', 'admin', 'manager', 'team_member'));

CREATE TABLE IF NOT EXISTS public.dashboard_widgets (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  layout_id     uuid        NOT NULL REFERENCES public.dashboard_layouts(id) ON DELETE CASCADE,
  widget_type   text        NOT NULL
    CHECK (widget_type IN (
      'tasks_summary', 'assets_count', 'content_pipeline',
      'team_workload', 'recent_activity', 'client_list',
      'time_tracking', 'overdue_tasks', 'upcoming_schedule', 'trend_chart'
    )),
  title         text,
  config        jsonb       DEFAULT '{}',
  grid_x        int         NOT NULL DEFAULT 0,
  grid_y        int         NOT NULL DEFAULT 0,
  grid_w        int         NOT NULL DEFAULT 6,
  grid_h        int         NOT NULL DEFAULT 4,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dashboard_widgets_layout_idx ON public.dashboard_widgets(layout_id);

ALTER TABLE public.dashboard_widgets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dashboard_widgets: team all" ON public.dashboard_widgets;
CREATE POLICY "dashboard_widgets: team all"
  ON public.dashboard_widgets FOR ALL
  USING (public.current_user_role() IN ('owner', 'admin', 'manager', 'team_member'));

-- ── 11. AI SESSIONS + AI ACTIONS (audit trail) ───────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_sessions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid        REFERENCES public.workspaces(id) ON DELETE SET NULL,
  user_id       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  mode          text        NOT NULL
    CHECK (mode IN ('ask', 'do', 'suggest', 'review')),
  section       text,
  entity_type   text,
  entity_id     uuid,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_sessions_user_idx      ON public.ai_sessions(user_id);
CREATE INDEX IF NOT EXISTS ai_sessions_workspace_idx ON public.ai_sessions(workspace_id);

ALTER TABLE public.ai_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ai_sessions: team read" ON public.ai_sessions;
CREATE POLICY "ai_sessions: team read"
  ON public.ai_sessions FOR ALL
  USING (public.current_user_role() IN ('owner', 'admin', 'manager', 'team_member'));

CREATE TABLE IF NOT EXISTS public.ai_actions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    uuid        REFERENCES public.ai_sessions(id) ON DELETE SET NULL,
  workspace_id  uuid        REFERENCES public.workspaces(id) ON DELETE SET NULL,
  user_id       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  intent        text        NOT NULL,
  prompt        text        NOT NULL,
  actions_taken jsonb       DEFAULT '[]',
  response_text text,
  status        text        NOT NULL DEFAULT 'success'
    CHECK (status IN ('success', 'error', 'partial', 'pending')),
  error_message text,
  duration_ms   int,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_actions_session_idx ON public.ai_actions(session_id);
CREATE INDEX IF NOT EXISTS ai_actions_user_idx    ON public.ai_actions(user_id);

ALTER TABLE public.ai_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ai_actions: team read" ON public.ai_actions;
CREATE POLICY "ai_actions: team read"
  ON public.ai_actions FOR ALL
  USING (public.current_user_role() IN ('owner', 'admin', 'manager', 'team_member'));

-- ── 12. COMMENTS v2 (threaded + cross-entity) ────────────────────────────────
-- Upgrades the existing flat comments table to support threads and cross-entity linking.

ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS entity_type text;
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS entity_id   uuid;
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS parent_id   uuid REFERENCES public.comments(id) ON DELETE CASCADE;
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS mentions    uuid[] DEFAULT '{}';
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS is_resolved boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS comments_entity_idx  ON public.comments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS comments_parent_idx  ON public.comments(parent_id);

-- Backfill entity_type/entity_id from asset_id/task_id where present
UPDATE public.comments SET entity_type = 'asset', entity_id = asset_id WHERE asset_id IS NOT NULL AND entity_type IS NULL;
UPDATE public.comments SET entity_type = 'task',  entity_id = task_id  WHERE task_id  IS NOT NULL AND entity_type IS NULL;

-- ── 13. AUTOMATION RULES (expand existing) ────────────────────────────────────
-- Add missing columns to automation_rules if the table already exists.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'automation_rules') THEN
    ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL;
    ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS description  text;
    ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS run_count    int NOT NULL DEFAULT 0;
    ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS last_run_at  timestamptz;
    ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS error_count  int NOT NULL DEFAULT 0;
  ELSE
    CREATE TABLE public.automation_rules (
      id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id  uuid        REFERENCES public.workspaces(id) ON DELETE SET NULL,
      name          text        NOT NULL,
      description   text,
      is_active     boolean     NOT NULL DEFAULT true,
      trigger_type  text        NOT NULL,
      trigger_config jsonb      DEFAULT '{}',
      conditions    jsonb       DEFAULT '[]',
      actions       jsonb       DEFAULT '[]',
      run_count     int         NOT NULL DEFAULT 0,
      last_run_at   timestamptz,
      error_count   int         NOT NULL DEFAULT 0,
      created_by    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
      created_at    timestamptz NOT NULL DEFAULT now(),
      updated_at    timestamptz NOT NULL DEFAULT now()
    );

    ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "automation_rules: admin write"
      ON public.automation_rules FOR ALL
      USING (public.current_user_role() IN ('owner', 'admin', 'manager'));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS automation_rules_workspace_idx ON public.automation_rules(workspace_id);

-- ── 14. WORKSPACE_EVENTS (event backbone) ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.workspace_events (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid        REFERENCES public.workspaces(id) ON DELETE SET NULL,
  event_type    text        NOT NULL,
  entity_type   text,
  entity_id     uuid,
  actor_id      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  payload       jsonb       DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workspace_events_workspace_idx ON public.workspace_events(workspace_id);
CREATE INDEX IF NOT EXISTS workspace_events_entity_idx    ON public.workspace_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS workspace_events_created_idx   ON public.workspace_events(created_at DESC);

ALTER TABLE public.workspace_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "workspace_events: team read" ON public.workspace_events;
CREATE POLICY "workspace_events: team read"
  ON public.workspace_events FOR SELECT
  USING (public.current_user_role() IN ('owner', 'admin', 'manager', 'team_member'));
DROP POLICY IF EXISTS "workspace_events: service insert" ON public.workspace_events;
CREATE POLICY "workspace_events: service insert"
  ON public.workspace_events FOR INSERT
  WITH CHECK (true);

-- ── 15. FULL-TEXT SEARCH: add tsvector columns where missing ─────────────────

ALTER TABLE public.clients        ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE public.tasks          ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE public.assets         ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE public.content_items  ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE public.notes          ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE public.projects       ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE INDEX IF NOT EXISTS clients_search_idx       ON public.clients       USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS tasks_search_idx         ON public.tasks         USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS assets_search_idx        ON public.assets        USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS content_items_search_idx ON public.content_items USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS notes_search_idx         ON public.notes         USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS projects_search_idx      ON public.projects      USING GIN(search_vector);

-- Populate existing rows (best-effort — run once after migration)
UPDATE public.clients
  SET search_vector = to_tsvector('english', coalesce(name,'') || ' ' || coalesce(email,'') || ' ' || coalesce(industry,''))
  WHERE search_vector IS NULL;

UPDATE public.tasks
  SET search_vector = to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,''))
  WHERE search_vector IS NULL;

UPDATE public.assets
  SET search_vector = to_tsvector('english', coalesce(name,'') || ' ' || coalesce(client_name,''))
  WHERE search_vector IS NULL;

UPDATE public.content_items
  SET search_vector = to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,''))
  WHERE search_vector IS NULL;

UPDATE public.notes
  SET search_vector = to_tsvector('english', coalesce(title,'') || ' ' || coalesce(content,''))
  WHERE search_vector IS NULL;

UPDATE public.projects
  SET search_vector = to_tsvector('english', coalesce(name,'') || ' ' || coalesce(description,''))
  WHERE search_vector IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- Done. New tables and indexes are active.
-- ─────────────────────────────────────────────────────────────────────────────

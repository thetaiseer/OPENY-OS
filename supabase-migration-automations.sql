-- ── Automation Rules table ────────────────────────────────────────────────────
-- Run this migration in your Supabase SQL editor.

CREATE TABLE IF NOT EXISTS public.automation_rules (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  trigger_type   text NOT NULL CHECK (trigger_type IN ('task_completed', 'asset_uploaded', 'deadline_near')),
  condition_json jsonb,
  action_type    text NOT NULL CHECK (action_type IN ('send_notification', 'link_asset_to_client', 'alert_user', 'send_slack')),
  action_config  jsonb NOT NULL DEFAULT '{}',
  enabled        boolean NOT NULL DEFAULT true,
  created_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Index for efficient trigger lookups
CREATE INDEX IF NOT EXISTS automation_rules_trigger_idx ON public.automation_rules (trigger_type) WHERE enabled = true;

-- RLS: only admin/manager can manage rules
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage automation rules"
  ON public.automation_rules
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

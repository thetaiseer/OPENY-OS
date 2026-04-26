-- Add accepted_at to team_invitations when missing (legacy / hand-made schemas).
-- Fixes: column team_invitations.accepted_at does not exist → GET /api/team/invitations 500
ALTER TABLE public.team_invitations
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz;

NOTIFY pgrst, 'reload schema';

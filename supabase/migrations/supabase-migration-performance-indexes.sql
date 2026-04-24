-- Common lookup paths for OPENY OS list/detail views (safe IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_clients_slug ON public.clients (slug);
CREATE INDEX IF NOT EXISTS idx_clients_created_at ON public.clients (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_members_email ON public.team_members (email);
CREATE INDEX IF NOT EXISTS idx_tasks_client_id ON public.tasks (client_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks (status);
CREATE INDEX IF NOT EXISTS idx_activities_client_created ON public.activities (client_id, created_at DESC);

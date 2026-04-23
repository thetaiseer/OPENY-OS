-- Agency v1 migration
-- Add start_date to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS start_date date;

-- Update status check constraint on tasks
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check
  CHECK (status IN ('todo', 'in_progress', 'review', 'done', 'delivered', 'overdue'));

-- Add task_id to assets
ALTER TABLE assets ADD COLUMN IF NOT EXISTS task_id uuid REFERENCES tasks(id) ON DELETE SET NULL;

-- Add uploaded_by to assets (may already exist)
ALTER TABLE assets ADD COLUMN IF NOT EXISTS uploaded_by text;

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text,
  message    text NOT NULL,
  type       text CHECK (type IN ('info', 'success', 'warning', 'error')),
  read       boolean DEFAULT false,
  user_id    text,
  client_id  uuid REFERENCES clients(id),
  task_id    uuid REFERENCES tasks(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- RLS: allow all on notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all on notifications" ON notifications;
CREATE POLICY "allow all on notifications" ON notifications FOR ALL USING (true) WITH CHECK (true);

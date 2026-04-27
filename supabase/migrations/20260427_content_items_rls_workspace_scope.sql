-- Tighten content_items read policy to workspace-scoped access.
-- Keeps RLS enabled and does not broaden permissions.

alter table public.content_items enable row level security;

drop policy if exists "content_items: staff read all" on public.content_items;
drop policy if exists "content_items: staff read scoped workspace" on public.content_items;

create policy "content_items: staff read scoped workspace"
  on public.content_items
  for select
  using (
    public.current_user_role() in ('owner', 'admin', 'manager', 'team_member')
    and (
      public.current_user_role() = 'owner'
      or exists (
        select 1
        from public.workspace_members wm
        where wm.workspace_id = content_items.workspace_id
          and wm.user_id = auth.uid()
      )
    )
  );


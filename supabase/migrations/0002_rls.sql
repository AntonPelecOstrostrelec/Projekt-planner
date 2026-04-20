-- =========================================================================
-- Row-Level Security policies. Every tenant table gets strict rules.
-- Core rule: you see a row only if you are a member of its workspace.
-- =========================================================================

-- -------------------------------------------------------------------------
-- Helper: is the current user a member of a given workspace?
-- SECURITY DEFINER to avoid recursion through workspace_members policies.
-- -------------------------------------------------------------------------
create or replace function public.is_workspace_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws and user_id = auth.uid()
  );
$$;

create or replace function public.workspace_role_of(ws uuid)
returns public.workspace_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.workspace_members
  where workspace_id = ws and user_id = auth.uid()
  limit 1;
$$;

-- -------------------------------------------------------------------------
-- Enable RLS on everything
-- -------------------------------------------------------------------------
alter table public.profiles           enable row level security;
alter table public.workspaces         enable row level security;
alter table public.workspace_members  enable row level security;
alter table public.invitations        enable row level security;
alter table public.projects           enable row level security;
alter table public.change_events      enable row level security;

-- -------------------------------------------------------------------------
-- profiles: read any, write only your own
-- -------------------------------------------------------------------------
create policy "profiles: read any authenticated"
  on public.profiles for select
  to authenticated
  using (true);

create policy "profiles: update self"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- -------------------------------------------------------------------------
-- workspaces
-- -------------------------------------------------------------------------
create policy "workspaces: members can read"
  on public.workspaces for select
  to authenticated
  using (public.is_workspace_member(id));

create policy "workspaces: any authenticated can create (as owner)"
  on public.workspaces for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "workspaces: owner/admin can update"
  on public.workspaces for update
  to authenticated
  using (public.workspace_role_of(id) in ('owner', 'admin'))
  with check (public.workspace_role_of(id) in ('owner', 'admin'));

create policy "workspaces: owner can delete"
  on public.workspaces for delete
  to authenticated
  using (public.workspace_role_of(id) = 'owner');

-- -------------------------------------------------------------------------
-- workspace_members
-- -------------------------------------------------------------------------
create policy "members: read own memberships"
  on public.workspace_members for select
  to authenticated
  using (user_id = auth.uid() or public.is_workspace_member(workspace_id));

create policy "members: owner/admin can manage"
  on public.workspace_members for insert
  to authenticated
  with check (public.workspace_role_of(workspace_id) in ('owner', 'admin'));

create policy "members: owner/admin can update roles"
  on public.workspace_members for update
  to authenticated
  using (public.workspace_role_of(workspace_id) in ('owner', 'admin'))
  with check (public.workspace_role_of(workspace_id) in ('owner', 'admin'));

create policy "members: owner/admin can remove"
  on public.workspace_members for delete
  to authenticated
  using (public.workspace_role_of(workspace_id) in ('owner', 'admin'));

-- -------------------------------------------------------------------------
-- invitations
-- -------------------------------------------------------------------------
create policy "invitations: members can read workspace invites"
  on public.invitations for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "invitations: owner/admin can create"
  on public.invitations for insert
  to authenticated
  with check (public.workspace_role_of(workspace_id) in ('owner', 'admin'));

create policy "invitations: owner/admin can delete"
  on public.invitations for delete
  to authenticated
  using (public.workspace_role_of(workspace_id) in ('owner', 'admin'));

-- -------------------------------------------------------------------------
-- projects
-- -------------------------------------------------------------------------
create policy "projects: workspace members can read"
  on public.projects for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "projects: members can create"
  on public.projects for insert
  to authenticated
  with check (
    public.is_workspace_member(workspace_id)
    and created_by = auth.uid()
    and public.workspace_role_of(workspace_id) <> 'guest'
  );

create policy "projects: members can update"
  on public.projects for update
  to authenticated
  using (
    public.is_workspace_member(workspace_id)
    and public.workspace_role_of(workspace_id) <> 'guest'
  )
  with check (
    public.is_workspace_member(workspace_id)
    and public.workspace_role_of(workspace_id) <> 'guest'
  );

create policy "projects: admin/owner can delete"
  on public.projects for delete
  to authenticated
  using (public.workspace_role_of(workspace_id) in ('owner', 'admin'));

-- -------------------------------------------------------------------------
-- change_events: read-only for members, inserts only via service role
-- -------------------------------------------------------------------------
create policy "change_events: members can read"
  on public.change_events for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

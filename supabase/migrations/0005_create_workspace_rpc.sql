-- =========================================================================
-- Phase 1 hotfix #2: RPC function for workspace creation.
--
-- The direct INSERT path tripped "row violates RLS" because auth.uid()
-- evaluated to NULL inside the Server Action's Postgres session (likely
-- a JWT-propagation issue with @supabase/ssr on Next.js 15 form POSTs).
--
-- Wrapping the create in a security-definer function sidesteps the issue:
-- the function runs with its declared search_path, checks auth.uid()
-- explicitly, and performs both inserts atomically. RLS on workspaces
-- stays strict; callers just use this entry point.
-- =========================================================================

create or replace function public.create_workspace(
  workspace_name text,
  workspace_slug text
)
returns public.workspaces
language plpgsql
security definer
set search_path = public
as $body$
declare
  new_workspace public.workspaces;
  current_user_id uuid;
begin
  current_user_id := auth.uid();
  if current_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  -- Make sure a profile exists (defensive; trigger should have done this)
  insert into public.profiles (id, email)
  select u.id, u.email
  from auth.users u
  where u.id = current_user_id
  on conflict (id) do nothing;

  insert into public.workspaces (name, slug, owner_id)
  values (workspace_name, workspace_slug, current_user_id)
  returning * into new_workspace;

  -- Trigger handle_new_workspace also inserts this; keep idempotent in case
  -- the trigger has been disabled or failed silently.
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace.id, current_user_id, 'owner')
  on conflict do nothing;

  return new_workspace;
end;
$body$;

grant execute on function public.create_workspace(text, text) to authenticated;

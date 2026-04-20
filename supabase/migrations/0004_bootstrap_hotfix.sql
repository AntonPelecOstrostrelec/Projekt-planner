-- =========================================================================
-- Phase 1 hotfix: repair bootstrap triggers + backfill profiles.
--
-- Problem: the original 0001 migration used bare $$ dollar-quoting, which
-- some SQL editors mis-tokenise, so handle_new_user / handle_new_workspace
-- may not have been installed correctly. That means existing auth.users
-- rows have no matching public.profiles row, and every subsequent query
-- trips foreign-key or RLS checks.
--
-- This migration is idempotent: safe to run even if the triggers are fine.
-- =========================================================================

-- -------------------------------------------------------------------------
-- Re-install handle_new_user with named dollar-quoting
-- -------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $body$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$body$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -------------------------------------------------------------------------
-- Re-install handle_new_workspace with named dollar-quoting
-- -------------------------------------------------------------------------
create or replace function public.handle_new_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $body$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict do nothing;
  return new;
end;
$body$;

drop trigger if exists on_workspace_created on public.workspaces;
create trigger on_workspace_created
  after insert on public.workspaces
  for each row execute function public.handle_new_workspace();

-- -------------------------------------------------------------------------
-- Backfill: for every auth.users row missing a profile, create one.
-- -------------------------------------------------------------------------
insert into public.profiles (id, email, full_name, avatar_url)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'),
  u.raw_user_meta_data->>'avatar_url'
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- -------------------------------------------------------------------------
-- Also re-install touch_updated_at in case the bare $$ broke it.
-- -------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $body$
begin
  new.updated_at = now();
  return new;
end;
$body$;

-- -------------------------------------------------------------------------
-- Helper functions used by RLS (re-install with named delimiters).
-- -------------------------------------------------------------------------
create or replace function public.is_workspace_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $body$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws and user_id = auth.uid()
  );
$body$;

create or replace function public.workspace_role_of(ws uuid)
returns public.workspace_role
language sql
stable
security definer
set search_path = public
as $body$
  select role from public.workspace_members
  where workspace_id = ws and user_id = auth.uid()
  limit 1;
$body$;

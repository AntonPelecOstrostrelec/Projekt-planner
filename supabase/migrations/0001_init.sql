-- =========================================================================
-- Pushnik – initial schema (Phase 0)
-- Multi-tenant foundation: profiles, workspaces, memberships, invitations.
-- Projects/tasks already skeletoned so Phase 1 only adds columns.
-- =========================================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- -------------------------------------------------------------------------
-- profiles: 1:1 with auth.users, exposes safe public fields
-- -------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       citext not null unique,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is 'User profile; 1:1 with auth.users.';

-- -------------------------------------------------------------------------
-- workspaces: tenant boundary. Every other row-owned table links here.
-- -------------------------------------------------------------------------
create table public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  owner_id    uuid not null references public.profiles(id) on delete restrict,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index on public.workspaces(owner_id);

-- -------------------------------------------------------------------------
-- workspace_members: which users belong where, and in what role
-- -------------------------------------------------------------------------
create type public.workspace_role as enum ('owner', 'admin', 'member', 'guest');

create table public.workspace_members (
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  role          public.workspace_role not null default 'member',
  joined_at     timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index on public.workspace_members(user_id);

-- -------------------------------------------------------------------------
-- invitations: email-based invites with token
-- -------------------------------------------------------------------------
create table public.invitations (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  email         citext not null,
  role          public.workspace_role not null default 'member',
  token         text not null unique,
  invited_by    uuid not null references public.profiles(id) on delete set null,
  expires_at    timestamptz not null default (now() + interval '7 days'),
  accepted_at   timestamptz,
  created_at    timestamptz not null default now()
);

create index on public.invitations(workspace_id);
create index on public.invitations(email);

-- -------------------------------------------------------------------------
-- projects: Phase 1 fleshes this out; here just the minimum for RLS tests
-- -------------------------------------------------------------------------
create type public.project_status as enum ('active', 'paused', 'archived', 'done');

create table public.projects (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  name          text not null,
  description   text,
  status        public.project_status not null default 'active',
  color         text,
  deadline      timestamptz,
  created_by    uuid not null references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index on public.projects(workspace_id);
create index on public.projects(status);

-- -------------------------------------------------------------------------
-- change_events: append-only audit log per workspace
-- -------------------------------------------------------------------------
create table public.change_events (
  id            bigserial primary key,
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  actor_id      uuid references public.profiles(id) on delete set null,
  entity_type   text not null,
  entity_id     uuid,
  action        text not null,
  diff          jsonb,
  created_at    timestamptz not null default now()
);

create index on public.change_events(workspace_id, created_at desc);
create index on public.change_events(entity_type, entity_id);

-- -------------------------------------------------------------------------
-- updated_at auto-touch
-- -------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch   before update on public.profiles   for each row execute function public.touch_updated_at();
create trigger workspaces_touch before update on public.workspaces for each row execute function public.touch_updated_at();
create trigger projects_touch   before update on public.projects   for each row execute function public.touch_updated_at();

-- -------------------------------------------------------------------------
-- Auto-create profile on new auth user
-- -------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -------------------------------------------------------------------------
-- When a workspace is created, insert the owner as a member automatically
-- -------------------------------------------------------------------------
create or replace function public.handle_new_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict do nothing;
  return new;
end;
$$;

create trigger on_workspace_created
  after insert on public.workspaces
  for each row execute function public.handle_new_workspace();

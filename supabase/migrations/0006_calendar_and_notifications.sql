-- =========================================================================
-- Phase 2: calendar integration, notifications, deadline alerts.
-- All named dollar-quoting + idempotent guards.
-- =========================================================================

-- -------------------------------------------------------------------------
-- notifications: in-app notifications (bell icon)
-- -------------------------------------------------------------------------
do $init$ begin
  if not exists (select 1 from pg_type where typname = 'notification_kind') then
    create type public.notification_kind as enum (
      'deadline_72h',
      'deadline_24h',
      'deadline_overdue',
      'task_assigned',
      'task_comment',
      'project_invite',
      'mention',
      'system'
    );
  end if;
end $init$;

create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  kind         public.notification_kind not null,
  title        text not null,
  body         text,
  entity_type  text,
  entity_id    uuid,
  url          text,
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists notifications_user_id_created_idx
  on public.notifications(user_id, created_at desc);
create index if not exists notifications_unread_idx
  on public.notifications(user_id) where read_at is null;

alter table public.notifications enable row level security;

drop policy if exists "notifications: user reads own" on public.notifications;
create policy "notifications: user reads own"
  on public.notifications for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "notifications: user updates own" on public.notifications;
create policy "notifications: user updates own"
  on public.notifications for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- -------------------------------------------------------------------------
-- notification_preferences: per-user, per-workspace
-- -------------------------------------------------------------------------
create table if not exists public.notification_preferences (
  user_id              uuid not null references public.profiles(id) on delete cascade,
  workspace_id         uuid not null references public.workspaces(id) on delete cascade,
  in_app_enabled       boolean not null default true,
  email_enabled        boolean not null default true,
  push_enabled         boolean not null default false,
  deadline_alerts      boolean not null default true,
  task_assigned        boolean not null default true,
  task_comments        boolean not null default true,
  daily_digest         boolean not null default false,
  updated_at           timestamptz not null default now(),
  primary key (user_id, workspace_id)
);

alter table public.notification_preferences enable row level security;

drop policy if exists "notif_prefs: user manages own" on public.notification_preferences;
create policy "notif_prefs: user manages own"
  on public.notification_preferences for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- -------------------------------------------------------------------------
-- calendar_integrations: per-user OAuth tokens for Google/MS
-- -------------------------------------------------------------------------
do $init$ begin
  if not exists (select 1 from pg_type where typname = 'calendar_provider') then
    create type public.calendar_provider as enum ('google', 'microsoft');
  end if;
end $init$;

create table if not exists public.calendar_integrations (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  provider        public.calendar_provider not null,
  account_email   text,
  access_token    text not null,
  refresh_token   text,
  expires_at      timestamptz,
  calendar_id     text,
  sync_enabled    boolean not null default true,
  last_synced_at  timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, provider)
);

create index if not exists calendar_integrations_user_id_idx
  on public.calendar_integrations(user_id);

alter table public.calendar_integrations enable row level security;

drop policy if exists "calendar: user manages own" on public.calendar_integrations;
create policy "calendar: user manages own"
  on public.calendar_integrations for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- -------------------------------------------------------------------------
-- calendar_sync_state: links a task to an external event
-- -------------------------------------------------------------------------
create table if not exists public.calendar_sync_state (
  task_id            uuid not null references public.tasks(id) on delete cascade,
  integration_id     uuid not null references public.calendar_integrations(id) on delete cascade,
  external_event_id  text not null,
  last_synced_at     timestamptz not null default now(),
  primary key (task_id, integration_id)
);

alter table public.calendar_sync_state enable row level security;

drop policy if exists "calendar_sync_state: user reads own" on public.calendar_sync_state;
create policy "calendar_sync_state: user reads own"
  on public.calendar_sync_state for select
  to authenticated
  using (
    exists (
      select 1 from public.calendar_integrations ci
      where ci.id = integration_id and ci.user_id = auth.uid()
    )
  );

-- -------------------------------------------------------------------------
-- push_subscriptions: web push endpoints per user
-- -------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subs: user manages own" on public.push_subscriptions;
create policy "push_subs: user manages own"
  on public.push_subscriptions for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- -------------------------------------------------------------------------
-- scheduled_alerts: deduplicate deadline notifications
-- -------------------------------------------------------------------------
do $init$ begin
  if not exists (select 1 from pg_type where typname = 'alert_kind') then
    create type public.alert_kind as enum ('deadline_72h', 'deadline_24h', 'overdue');
  end if;
end $init$;

create table if not exists public.scheduled_alerts (
  task_id  uuid not null references public.tasks(id) on delete cascade,
  kind     public.alert_kind not null,
  sent_at  timestamptz not null default now(),
  primary key (task_id, kind)
);

-- -------------------------------------------------------------------------
-- ics_tokens: per-user per-workspace secret token for calendar feed
-- -------------------------------------------------------------------------
create table if not exists public.ics_tokens (
  token         text primary key,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  workspace_id  uuid references public.workspaces(id) on delete cascade,
  created_at    timestamptz not null default now()
);

create index if not exists ics_tokens_user_id_idx on public.ics_tokens(user_id);

alter table public.ics_tokens enable row level security;

drop policy if exists "ics_tokens: user manages own" on public.ics_tokens;
create policy "ics_tokens: user manages own"
  on public.ics_tokens for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- -------------------------------------------------------------------------
-- Realtime: notifications
-- -------------------------------------------------------------------------
do $pub$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $pub$;

-- -------------------------------------------------------------------------
-- RPC: create a notification (called by cron or triggers, security definer
-- so the scheduler can write notifications for any user).
-- -------------------------------------------------------------------------
create or replace function public.create_notification(
  p_user_id uuid,
  p_workspace_id uuid,
  p_kind public.notification_kind,
  p_title text,
  p_body text,
  p_entity_type text,
  p_entity_id uuid,
  p_url text
)
returns public.notifications
language plpgsql
security definer
set search_path = public
as $body$
declare
  result public.notifications;
begin
  insert into public.notifications (user_id, workspace_id, kind, title, body, entity_type, entity_id, url)
  values (p_user_id, p_workspace_id, p_kind, p_title, p_body, p_entity_type, p_entity_id, p_url)
  returning * into result;
  return result;
end;
$body$;

-- -------------------------------------------------------------------------
-- RPC: mark-all-read
-- -------------------------------------------------------------------------
create or replace function public.mark_all_notifications_read(p_workspace_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $body$
declare
  affected integer;
begin
  update public.notifications
  set read_at = now()
  where user_id = auth.uid()
    and read_at is null
    and (p_workspace_id is null or workspace_id = p_workspace_id);
  get diagnostics affected = row_count;
  return affected;
end;
$body$;

grant execute on function public.create_notification(uuid, uuid, public.notification_kind, text, text, text, uuid, text) to authenticated;
grant execute on function public.mark_all_notifications_read(uuid) to authenticated;

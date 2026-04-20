-- =========================================================================
-- Phase 1: tasks, tags, per-project members, changelog triggers.
-- Idempotent: safe to re-run. Uses named dollar-quoting ($body$) so SQL
-- editors that split on bare $$ don't mangle trigger function bodies.
-- =========================================================================

-- -------------------------------------------------------------------------
-- project_members: fine-grained access on top of workspace membership.
-- Absence of a row = inherits workspace role. Presence overrides.
-- -------------------------------------------------------------------------
do $init$ begin
  if not exists (select 1 from pg_type where typname = 'project_role') then
    create type public.project_role as enum ('lead', 'contributor', 'viewer');
  end if;
end $init$;

create table if not exists public.project_members (
  project_id  uuid not null references public.projects(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  role        public.project_role not null default 'contributor',
  added_at    timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index if not exists project_members_user_id_idx on public.project_members(user_id);

-- -------------------------------------------------------------------------
-- tags: workspace-scoped labels
-- -------------------------------------------------------------------------
create table if not exists public.tags (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  name          text not null,
  color         text,
  created_at    timestamptz not null default now(),
  unique (workspace_id, name)
);

create index if not exists tags_workspace_id_idx on public.tags(workspace_id);

-- -------------------------------------------------------------------------
-- tasks
-- -------------------------------------------------------------------------
do $init$ begin
  if not exists (select 1 from pg_type where typname = 'task_status') then
    create type public.task_status as enum ('todo', 'doing', 'review', 'done');
  end if;
  if not exists (select 1 from pg_type where typname = 'task_priority') then
    create type public.task_priority as enum ('low', 'medium', 'high', 'urgent');
  end if;
end $init$;

create table if not exists public.tasks (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.projects(id) on delete cascade,
  workspace_id   uuid not null references public.workspaces(id) on delete cascade,
  title          text not null,
  description    text,
  status         public.task_status not null default 'todo',
  priority       public.task_priority not null default 'medium',
  estimate_hours numeric(6,2),
  deadline       timestamptz,
  position       double precision not null default extract(epoch from now()),
  created_by     uuid references public.profiles(id) on delete set null,
  completed_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists tasks_project_status_position_idx on public.tasks(project_id, status, position);
create index if not exists tasks_workspace_id_idx on public.tasks(workspace_id);
create index if not exists tasks_deadline_idx on public.tasks(deadline) where deadline is not null;

drop trigger if exists tasks_touch on public.tasks;
create trigger tasks_touch before update on public.tasks
  for each row execute function public.touch_updated_at();

-- Keep workspace_id in sync with parent project
create or replace function public.tasks_sync_workspace()
returns trigger
language plpgsql
as $body$
begin
  new.workspace_id := (select workspace_id from public.projects where id = new.project_id);
  return new;
end;
$body$;

drop trigger if exists tasks_sync_workspace_ins on public.tasks;
create trigger tasks_sync_workspace_ins before insert on public.tasks
  for each row execute function public.tasks_sync_workspace();

-- completed_at follows status
create or replace function public.tasks_sync_completed_at()
returns trigger
language plpgsql
as $body$
begin
  if new.status = 'done' and (tg_op = 'INSERT' or old.status is distinct from 'done' or old.completed_at is null) then
    new.completed_at := now();
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;
  return new;
end;
$body$;

drop trigger if exists tasks_sync_completed_at_upd on public.tasks;
create trigger tasks_sync_completed_at_upd before update on public.tasks
  for each row execute function public.tasks_sync_completed_at();

drop trigger if exists tasks_sync_completed_at_ins on public.tasks;
create trigger tasks_sync_completed_at_ins before insert on public.tasks
  for each row execute function public.tasks_sync_completed_at();

-- -------------------------------------------------------------------------
-- task_assignees
-- -------------------------------------------------------------------------
create table if not exists public.task_assignees (
  task_id      uuid not null references public.tasks(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  assigned_at  timestamptz not null default now(),
  primary key (task_id, user_id)
);

create index if not exists task_assignees_user_id_idx on public.task_assignees(user_id);

-- -------------------------------------------------------------------------
-- task_tags
-- -------------------------------------------------------------------------
create table if not exists public.task_tags (
  task_id  uuid not null references public.tasks(id) on delete cascade,
  tag_id   uuid not null references public.tags(id) on delete cascade,
  primary key (task_id, tag_id)
);

-- -------------------------------------------------------------------------
-- change_events trigger: auto-log mutations on projects and tasks
-- -------------------------------------------------------------------------
create or replace function public.log_change_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $body$
declare
  ws_id uuid;
  ent_id uuid;
  action_name text;
  diff_data jsonb;
begin
  if tg_op = 'DELETE' then
    ws_id := old.workspace_id;
    ent_id := old.id;
    action_name := 'deleted';
    diff_data := to_jsonb(old);
  elsif tg_op = 'INSERT' then
    ws_id := new.workspace_id;
    ent_id := new.id;
    action_name := 'created';
    diff_data := to_jsonb(new);
  else
    ws_id := new.workspace_id;
    ent_id := new.id;
    action_name := 'updated';
    diff_data := jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new));
  end if;

  insert into public.change_events (workspace_id, actor_id, entity_type, entity_id, action, diff)
  values (ws_id, auth.uid(), tg_table_name, ent_id, action_name, diff_data);

  return coalesce(new, old);
end;
$body$;

drop trigger if exists projects_log_change on public.projects;
create trigger projects_log_change
  after insert or update or delete on public.projects
  for each row execute function public.log_change_event();

drop trigger if exists tasks_log_change on public.tasks;
create trigger tasks_log_change
  after insert or update or delete on public.tasks
  for each row execute function public.log_change_event();

-- -------------------------------------------------------------------------
-- RLS
-- -------------------------------------------------------------------------
alter table public.project_members enable row level security;
alter table public.tags            enable row level security;
alter table public.tasks           enable row level security;
alter table public.task_assignees  enable row level security;
alter table public.task_tags       enable row level security;

-- project_members
drop policy if exists "project_members: workspace members can read" on public.project_members;
create policy "project_members: workspace members can read"
  on public.project_members for select
  to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and public.is_workspace_member(p.workspace_id)
    )
  );

drop policy if exists "project_members: owner/admin can manage" on public.project_members;
create policy "project_members: owner/admin can manage"
  on public.project_members for all
  to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id
        and public.workspace_role_of(p.workspace_id) in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id
        and public.workspace_role_of(p.workspace_id) in ('owner', 'admin')
    )
  );

-- tags
drop policy if exists "tags: workspace members can read" on public.tags;
create policy "tags: workspace members can read"
  on public.tags for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "tags: non-guests can write" on public.tags;
create policy "tags: non-guests can write"
  on public.tags for all
  to authenticated
  using (
    public.is_workspace_member(workspace_id)
    and public.workspace_role_of(workspace_id) <> 'guest'
  )
  with check (
    public.is_workspace_member(workspace_id)
    and public.workspace_role_of(workspace_id) <> 'guest'
  );

-- tasks
drop policy if exists "tasks: workspace members can read" on public.tasks;
create policy "tasks: workspace members can read"
  on public.tasks for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "tasks: non-guests can insert" on public.tasks;
create policy "tasks: non-guests can insert"
  on public.tasks for insert
  to authenticated
  with check (
    public.is_workspace_member(workspace_id)
    and public.workspace_role_of(workspace_id) <> 'guest'
  );

drop policy if exists "tasks: non-guests can update" on public.tasks;
create policy "tasks: non-guests can update"
  on public.tasks for update
  to authenticated
  using (
    public.is_workspace_member(workspace_id)
    and public.workspace_role_of(workspace_id) <> 'guest'
  )
  with check (
    public.is_workspace_member(workspace_id)
    and public.workspace_role_of(workspace_id) <> 'guest'
  );

drop policy if exists "tasks: owner/admin or creator can delete" on public.tasks;
create policy "tasks: owner/admin or creator can delete"
  on public.tasks for delete
  to authenticated
  using (
    public.workspace_role_of(workspace_id) in ('owner', 'admin')
    or created_by = auth.uid()
  );

-- task_assignees
drop policy if exists "assignees: workspace members can read" on public.task_assignees;
create policy "assignees: workspace members can read"
  on public.task_assignees for select
  to authenticated
  using (
    exists (
      select 1 from public.tasks t
      where t.id = task_id and public.is_workspace_member(t.workspace_id)
    )
  );

drop policy if exists "assignees: non-guests can manage" on public.task_assignees;
create policy "assignees: non-guests can manage"
  on public.task_assignees for all
  to authenticated
  using (
    exists (
      select 1 from public.tasks t
      where t.id = task_id
        and public.is_workspace_member(t.workspace_id)
        and public.workspace_role_of(t.workspace_id) <> 'guest'
    )
  )
  with check (
    exists (
      select 1 from public.tasks t
      where t.id = task_id
        and public.is_workspace_member(t.workspace_id)
        and public.workspace_role_of(t.workspace_id) <> 'guest'
    )
  );

-- task_tags
drop policy if exists "task_tags: workspace members can read" on public.task_tags;
create policy "task_tags: workspace members can read"
  on public.task_tags for select
  to authenticated
  using (
    exists (
      select 1 from public.tasks t
      where t.id = task_id and public.is_workspace_member(t.workspace_id)
    )
  );

drop policy if exists "task_tags: non-guests can manage" on public.task_tags;
create policy "task_tags: non-guests can manage"
  on public.task_tags for all
  to authenticated
  using (
    exists (
      select 1 from public.tasks t
      where t.id = task_id
        and public.is_workspace_member(t.workspace_id)
        and public.workspace_role_of(t.workspace_id) <> 'guest'
    )
  )
  with check (
    exists (
      select 1 from public.tasks t
      where t.id = task_id
        and public.is_workspace_member(t.workspace_id)
        and public.workspace_role_of(t.workspace_id) <> 'guest'
    )
  );

-- -------------------------------------------------------------------------
-- Realtime: publish projects and tasks so clients can subscribe.
-- Guarded because supabase_realtime already contains them after a re-run.
-- -------------------------------------------------------------------------
do $pub$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'projects'
  ) then
    alter publication supabase_realtime add table public.projects;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tasks'
  ) then
    alter publication supabase_realtime add table public.tasks;
  end if;
end $pub$;

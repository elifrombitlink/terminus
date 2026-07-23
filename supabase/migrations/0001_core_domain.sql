-- Terminus V1 core domain
-- Mutable operational records remain the source of current state. Every
-- meaningful change also produces an immutable event and outbox record.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists vector with schema extensions;

create schema if not exists terminus_private;
revoke all on schema terminus_private from public, anon, authenticated;

create type public.actor_type as enum ('user', 'agent', 'protocol', 'system');
create type public.mission_status as enum (
  'planned',
  'active',
  'paused',
  'blocked',
  'complete',
  'archived'
);
create type public.objective_status as enum (
  'queued',
  'active',
  'review',
  'blocked',
  'done',
  'cancelled'
);
create type public.priority_level as enum ('P0', 'P1', 'P2', 'P3');
create type public.risk_level as enum ('low', 'medium', 'high', 'critical');
create type public.approval_state as enum (
  'pending',
  'approved',
  'rejected',
  'held',
  'expired',
  'executed',
  'failed'
);
create type public.delivery_state as enum (
  'pending',
  'processing',
  'delivered',
  'failed',
  'dead_letter'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  callsign text,
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9_-]{2,24}$'),
  name text not null,
  description text not null default '',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null default '',
  is_system boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text not null,
  risk public.risk_level not null default 'low',
  created_at timestamptz not null default now()
);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.roles(id),
  state text not null default 'active' check (state in ('invited', 'active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table public.agents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  description text not null default '',
  role_id uuid not null references public.roles(id),
  auth_user_id uuid references auth.users(id) on delete set null,
  maximum_autonomous_risk public.risk_level not null default 'low',
  state text not null default 'standby'
    check (state in ('active', 'standby', 'disabled', 'error')),
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create sequence public.mission_code_seq;
create sequence public.objective_code_seq;

create table public.missions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  description text not null default '',
  status public.mission_status not null default 'planned',
  priority public.priority_level not null default 'P2',
  start_at timestamptz,
  due_at timestamptz,
  owner_user_id uuid references auth.users(id) on delete set null,
  owner_agent_id uuid references public.agents(id) on delete set null,
  ai_summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (organization_id, code),
  check (owner_user_id is null or owner_agent_id is null)
);

create table public.mission_dependencies (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  mission_id uuid not null references public.missions(id) on delete cascade,
  depends_on_mission_id uuid not null references public.missions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (mission_id, depends_on_mission_id),
  check (mission_id <> depends_on_mission_id)
);

create table public.objectives (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  mission_id uuid references public.missions(id) on delete set null,
  parent_objective_id uuid references public.objectives(id) on delete set null,
  code text not null,
  title text not null,
  description text not null default '',
  status public.objective_status not null default 'queued',
  priority public.priority_level not null default 'P2',
  due_at timestamptz,
  reminder_at timestamptz,
  owner_user_id uuid references auth.users(id) on delete set null,
  owner_agent_id uuid references public.agents(id) on delete set null,
  progress smallint not null default 0 check (progress between 0 and 100),
  ai_summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  archived_at timestamptz,
  unique (organization_id, code),
  check (owner_user_id is null or owner_agent_id is null)
);

create table public.objective_dependencies (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  objective_id uuid not null references public.objectives(id) on delete cascade,
  depends_on_objective_id uuid not null references public.objectives(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (objective_id, depends_on_objective_id),
  check (objective_id <> depends_on_objective_id)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  mission_id uuid references public.missions(id) on delete cascade,
  objective_id uuid references public.objectives(id) on delete cascade,
  author_user_id uuid references auth.users(id) on delete set null,
  author_agent_id uuid references public.agents(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (mission_id is not null or objective_id is not null),
  check (author_user_id is null or author_agent_id is null)
);

create table public.files (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  bucket text not null,
  object_path text not null,
  original_name text not null,
  mime_type text,
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  sha256 text,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (bucket, object_path)
);

create table public.record_files (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  file_id uuid not null references public.files(id) on delete cascade,
  mission_id uuid references public.missions(id) on delete cascade,
  objective_id uuid references public.objectives(id) on delete cascade,
  relation text not null default 'attachment',
  created_at timestamptz not null default now(),
  check (mission_id is not null or objective_id is not null),
  unique nulls not distinct (file_id, mission_id, objective_id, relation)
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  color text,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table public.objective_tags (
  objective_id uuid not null references public.objectives(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (objective_id, tag_id)
);

create table public.record_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  mission_id uuid references public.missions(id) on delete cascade,
  objective_id uuid references public.objectives(id) on delete cascade,
  link_type text not null,
  external_id text,
  url text,
  label text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (mission_id is not null or objective_id is not null)
);

create table public.modules (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  provider text not null,
  version text not null,
  manifest jsonb not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.module_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  module_id uuid not null references public.modules(id),
  name text not null,
  auth_type text not null,
  secret_reference text,
  configuration jsonb not null default '{}'::jsonb,
  state text not null default 'unconfigured',
  last_health_at timestamptz,
  last_health jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, module_id, name)
);

create table public.protocols (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  description text not null default '',
  definition jsonb not null,
  enabled boolean not null default false,
  risk public.risk_level not null default 'low',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table public.protocol_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  protocol_id uuid not null references public.protocols(id) on delete cascade,
  trigger_event_id uuid,
  state text not null default 'queued'
    check (state in ('queued', 'running', 'waiting_approval', 'succeeded', 'failed', 'cancelled')),
  attempt integer not null default 1 check (attempt > 0),
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  error jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  action_type text not null,
  requested_by_type public.actor_type not null,
  requested_by_id uuid,
  reason text not null,
  systems_affected text[] not null default '{}',
  expected_result text not null,
  risk public.risk_level not null,
  reversal_method text,
  payload jsonb not null default '{}'::jsonb,
  state public.approval_state not null default 'pending',
  decided_by uuid references auth.users(id) on delete set null,
  decision_reason text,
  decided_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  aggregate_type text not null,
  aggregate_id uuid not null,
  event_type text not null,
  event_version integer not null default 1 check (event_version > 0),
  actor_type public.actor_type not null,
  actor_id uuid,
  correlation_id uuid,
  causation_id uuid,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  recorded_at timestamptz not null default clock_timestamp()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid references public.events(id) on delete restrict,
  category text not null,
  severity text not null default 'info'
    check (severity in ('debug', 'info', 'warning', 'error', 'critical')),
  actor_type public.actor_type not null,
  actor_id uuid,
  message text not null,
  detail jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default clock_timestamp()
);

create table public.outbox (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete restrict,
  topic text not null,
  delivery_key text not null unique,
  payload jsonb not null,
  state public.delivery_state not null default 'pending',
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  delivered_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.knowledge_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_type text not null,
  source_id uuid,
  source_version text,
  chunk_index integer not null default 0,
  content text not null,
  content_hash text not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding extensions.vector(1536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (
    organization_id,
    source_type,
    source_id,
    source_version,
    chunk_index
  )
);

create table public.signals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  type text not null,
  severity text not null default 'info'
    check (severity in ('info', 'warning', 'error', 'critical')),
  title text not null,
  body text not null default '',
  source_type text,
  source_id uuid,
  recipient_user_id uuid references auth.users(id) on delete cascade,
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now()
);

create index memberships_user_org_idx
  on public.memberships (user_id, organization_id)
  where state = 'active';
create index missions_org_status_idx
  on public.missions (organization_id, status, due_at);
create index objectives_org_status_due_idx
  on public.objectives (organization_id, status, due_at);
create index objectives_mission_idx on public.objectives (mission_id);
create index comments_objective_idx on public.comments (objective_id, created_at);
create index events_aggregate_idx
  on public.events (organization_id, aggregate_type, aggregate_id, occurred_at desc);
create index events_type_idx
  on public.events (organization_id, event_type, occurred_at desc);
create index audit_log_org_time_idx
  on public.audit_log (organization_id, recorded_at desc);
create index outbox_ready_idx
  on public.outbox (state, available_at)
  where state in ('pending', 'failed');
create index signals_recipient_idx
  on public.signals (recipient_user_id, created_at desc)
  where dismissed_at is null;
create index knowledge_embedding_hnsw_idx
  on public.knowledge_items
  using hnsw (embedding vector_cosine_ops);

create or replace function terminus_private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
before update on public.profiles
for each row execute function terminus_private.set_updated_at();
create trigger organizations_updated_at
before update on public.organizations
for each row execute function terminus_private.set_updated_at();
create trigger memberships_updated_at
before update on public.memberships
for each row execute function terminus_private.set_updated_at();
create trigger agents_updated_at
before update on public.agents
for each row execute function terminus_private.set_updated_at();
create trigger missions_updated_at
before update on public.missions
for each row execute function terminus_private.set_updated_at();
create trigger objectives_updated_at
before update on public.objectives
for each row execute function terminus_private.set_updated_at();
create trigger comments_updated_at
before update on public.comments
for each row execute function terminus_private.set_updated_at();
create trigger modules_updated_at
before update on public.modules
for each row execute function terminus_private.set_updated_at();
create trigger module_connections_updated_at
before update on public.module_connections
for each row execute function terminus_private.set_updated_at();
create trigger protocols_updated_at
before update on public.protocols
for each row execute function terminus_private.set_updated_at();
create trigger approvals_updated_at
before update on public.approval_requests
for each row execute function terminus_private.set_updated_at();
create trigger outbox_updated_at
before update on public.outbox
for each row execute function terminus_private.set_updated_at();
create trigger knowledge_updated_at
before update on public.knowledge_items
for each row execute function terminus_private.set_updated_at();

create or replace function terminus_private.assign_record_code()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_table_name = 'missions' and (new.code is null or new.code = '') then
    new.code := 'MIS-' || lpad(nextval('public.mission_code_seq')::text, 4, '0');
  elsif tg_table_name = 'objectives' and (new.code is null or new.code = '') then
    new.code := 'OBJ-' || lpad(nextval('public.objective_code_seq')::text, 5, '0');
  end if;
  return new;
end;
$$;

create trigger missions_assign_code
before insert on public.missions
for each row execute function terminus_private.assign_record_code();
create trigger objectives_assign_code
before insert on public.objectives
for each row execute function terminus_private.assign_record_code();

create or replace function terminus_private.prevent_immutable_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception '% is append-only', tg_table_name
    using errcode = '55000';
end;
$$;

create trigger events_immutable
before update or delete on public.events
for each row execute function terminus_private.prevent_immutable_change();
create trigger audit_log_immutable
before update or delete on public.audit_log
for each row execute function terminus_private.prevent_immutable_change();

create or replace function terminus_private.capture_domain_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_event_id uuid;
  org_id uuid;
  agg_id uuid;
  event_name text;
  actor_kind public.actor_type;
  actor_uuid uuid;
  event_payload jsonb;
begin
  if tg_op = 'DELETE' then
    org_id := old.organization_id;
    agg_id := old.id;
  else
    org_id := new.organization_id;
    agg_id := new.id;
  end if;
  actor_uuid := auth.uid();
  actor_kind := case when actor_uuid is null then 'system'::public.actor_type
                     else 'user'::public.actor_type end;
  event_name := tg_table_name || '.' || lower(tg_op);
  event_payload := jsonb_build_object(
    'before', case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    'after', case when tg_op = 'DELETE' then null else to_jsonb(new) end
  );

  insert into public.events (
    organization_id,
    aggregate_type,
    aggregate_id,
    event_type,
    actor_type,
    actor_id,
    payload
  )
  values (
    org_id,
    tg_table_name,
    agg_id,
    event_name,
    actor_kind,
    actor_uuid,
    event_payload
  )
  returning id into new_event_id;

  insert into public.audit_log (
    organization_id,
    event_id,
    category,
    actor_type,
    actor_id,
    message,
    detail
  )
  values (
    org_id,
    new_event_id,
    'domain',
    actor_kind,
    actor_uuid,
    event_name || ' ' || agg_id::text,
    jsonb_build_object('table', tg_table_name, 'operation', tg_op)
  );

  insert into public.outbox (
    organization_id,
    event_id,
    topic,
    delivery_key,
    payload
  )
  values (
    org_id,
    new_event_id,
    'terminus.domain-events',
    new_event_id::text || ':1',
    jsonb_build_object(
      'eventId', new_event_id,
      'eventType', event_name,
      'aggregateType', tg_table_name,
      'aggregateId', agg_id,
      'organizationId', org_id
    )
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger missions_capture_event
after insert or update or delete on public.missions
for each row execute function terminus_private.capture_domain_event();
create trigger objectives_capture_event
after insert or update or delete on public.objectives
for each row execute function terminus_private.capture_domain_event();
create trigger approvals_capture_event
after insert or update or delete on public.approval_requests
for each row execute function terminus_private.capture_domain_event();

insert into public.permissions (code, description, risk) values
  ('organizations.read', 'View organization configuration.', 'low'),
  ('memberships.manage', 'Invite, assign, suspend, and remove members.', 'high'),
  ('missions.read', 'View missions and mission history.', 'low'),
  ('missions.write', 'Create and update missions.', 'medium'),
  ('missions.delete', 'Archive or delete missions.', 'high'),
  ('objectives.read', 'View objectives and linked records.', 'low'),
  ('objectives.write', 'Create and update objectives.', 'medium'),
  ('objectives.delete', 'Archive or delete objectives.', 'high'),
  ('archives.read', 'View internal archive records.', 'low'),
  ('archives.write', 'Create and update archive records.', 'medium'),
  ('modules.read', 'View module state and activity.', 'low'),
  ('modules.manage', 'Configure module credentials and permissions.', 'critical'),
  ('protocols.read', 'View protocol definitions and runs.', 'low'),
  ('protocols.manage', 'Create, enable, and update protocols.', 'high'),
  ('approvals.read', 'View command authorization requests.', 'medium'),
  ('approvals.decide', 'Approve or reject operational actions.', 'critical'),
  ('events.read', 'View mission log and audit events.', 'low'),
  ('agents.read', 'View agent definitions and activity.', 'low'),
  ('agents.manage', 'Configure agent tools and authority.', 'critical');

insert into public.roles (code, name, description) values
  ('administrator', 'Administrator', 'Full system and authorization access.'),
  ('operator', 'Operator', 'Manage routine missions, objectives, archives, and protocols.'),
  ('viewer', 'Viewer', 'Read-only access to assigned organization records.'),
  ('agent', 'Agent', 'Non-human role with explicitly granted operational capabilities.');

insert into public.role_permissions (role_id, permission_id)
select roles.id, permissions.id
from public.roles
cross join public.permissions
where roles.code = 'administrator';

insert into public.role_permissions (role_id, permission_id)
select roles.id, permissions.id
from public.roles
join public.permissions
  on permissions.code in (
    'organizations.read',
    'missions.read',
    'missions.write',
    'objectives.read',
    'objectives.write',
    'archives.read',
    'archives.write',
    'modules.read',
    'protocols.read',
    'protocols.manage',
    'approvals.read',
    'events.read',
    'agents.read'
  )
where roles.code = 'operator';

insert into public.role_permissions (role_id, permission_id)
select roles.id, permissions.id
from public.roles
join public.permissions
  on permissions.code in (
    'organizations.read',
    'missions.read',
    'objectives.read',
    'archives.read',
    'modules.read',
    'protocols.read',
    'events.read',
    'agents.read'
  )
where roles.code = 'viewer';

insert into public.role_permissions (role_id, permission_id)
select roles.id, permissions.id
from public.roles
join public.permissions
  on permissions.code in (
    'organizations.read',
    'missions.read',
    'objectives.read',
    'objectives.write',
    'archives.read',
    'modules.read',
    'protocols.read',
    'events.read',
    'agents.read'
  )
where roles.code = 'agent';

create or replace function terminus_private.bootstrap_organization_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.memberships (organization_id, user_id, role_id)
  select new.id, new.created_by, roles.id
  from public.roles
  where roles.code = 'administrator';
  return new;
end;
$$;

create trigger organizations_bootstrap_admin
after insert on public.organizations
for each row execute function terminus_private.bootstrap_organization_admin();

create or replace function terminus_private.has_permission(
  requested_organization_id uuid,
  requested_permission text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships
    join public.role_permissions
      on role_permissions.role_id = memberships.role_id
    join public.permissions
      on permissions.id = role_permissions.permission_id
    where memberships.organization_id = requested_organization_id
      and memberships.user_id = auth.uid()
      and memberships.state = 'active'
      and permissions.code = requested_permission
  );
$$;

revoke all on function terminus_private.has_permission(uuid, text)
  from public, anon;
grant usage on schema terminus_private to authenticated;
grant execute on function terminus_private.has_permission(uuid, text)
  to authenticated;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.memberships enable row level security;
alter table public.agents enable row level security;
alter table public.missions enable row level security;
alter table public.mission_dependencies enable row level security;
alter table public.objectives enable row level security;
alter table public.objective_dependencies enable row level security;
alter table public.comments enable row level security;
alter table public.files enable row level security;
alter table public.record_files enable row level security;
alter table public.tags enable row level security;
alter table public.objective_tags enable row level security;
alter table public.record_links enable row level security;
alter table public.modules enable row level security;
alter table public.module_connections enable row level security;
alter table public.protocols enable row level security;
alter table public.protocol_runs enable row level security;
alter table public.approval_requests enable row level security;
alter table public.events enable row level security;
alter table public.audit_log enable row level security;
alter table public.outbox enable row level security;
alter table public.knowledge_items enable row level security;
alter table public.signals enable row level security;

create policy profiles_read_self on public.profiles
for select to authenticated
using ((select auth.uid()) = id);
create policy profiles_insert_self on public.profiles
for insert to authenticated
with check ((select auth.uid()) = id);
create policy profiles_update_self on public.profiles
for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy organizations_create on public.organizations
for insert to authenticated
with check ((select auth.uid()) = created_by);
create policy organizations_read on public.organizations
for select to authenticated
using (terminus_private.has_permission(id, 'organizations.read'));
create policy organizations_update on public.organizations
for update to authenticated
using (terminus_private.has_permission(id, 'memberships.manage'))
with check (terminus_private.has_permission(id, 'memberships.manage'));

create policy roles_read on public.roles
for select to authenticated using (true);
create policy permissions_read on public.permissions
for select to authenticated using (true);
create policy role_permissions_read on public.role_permissions
for select to authenticated using (true);

create policy memberships_read on public.memberships
for select to authenticated
using (
  user_id = (select auth.uid())
  or terminus_private.has_permission(organization_id, 'memberships.manage')
);
create policy memberships_manage on public.memberships
for all to authenticated
using (terminus_private.has_permission(organization_id, 'memberships.manage'))
with check (terminus_private.has_permission(organization_id, 'memberships.manage'));

create policy agents_read on public.agents
for select to authenticated
using (terminus_private.has_permission(organization_id, 'agents.read'));
create policy agents_manage on public.agents
for all to authenticated
using (terminus_private.has_permission(organization_id, 'agents.manage'))
with check (terminus_private.has_permission(organization_id, 'agents.manage'));

create policy missions_read on public.missions
for select to authenticated
using (terminus_private.has_permission(organization_id, 'missions.read'));
create policy missions_create on public.missions
for insert to authenticated
with check (terminus_private.has_permission(organization_id, 'missions.write'));
create policy missions_update on public.missions
for update to authenticated
using (terminus_private.has_permission(organization_id, 'missions.write'))
with check (terminus_private.has_permission(organization_id, 'missions.write'));
create policy missions_delete on public.missions
for delete to authenticated
using (terminus_private.has_permission(organization_id, 'missions.delete'));

create policy mission_dependencies_read on public.mission_dependencies
for select to authenticated
using (terminus_private.has_permission(organization_id, 'missions.read'));
create policy mission_dependencies_write on public.mission_dependencies
for all to authenticated
using (terminus_private.has_permission(organization_id, 'missions.write'))
with check (terminus_private.has_permission(organization_id, 'missions.write'));

create policy objectives_read on public.objectives
for select to authenticated
using (terminus_private.has_permission(organization_id, 'objectives.read'));
create policy objectives_create on public.objectives
for insert to authenticated
with check (terminus_private.has_permission(organization_id, 'objectives.write'));
create policy objectives_update on public.objectives
for update to authenticated
using (terminus_private.has_permission(organization_id, 'objectives.write'))
with check (terminus_private.has_permission(organization_id, 'objectives.write'));
create policy objectives_delete on public.objectives
for delete to authenticated
using (terminus_private.has_permission(organization_id, 'objectives.delete'));

create policy objective_dependencies_read on public.objective_dependencies
for select to authenticated
using (terminus_private.has_permission(organization_id, 'objectives.read'));
create policy objective_dependencies_write on public.objective_dependencies
for all to authenticated
using (terminus_private.has_permission(organization_id, 'objectives.write'))
with check (terminus_private.has_permission(organization_id, 'objectives.write'));

create policy comments_read on public.comments
for select to authenticated
using (
  terminus_private.has_permission(organization_id, 'objectives.read')
  or terminus_private.has_permission(organization_id, 'missions.read')
);
create policy comments_write on public.comments
for all to authenticated
using (
  terminus_private.has_permission(organization_id, 'objectives.write')
  or terminus_private.has_permission(organization_id, 'missions.write')
)
with check (
  terminus_private.has_permission(organization_id, 'objectives.write')
  or terminus_private.has_permission(organization_id, 'missions.write')
);

create policy files_read on public.files
for select to authenticated
using (terminus_private.has_permission(organization_id, 'archives.read'));
create policy files_write on public.files
for all to authenticated
using (terminus_private.has_permission(organization_id, 'archives.write'))
with check (terminus_private.has_permission(organization_id, 'archives.write'));
create policy record_files_read on public.record_files
for select to authenticated
using (terminus_private.has_permission(organization_id, 'archives.read'));
create policy record_files_write on public.record_files
for all to authenticated
using (terminus_private.has_permission(organization_id, 'archives.write'))
with check (terminus_private.has_permission(organization_id, 'archives.write'));

create policy tags_read on public.tags
for select to authenticated
using (terminus_private.has_permission(organization_id, 'objectives.read'));
create policy tags_write on public.tags
for all to authenticated
using (terminus_private.has_permission(organization_id, 'objectives.write'))
with check (terminus_private.has_permission(organization_id, 'objectives.write'));
create policy objective_tags_read on public.objective_tags
for select to authenticated
using (
  exists (
    select 1 from public.objectives
    where objectives.id = objective_tags.objective_id
      and terminus_private.has_permission(
        objectives.organization_id,
        'objectives.read'
      )
  )
);
create policy objective_tags_write on public.objective_tags
for all to authenticated
using (
  exists (
    select 1 from public.objectives
    where objectives.id = objective_tags.objective_id
      and terminus_private.has_permission(
        objectives.organization_id,
        'objectives.write'
      )
  )
)
with check (
  exists (
    select 1 from public.objectives
    where objectives.id = objective_tags.objective_id
      and terminus_private.has_permission(
        objectives.organization_id,
        'objectives.write'
      )
  )
);

create policy record_links_read on public.record_links
for select to authenticated
using (terminus_private.has_permission(organization_id, 'objectives.read'));
create policy record_links_write on public.record_links
for all to authenticated
using (terminus_private.has_permission(organization_id, 'objectives.write'))
with check (terminus_private.has_permission(organization_id, 'objectives.write'));

create policy modules_read on public.modules
for select to authenticated using (true);
create policy module_connections_read on public.module_connections
for select to authenticated
using (terminus_private.has_permission(organization_id, 'modules.read'));
create policy module_connections_manage on public.module_connections
for all to authenticated
using (terminus_private.has_permission(organization_id, 'modules.manage'))
with check (terminus_private.has_permission(organization_id, 'modules.manage'));

create policy protocols_read on public.protocols
for select to authenticated
using (terminus_private.has_permission(organization_id, 'protocols.read'));
create policy protocols_manage on public.protocols
for all to authenticated
using (terminus_private.has_permission(organization_id, 'protocols.manage'))
with check (terminus_private.has_permission(organization_id, 'protocols.manage'));
create policy protocol_runs_read on public.protocol_runs
for select to authenticated
using (terminus_private.has_permission(organization_id, 'protocols.read'));

create policy approvals_read on public.approval_requests
for select to authenticated
using (terminus_private.has_permission(organization_id, 'approvals.read'));
create policy approvals_decide on public.approval_requests
for update to authenticated
using (terminus_private.has_permission(organization_id, 'approvals.decide'))
with check (terminus_private.has_permission(organization_id, 'approvals.decide'));

create policy events_read on public.events
for select to authenticated
using (terminus_private.has_permission(organization_id, 'events.read'));
create policy audit_log_read on public.audit_log
for select to authenticated
using (terminus_private.has_permission(organization_id, 'events.read'));

create policy knowledge_read on public.knowledge_items
for select to authenticated
using (terminus_private.has_permission(organization_id, 'archives.read'));
create policy knowledge_write on public.knowledge_items
for all to authenticated
using (terminus_private.has_permission(organization_id, 'archives.write'))
with check (terminus_private.has_permission(organization_id, 'archives.write'));

create policy signals_read on public.signals
for select to authenticated
using (
  recipient_user_id is null
  or recipient_user_id = (select auth.uid())
);
create policy signals_update on public.signals
for update to authenticated
using (
  recipient_user_id is null
  or recipient_user_id = (select auth.uid())
)
with check (
  recipient_user_id is null
  or recipient_user_id = (select auth.uid())
);

create view public.mission_log
with (security_invoker = true)
as
select
  events.id,
  events.organization_id,
  events.aggregate_type,
  events.aggregate_id,
  events.event_type,
  events.actor_type,
  events.actor_id,
  events.payload,
  events.occurred_at,
  audit_log.category,
  audit_log.severity,
  audit_log.message
from public.events
left join public.audit_log on audit_log.event_id = events.id;

grant select on public.mission_log to authenticated;

-- No client policy is intentionally created for outbox. It is a private
-- delivery concern accessed by the API/worker service role only.

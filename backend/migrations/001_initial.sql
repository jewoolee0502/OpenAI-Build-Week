create extension if not exists pgcrypto;

create table if not exists schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('child', 'guardian')),
  display_name text not null check (char_length(display_name) between 1 and 80),
  email text,
  password_hash text,
  child_public_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_role_fields_check check (
    (role = 'child' and child_public_id is not null and email is null and password_hash is null)
    or
    (role = 'guardian' and child_public_id is null and email is not null and password_hash is not null)
  )
);
create unique index if not exists users_guardian_email_unique_idx
  on users (lower(email)) where role = 'guardian';
create unique index if not exists users_child_public_id_unique_idx
  on users (child_public_id) where role = 'child';

create table if not exists auth_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  kind text not null check (kind in ('child_guest', 'guardian_web')),
  expires_at timestamptz not null,
  last_used_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists auth_sessions_user_id_idx on auth_sessions (user_id);
create index if not exists auth_sessions_active_token_idx
  on auth_sessions (token_hash, expires_at) where revoked_at is null;

create table if not exists guardian_links (
  guardian_user_id uuid not null references users(id) on delete cascade,
  child_user_id uuid not null references users(id) on delete cascade,
  status text not null default 'active' check (status in ('pending', 'active', 'revoked')),
  created_at timestamptz not null default now(),
  linked_at timestamptz,
  primary key (guardian_user_id, child_user_id),
  check (guardian_user_id <> child_user_id)
);
create index if not exists guardian_links_child_status_idx
  on guardian_links (child_user_id, status);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  child_user_id uuid not null references users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  status text not null default 'draft' check (status in ('draft', 'published')),
  current_version_id uuid,
  published_version_id uuid,
  public_slug text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists projects_child_updated_idx
  on projects (child_user_id, updated_at desc);
create index if not exists projects_published_slug_idx
  on projects (public_slug) where status = 'published';

create table if not exists project_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  prompt text not null check (char_length(prompt) between 1 and 1500),
  html text not null,
  created_at timestamptz not null default now(),
  unique (project_id, version_number),
  unique (project_id, id)
);
create index if not exists project_versions_project_created_idx
  on project_versions (project_id, created_at);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'projects_current_version_fk') then
    alter table projects add constraint projects_current_version_fk
      foreign key (id, current_version_id)
      references project_versions(project_id, id)
      deferrable initially deferred;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'projects_published_version_fk') then
    alter table projects add constraint projects_published_version_fk
      foreign key (id, published_version_id)
      references project_versions(project_id, id)
      deferrable initially deferred;
  end if;
end $$;

create table if not exists activity_events (
  id uuid primary key default gen_random_uuid(),
  child_user_id uuid not null references users(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  type text not null check (type in (
    'create', 'edit', 'playtest', 'reflection', 'publish', 'unpublish', 'insight_generated'
  )),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists activity_events_child_created_idx
  on activity_events (child_user_id, created_at desc);
create index if not exists activity_events_project_created_idx
  on activity_events (project_id, created_at desc);

create table if not exists creative_process_events (
  id uuid primary key default gen_random_uuid(),
  child_user_id uuid not null references users(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  project_version_id uuid references project_versions(id) on delete set null,
  type text not null check (type in ('game_plan', 'prediction', 'playtest', 'reflection')),
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists creative_process_events_project_created_idx
  on creative_process_events (project_id, created_at desc);
create index if not exists creative_process_events_child_created_idx
  on creative_process_events (child_user_id, created_at desc);

create table if not exists project_insights (
  id uuid primary key default gen_random_uuid(),
  child_user_id uuid not null references users(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  requested_by_guardian_user_id uuid not null references users(id) on delete cascade,
  summary text not null,
  dimensions jsonb not null,
  interests jsonb not null,
  conversation_starters jsonb not null,
  disclaimer text not null,
  created_at timestamptz not null default now()
);
create index if not exists project_insights_project_created_idx
  on project_insights (project_id, created_at desc);
create index if not exists project_insights_child_created_idx
  on project_insights (child_user_id, created_at desc);

create table if not exists creative_dimension_snapshots (
  id uuid primary key default gen_random_uuid(),
  child_user_id uuid not null references users(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  insight_id uuid references project_insights(id) on delete cascade,
  scope text not null check (scope in ('project', 'portfolio')),
  rubric_version text not null,
  source_version_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists creative_dimension_snapshots_child_created_idx
  on creative_dimension_snapshots (child_user_id, created_at desc);
create index if not exists creative_dimension_snapshots_project_created_idx
  on creative_dimension_snapshots (project_id, created_at desc) where project_id is not null;

create table if not exists creative_dimension_values (
  snapshot_id uuid not null references creative_dimension_snapshots(id) on delete cascade,
  dimension text not null check (dimension in (
    'imagination', 'expression', 'game_design', 'experimentation', 'iteration', 'reflection'
  )),
  level smallint not null check (level between 0 and 4),
  label text not null check (label in (
    'Not enough evidence', 'Emerging', 'Demonstrated', 'Repeated', 'Sustained'
  )),
  observation text not null,
  evidence jsonb not null,
  primary key (snapshot_id, dimension)
);

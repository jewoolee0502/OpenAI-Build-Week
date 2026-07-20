create table if not exists project_profile_images (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references projects(id) on delete cascade,
  source_prompt text not null check (char_length(source_prompt) between 1 and 1500),
  mime_type text not null check (mime_type in ('image/webp', 'image/svg+xml')),
  image_data bytea not null check (
    octet_length(image_data) between 1 and 10485760
  ),
  provider text not null check (provider in ('openai', 'demo')),
  model text not null check (char_length(model) between 1 and 80),
  fallback_reason text check (fallback_reason in ('moderation_blocked', 'provider_error')),
  created_at timestamptz not null default now()
);

insert into project_profile_images (
  project_id, source_prompt, mime_type, image_data, provider, model
)
select
  p.id,
  v.prompt,
  'image/svg+xml',
  convert_to(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><defs><linearGradient id="g"><stop stop-color="#4727a5"/><stop offset="1" stop-color="#ff8f70"/></linearGradient></defs><rect width="1024" height="1024" rx="180" fill="url(#g)"/><circle cx="512" cy="512" r="300" fill="none" stroke="white" stroke-opacity=".25" stroke-width="24"/><path d="M512 250 567 430 754 430 602 540 660 720 512 610 364 720 422 540 270 430 457 430Z" fill="white"/></svg>',
    'UTF8'
  ),
  'demo',
  'local-backfill-v1'
from projects p
join project_versions v on v.project_id = p.id and v.version_number = 1
on conflict (project_id) do nothing;

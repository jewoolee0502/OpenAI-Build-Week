alter table project_insights
  add column if not exists scope text,
  add column if not exists source_project_ids uuid[];

update project_insights
set scope = 'project'
where scope is null;

update project_insights
set source_project_ids = array[project_id]
where source_project_ids is null and project_id is not null;

update project_insights
set source_project_ids = '{}'::uuid[]
where source_project_ids is null;

alter table project_insights
  alter column project_id drop not null,
  alter column scope set default 'project',
  alter column scope set not null,
  alter column source_project_ids set default '{}'::uuid[],
  alter column source_project_ids set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'project_insights_scope_check'
  ) then
    alter table project_insights add constraint project_insights_scope_check
      check (scope in ('project', 'portfolio'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'project_insights_scope_project_check'
  ) then
    alter table project_insights add constraint project_insights_scope_project_check
      check (
        (scope = 'project' and project_id is not null)
        or (scope = 'portfolio' and project_id is null)
      );
  end if;
end $$;

create index if not exists project_insights_child_scope_created_idx
  on project_insights (child_user_id, scope, created_at desc);

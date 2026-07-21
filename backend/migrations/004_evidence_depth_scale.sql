alter table creative_dimension_values
  drop constraint if exists creative_dimension_values_level_check;

update creative_dimension_values
set level = case level
  when 0 then 0
  when 1 then 2
  when 2 then 5
  when 3 then 7
  when 4 then 10
  else level
end;

alter table creative_dimension_values
  add constraint creative_dimension_values_level_check
  check (level between 0 and 10);

update creative_dimension_snapshots
set rubric_version = 'creative-practice-v2'
where rubric_version = 'creative-practice-v1';

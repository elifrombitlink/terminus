-- Terminus — manual objective ordering.
-- Adds a sortable position so operators can hand-order the objective queue
-- independent of priority/due. Backfills existing rows in their current order.

alter table public.objectives
  add column if not exists position double precision;

update public.objectives o
set position = s.rn
from (
  select id,
         row_number() over (
           partition by organization_id
           order by priority, due_at nulls last, created_at
         ) as rn
  from public.objectives
) s
where s.id = o.id and o.position is null;

create index if not exists objectives_position_idx
  on public.objectives (organization_id, position);

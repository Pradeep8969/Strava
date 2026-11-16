-- Additive private library. Legacy client routes and recorded workouts are untouched.
create function public.valid_planned_route(p jsonb, route_id uuid)
returns boolean language plpgsql immutable set search_path = '' as $$
declare point jsonb; coordinate jsonb; i integer := 0;
begin
  if coalesce(jsonb_typeof(p) <> 'object' or (p->>'id')::uuid <> route_id
    or jsonb_typeof(p->'title') <> 'string'
    or p->>'kind' <> 'plan' or p->>'planningMode' <> 'straight-line'
    or length(btrim(p->>'title')) not between 1 and 120
    or jsonb_typeof(p->'points') <> 'array'
    or jsonb_array_length(p->'points') not between 2 and 10000
    or p->'geometry'->>'type' <> 'LineString'
    or jsonb_typeof(p->'geometry'->'coordinates') <> 'array'
    or jsonb_array_length(p->'geometry'->'coordinates') <> jsonb_array_length(p->'points')
    or jsonb_typeof(p->'distanceMeters') <> 'number'
    or (p->>'distanceMeters')::numeric < 0 or octet_length(p::text) > 4000000
    ,true) then return false; end if;
  -- Explicit required fields: SQL NULL must never let a CHECK pass accidentally.
  if not (p ?& array['id','kind','planningMode','title','points','geometry','distanceMeters','createdAt'])
    or not ((p->'geometry') ?& array['type','coordinates']) then return false; end if;
  for point in select value from jsonb_array_elements(p->'points') loop
    coordinate := p->'geometry'->'coordinates'->i;
    if coalesce(not (point ?& array['latitude','longitude'])
      or jsonb_typeof(point->'latitude') <> 'number' or jsonb_typeof(point->'longitude') <> 'number'
      or (point->>'latitude')::numeric not between -90 and 90
      or (point->>'longitude')::numeric not between -180 and 180
      or jsonb_typeof(coordinate) <> 'array' or jsonb_array_length(coordinate) <> 2
      or coordinate->0 <> point->'longitude' or coordinate->1 <> point->'latitude'
      ,true) then return false; end if;
    i := i + 1;
  end loop;
  return true;
exception when others then return false;
end $$;

create table public.planned_routes (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  plan jsonb not null,
  revision bigint not null default 1 check (revision > 0),
  mutation_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint valid_plan check (public.valid_planned_route(plan,id) is true)
);
create index planned_routes_owner_id on public.planned_routes(user_id,id);
alter table public.planned_routes enable row level security;
create policy planned_routes_owner_read on public.planned_routes for select to authenticated
  using (user_id = (select auth.uid()));
-- All mutations use a narrow RPC so clients cannot bypass revisions, ownership,
-- server timestamps or tombstones. No physical DELETE permission is granted.
revoke all on public.planned_routes from anon, authenticated;
grant select on public.planned_routes to authenticated;

create function public.write_planned_route(route_id uuid, expected_revision bigint,
  operation_id uuid, route_plan jsonb, remove_route boolean default false)
returns setof public.planned_routes language plpgsql security definer set search_path = '' as $$
declare owner_id uuid := auth.uid(); existing public.planned_routes;
begin
  if owner_id is null then raise insufficient_privilege using message = 'Authentication required'; end if;
  if expected_revision is null or expected_revision < 0 or operation_id is null or remove_route is null
    or not coalesce(public.valid_planned_route(route_plan,route_id),false)
    then raise check_violation using message = 'Invalid route'; end if;
  if expected_revision = 0 then
    insert into public.planned_routes(id,user_id,plan,mutation_id,deleted_at)
      values(route_id,owner_id,route_plan,operation_id,case when remove_route then now() end)
      on conflict(id) do nothing;
  end if;
  select * into existing from public.planned_routes where id = route_id for update;
  -- Return no private information for an ID belonging to somebody else.
  if existing.user_id is distinct from owner_id then return; end if;
  if existing.mutation_id = operation_id then return next existing; return; end if;
  if existing.revision <> expected_revision or existing.deleted_at is not null then return; end if;
  update public.planned_routes set plan = route_plan, revision = revision + 1,
    mutation_id = operation_id, updated_at = now(), deleted_at = case when remove_route then now() end
    where id = route_id returning * into existing;
  return next existing;
end $$;
revoke all on function public.write_planned_route(uuid,bigint,uuid,jsonb,boolean) from public, anon;
grant execute on function public.write_planned_route(uuid,bigint,uuid,jsonb,boolean) to authenticated;
revoke all on function public.valid_planned_route(jsonb,uuid) from public, anon;
grant execute on function public.valid_planned_route(jsonb,uuid) to authenticated;

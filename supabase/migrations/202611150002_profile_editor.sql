-- REVIEW ONLY: additive; existing profiles, avatars and activities are preserved.
create table public.athlete_details (
 id uuid primary key references public.profiles(id) on delete cascade,
 first_name text not null default '' check(length(first_name)<=80),
 last_name text not null default '' check(length(last_name)<=80),
 city text not null default '' check(length(city)<=100),
 province text not null default '' check(length(province)<=100),
 primary_sport text check(primary_sport in ('running','walking','cycling','hiking')),
 birthdate date check(birthdate <= current_date and birthdate >= current_date - interval '120 years'),
 gender text check(gender in ('woman','man','nonbinary','self-described','prefer-not-to-say')),
 weight_kg numeric check(weight_kg between 20 and 500),
 revision integer not null default 0
);
alter table public.athlete_details enable row level security;
revoke all on public.athlete_details from public,anon,authenticated;
grant select,insert,update on public.athlete_details to authenticated;
grant all on public.athlete_details to service_role;
create policy athlete_details_owner on public.athlete_details for all to authenticated
 using(id=auth.uid()) with check(id=auth.uid());

create function public.save_athlete_details(patch jsonb, details jsonb, expected jsonb, expected_revision integer)
returns void language plpgsql security invoker set search_path='' as $$
declare account_id uuid := auth.uid(); current_profile public.profiles; current_revision integer; key text;
begin
 if account_id is null then raise exception 'Authentication required'; end if;
 if jsonb_typeof(patch)<>'object' or jsonb_typeof(details)<>'object' or jsonb_typeof(expected)<>'object' then raise exception 'Invalid profile data'; end if;
 if exists(select 1 from jsonb_object_keys(patch) k where k not in ('name','username','bio','is_private','avatar_path')) then raise exception 'Unsupported profile field'; end if;
 select * into current_profile from public.profiles where id=account_id for update;
 if not found then raise exception 'Profile missing'; end if;
 for key in select jsonb_object_keys(patch) loop
   if not (expected ? key) or (to_jsonb(current_profile)->key) is distinct from (expected->key) then raise exception 'Profile changed elsewhere. Reopen the editor.'; end if;
 end loop;
 select revision into current_revision from public.athlete_details where id=account_id;
 if coalesce(current_revision,0) is distinct from expected_revision then raise exception 'Profile details changed elsewhere. Reopen the editor.'; end if;
 if length(btrim(details->>'first_name'))=0 or length(btrim(patch->>'name'))=0 then raise exception 'Name is required'; end if;
 if patch ? 'avatar_path' and patch->>'avatar_path' is not null then
   if patch->>'avatar_path' ~ '^https://' then
     if patch->>'avatar_path' !~ '^https://[^/@[:space:]]+([/:?][^[:space:]]*)?$' then raise exception 'Invalid photo URL'; end if;
   elsif split_part(patch->>'avatar_path','/',1)<>account_id::text or not exists(
     select 1 from storage.objects where bucket_id='avatars' and name=patch->>'avatar_path'
   ) then raise exception 'Avatar must be an uploaded image owned by this account'; end if;
 end if;
 update public.profiles set
  name=case when patch ? 'name' then patch->>'name' else name end,
  username=case when patch ? 'username' then patch->>'username' else username end,
  bio=case when patch ? 'bio' then patch->>'bio' else bio end,
  is_private=case when patch ? 'is_private' then (patch->>'is_private')::boolean else is_private end,
  avatar_path=case when patch ? 'avatar_path' then patch->>'avatar_path' else avatar_path end
 where id=account_id;
 insert into public.athlete_details(id,first_name,last_name,city,province,primary_sport,birthdate,gender,weight_kg,revision)
 values(account_id,btrim(details->>'first_name'),btrim(details->>'last_name'),btrim(details->>'city'),btrim(details->>'province'),details->>'primary_sport',(details->>'birthdate')::date,details->>'gender',(details->>'weight_kg')::numeric,coalesce(current_revision,0)+1)
 on conflict(id) do update set first_name=excluded.first_name,last_name=excluded.last_name,city=excluded.city,province=excluded.province,primary_sport=excluded.primary_sport,birthdate=excluded.birthdate,gender=excluded.gender,weight_kg=excluded.weight_kg,revision=excluded.revision;
end $$;
revoke all on function public.save_athlete_details(jsonb,jsonb,jsonb,integer) from public,anon;
grant execute on function public.save_athlete_details(jsonb,jsonb,jsonb,integer) to authenticated;

-- Keep avatars private, with immutable account-prefixed object names.
-- Existing avatar_owner policy already enforces owner-only read/write/delete.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('avatars','avatars',false,5242880,array['image/jpeg','image/png','image/webp'])
 on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','image/webp'];
notify pgrst,'reload schema';

-- REVIEW REQUIRED. No existing profile is updated; no auth or activity data is changed.
-- avatar_path supports either an existing private Storage key or an HTTPS provider URL.
create or replace function public.ensure_athlete_profile() returns void
language plpgsql security definer set search_path='' as $$
declare
 account_id uuid := auth.uid();
 metadata jsonb;
 display_name text;
 photo text;
begin
 if account_id is null then raise exception 'Authentication required'; end if;
 select raw_user_meta_data into metadata from auth.users where id=account_id;
 if not found then raise exception 'Authenticated account not found'; end if;
 display_name := left(coalesce(nullif(btrim(metadata->>'full_name'),''),nullif(btrim(metadata->>'name'),''),nullif(btrim(metadata->>'display_name'),''),''),80);
 photo := coalesce(nullif(btrim(metadata->>'avatar_url'),''),case when jsonb_typeof(metadata->'picture')='string' then nullif(btrim(metadata->>'picture'),'') end,nullif(btrim(metadata#>>'{picture,data,url}'),''));
 if photo !~ '^https://[^[:space:]]+$' then photo := null; end if;
 insert into public.profiles(id,name,avatar_path) values(account_id,display_name,photo)
 on conflict(id) do nothing;
 insert into public.user_settings(user_id) values(account_id) on conflict(user_id) do nothing;
end $$;
revoke all on function public.ensure_athlete_profile() from public,anon,authenticated;
grant execute on function public.ensure_athlete_profile() to authenticated;

create or replace function public.create_profile() returns trigger
language plpgsql security definer set search_path='' as $$
declare
 metadata jsonb := new.raw_user_meta_data;
 display_name text;
 photo text;
begin
 display_name := left(coalesce(nullif(btrim(metadata->>'full_name'),''),nullif(btrim(metadata->>'name'),''),nullif(btrim(metadata->>'display_name'),''),''),80);
 photo := coalesce(nullif(btrim(metadata->>'avatar_url'),''),case when jsonb_typeof(metadata->'picture')='string' then nullif(btrim(metadata->>'picture'),'') end,nullif(btrim(metadata#>>'{picture,data,url}'),''));
 if photo !~ '^https://[^[:space:]]+$' then photo := null; end if;
 insert into public.profiles(id,name,avatar_path) values(new.id,display_name,photo) on conflict(id) do nothing;
 insert into public.user_settings(user_id) values(new.id) on conflict(user_id) do nothing;
 insert into public.notifications(user_id,kind,title,body)
 values(new.id,'welcome','Welcome to StravaKinda!','Your adventure starts here. Track your first activity, discover Nepal''s trails, and connect with fellow athletes.')
 on conflict(user_id) where kind='welcome' do nothing;
 return new;
end $$;
revoke all on function public.create_profile() from public,anon,authenticated;

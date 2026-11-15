-- Additive recovery for auth accounts created before the application schema.
-- Keep the existing auth INSERT trigger; never update/delete auth.users.
-- No metadata/username guessing, profile overwrite, or retrospective welcome.
create or replace function public.create_profile() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id) values(new.id) on conflict(id) do nothing;
 insert into public.user_settings(user_id) values(new.id) on conflict(user_id) do nothing;
 insert into public.notifications(user_id,kind,title,body)
 values(new.id,'welcome',U&'Welcome to StravaKinda! \+01F3D4\FE0F','Your adventure starts here. Track your first activity, discover Nepal''s trails, and connect with fellow athletes.')
 on conflict(user_id) where kind='welcome' do nothing;
 return new;
end $$;
revoke all on function public.create_profile() from public,anon,authenticated;

-- Primary-key conflict handling makes reruns and concurrent signups safe.
-- Settings are repaired independently even if a profile already existed.
insert into public.profiles(id)
select id from auth.users
on conflict(id) do nothing;

insert into public.user_settings(user_id)
select id from auth.users
on conflict(user_id) do nothing;

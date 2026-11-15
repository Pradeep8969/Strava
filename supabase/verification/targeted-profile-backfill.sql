-- OPTIONAL ADMIN REPAIR after schema deployment; the migration already repairs ALL users.
-- Replace only the UUID string below. No secret key, email or OAuth token is needed.
-- Repeated execution is safe; does not overwrite profile/settings or send notifications.
begin;
select set_config('stravakinda.backfill_user_id','REPLACE_WITH_AUTH_USER_UUID',true);
do $$
declare target uuid := current_setting('stravakinda.backfill_user_id')::uuid;
begin
 if not exists(select 1 from auth.users where id=target) then
  raise exception 'Auth user does not exist; no profile was created';
 end if;
 insert into public.profiles(id) values(target) on conflict(id) do nothing;
 insert into public.user_settings(user_id) values(target) on conflict(user_id) do nothing;
end $$;
commit;

-- Disposable LOCAL database only. All fixture changes roll back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);
insert into auth.users(id,email,raw_app_meta_data) values
 ('71000000-0000-4000-8000-000000000001','missing-profile@example.test','{"provider":"google"}'),
 ('71000000-0000-4000-8000-000000000002','keep-profile@example.test','{"provider":"google"}'),
 ('71000000-0000-4000-8000-000000000003','missing-settings@example.test','{"provider":"email"}');
-- Only synthetic fixtures are changed: simulate auth predating the schema.
delete from public.profiles where id='71000000-0000-4000-8000-000000000001';
update public.profiles set name='Keep this name',username='keep_this_name',is_private=true
 where id='71000000-0000-4000-8000-000000000002';
update public.user_settings set units='mi',notifications_enabled=true
 where user_id='71000000-0000-4000-8000-000000000002';
delete from public.user_settings where user_id='71000000-0000-4000-8000-000000000003';

-- Supabase CLI pg_prove mounts tests, not sibling migration files.
-- Keep this payload identical to the migration (checked by Vitest).
-- The transaction-local helper replays the complete migration twice.
create function pg_temp.replay_profile_backfill() returns void
language plpgsql as $replay$
begin
 execute $migration$
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
$migration$;
end;
$replay$;
do $$begin perform pg_temp.replay_profile_backfill(); end$$;
select is((select count(*)::integer from auth.users where id::text like '71000000-%'),3,'Backfill preserves existing auth users');
select is((select count(*)::integer from public.profiles where id::text like '71000000-%'),3,'Missing profiles repaired');
select is((select count(*)::integer from public.user_settings where user_id::text like '71000000-%'),3,'Missing settings repaired independently');
select is((select name from public.profiles where id='71000000-0000-4000-8000-000000000002'),'Keep this name','Existing name preserved');
select is((select username from public.profiles where id='71000000-0000-4000-8000-000000000002'),'keep_this_name','Existing username preserved');
select ok((select is_private from public.profiles where id='71000000-0000-4000-8000-000000000002'),'Existing privacy preserved');
select is((select units from public.user_settings where user_id='71000000-0000-4000-8000-000000000002'),'mi','Existing settings preserved');
select ok((select notifications_enabled from public.user_settings where user_id='71000000-0000-4000-8000-000000000002'),'Existing consent preserved');
select is((select count(*)::integer from public.notifications where user_id='71000000-0000-4000-8000-000000000001'),0,'Returning account does not receive a retrospective welcome');
select is((select count(*)::integer from public.notifications where user_id='71000000-0000-4000-8000-000000000002'),1,'Existing welcome preserved');
select is((select count(*)::integer from public.notifications where user_id='71000000-0000-4000-8000-000000000003'),1,'Repairing settings does not duplicate welcome');

do $$begin perform pg_temp.replay_profile_backfill(); end$$;
select is((select count(*)::integer from public.profiles where id::text like '71000000-%'),3,'Rerun creates no duplicate profiles');
select is((select count(*)::integer from public.user_settings where user_id::text like '71000000-%'),3,'Rerun creates no duplicate settings');
select is((select count(*)::integer from public.notifications where user_id::text like '71000000-%'),2,'Rerun creates no extra notifications');
insert into auth.users(id,email) values('71000000-0000-4000-8000-000000000004','new-signup@example.test');
select is((select count(*)::integer from public.notifications where user_id='71000000-0000-4000-8000-000000000004' and kind='welcome'),1,'Future signup still gets one welcome');
update auth.users set last_sign_in_at=now() where id='71000000-0000-4000-8000-000000000004';
select is((select count(*)::integer from public.notifications where user_id='71000000-0000-4000-8000-000000000004' and kind='welcome'),1,'Returning login never resends welcome');
select is((select count(*)::integer from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity),0,'All application tables keep RLS');
select is((select count(*)::integer from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and has_table_privilege('authenticated',c.oid,'TRUNCATE')),0,'No client TRUNCATE privileges');
select ok(not has_function_privilege('authenticated','public.create_profile()','EXECUTE'),'Initializer is not a client RPC');
select ok(has_function_privilege('service_role','public.claim_notification_push_jobs()','EXECUTE'),'Worker still has its server RPC');
set local role authenticated;
select set_config('request.jwt.claim.sub','71000000-0000-4000-8000-000000000001',true);
select throws_ok($$insert into public.profiles(id) values(auth.uid())$$,'42501',null,'Clients cannot create duplicate profiles');
update public.profiles set name='Owner edit' where id=auth.uid();
select is((select name from public.profiles where id=auth.uid()),'Owner edit','Owner profile editor remains usable');
select throws_ok($$update public.profiles set created_at=now() where id=auth.uid()$$,'42501',null,'Profile creation time is protected');
select is((select count(*)::integer from public.profiles where id='71000000-0000-4000-8000-000000000002'),0,'Other private profile stays hidden');
reset role;
select * from finish();
rollback;

-- Run with `supabase test db` on a disposable project AFTER all migrations. Fixtures roll back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);
insert into auth.users(id,email,raw_app_meta_data) values
 ('60000000-0000-4000-8000-000000000001','email@example.test','{"provider":"email"}'),
 ('60000000-0000-4000-8000-000000000002','google@example.test','{"provider":"google"}'),
 ('60000000-0000-4000-8000-000000000003','facebook@example.test','{"provider":"facebook"}');
select is((select count(*)::integer from public.notifications where user_id::text like '60000000-%' and kind='welcome'),3,'Each newly inserted auth user receives one welcome');
update auth.users set last_sign_in_at=now() where id::text like '60000000-%';
select is((select count(*)::integer from public.notifications where user_id::text like '60000000-%'),3,'Returning sign-ins do not create welcomes');
select throws_ok($$insert into public.notifications(user_id,kind,title,body) values('60000000-0000-4000-8000-000000000001','welcome','Duplicate','Duplicate')$$,'23505',null,'Unique welcome survives client/device resets');
select is((select count(*)::integer from public.notification_push_jobs where user_id::text like '60000000-%'),3,'One durable push job per welcome');
select is((select count(*)::integer from public.claim_notification_push_jobs()),0,'No push is claimed before token registration and consent');
set local role authenticated;
select set_config('request.jwt.claim.sub','60000000-0000-4000-8000-000000000001',true);
select is((select count(*)::integer from public.notifications),1,'User sees only their own notification');
update public.notifications set read_at=now() where user_id=auth.uid();
select is((select count(*)::integer from public.notifications where read_at is not null),1,'User can mark own notification read');
update public.notifications set read_at=now() where user_id='60000000-0000-4000-8000-000000000002';
select throws_ok($$insert into public.notifications(user_id,kind,body) values(auth.uid(),'welcome','Fake')$$,'42501',null,'Client cannot generate notifications');
select throws_ok($$update public.notifications set body='Tampered' where user_id=auth.uid()$$,'42501',null,'Client cannot modify message');
select throws_ok($$update public.notifications set user_id='60000000-0000-4000-8000-000000000002'$$,'42501',null,'Client cannot reassign notifications');
select throws_ok($$delete from public.notifications where user_id=auth.uid()$$,'42501',null,'Client cannot delete welcome to reset welcome status');
select throws_ok($$select * from public.claim_notification_push_jobs()$$,'42501',null,'Client cannot invoke push worker');
select throws_ok($$select * from public.push_devices$$,'42501',null,'Device tokens are not client-readable');
select set_config('request.jwt.claim.sub','60000000-0000-4000-8000-000000000002',true);
select is((select count(*)::integer from public.notifications where read_at is not null),0,'Another user cannot mark this account read');
reset role;
select is((select body from public.notifications where user_id='60000000-0000-4000-8000-000000000001'),'Your adventure starts here. Track your first activity, discover Nepal''s trails, and connect with fellow athletes.','Welcome text is exact');
set local role anon;
select throws_ok($$select * from public.notifications$$,'42501',null,'Anonymous access denied');
select * from finish();
rollback;

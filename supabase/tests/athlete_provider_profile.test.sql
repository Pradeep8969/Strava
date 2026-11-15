-- Disposable test database only, after all migrations. Every fixture rolls back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);
insert into auth.users(id,email,raw_user_meta_data) values
 ('72000000-0000-4000-8000-000000000001','google-profile@example.test','{"full_name":"Google Runner","avatar_url":"https://example.test/google.jpg"}'),
 ('72000000-0000-4000-8000-000000000002','facebook-profile@example.test','{"name":"Facebook Runner","picture":{"data":{"url":"https://example.test/facebook.jpg"}}}'),
 ('72000000-0000-4000-8000-000000000003','email-profile@example.test','{}');
select is((select name from public.profiles where id='72000000-0000-4000-8000-000000000001'),'Google Runner','Google display name initialized under auth ID');
select is((select avatar_path from public.profiles where id='72000000-0000-4000-8000-000000000001'),'https://example.test/google.jpg','Google avatar initialized');
select is((select avatar_path from public.profiles where id='72000000-0000-4000-8000-000000000002'),'https://example.test/facebook.jpg','Facebook nested picture supported');
select is((select name from public.profiles where id='72000000-0000-4000-8000-000000000003'),'','Email account supports empty metadata');
update public.profiles set name='Custom Runner',bio='Keep bio',avatar_path='custom/private.jpg',is_private=true where id='72000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','72000000-0000-4000-8000-000000000001',true);
select public.ensure_athlete_profile();
select public.ensure_athlete_profile();
select is((select name from public.profiles where id=auth.uid()),'Custom Runner','Repeated synchronization preserves customized name');
select is((select bio from public.profiles where id=auth.uid()),'Keep bio','Customized bio preserved');
select is((select avatar_path from public.profiles where id=auth.uid()),'custom/private.jpg','Custom storage avatar preserved');
select ok((select is_private from public.profiles where id=auth.uid()),'Custom privacy preserved');
select is((select count(*)::integer from public.profiles where id=auth.uid()),1,'Repeated calls do not duplicate profile');
reset role;
delete from public.profiles where id='72000000-0000-4000-8000-000000000003';
set local role authenticated;
select set_config('request.jwt.claim.sub','72000000-0000-4000-8000-000000000003',true);
select public.ensure_athlete_profile();
select is((select count(*)::integer from public.profiles where id=auth.uid()),1,'Missing own profile repaired without INSERT grant');
select set_config('request.jwt.claim.sub','',true);
select throws_ok('select public.ensure_athlete_profile()','P0001','Authentication required','Missing identity cannot repair profiles');
reset role;
select ok(not has_function_privilege('anon','public.ensure_athlete_profile()','EXECUTE'),'Anonymous RPC access denied');
select * from finish();
rollback;

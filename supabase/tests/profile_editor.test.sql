-- Disposable test project only, after all migrations. No deployed data changes.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);
insert into auth.users(id,email,raw_user_meta_data) values
 ('73000000-0000-4000-8000-000000000001','details-a@example.test','{"name":"Runner"}'),
 ('73000000-0000-4000-8000-000000000002','details-b@example.test','{}');
set local role authenticated;
select set_config('request.jwt.claim.sub','73000000-0000-4000-8000-000000000001',true);
select public.save_athlete_details('{"name":"Maya Sherpa"}',
 '{"first_name":"Maya","last_name":"Sherpa","city":"Pokhara","province":"Gandaki","primary_sport":"running","birthdate":"1993-05-12","gender":null,"weight_kg":65.5}',
 '{"name":"Runner"}',0);
select is((select name from public.profiles where id=auth.uid()),'Maya Sherpa','Display name saved');
select is((select city from public.athlete_details where id=auth.uid()),'Pokhara','City saved');
select is((select revision from public.athlete_details where id=auth.uid()),1,'Revision advanced');
select is((select weight_kg::text from public.athlete_details where id=auth.uid()),'65.5','Weight saved privately');
select throws_ok($$select public.save_athlete_details('{}','{"first_name":"Maya"}','{}',0)$$,'P0001','Profile details changed elsewhere. Reopen the editor.','Concurrent editor rejected');
select set_config('request.jwt.claim.sub','73000000-0000-4000-8000-000000000002',true);
select is((select count(*)::integer from public.athlete_details),0,'Another account cannot read personal details');
reset role;
select ok(not has_table_privilege('anon','public.athlete_details','SELECT'),'Anonymous details access denied');
select ok(not has_function_privilege('anon','public.save_athlete_details(jsonb,jsonb,jsonb,integer)','EXECUTE'),'Anonymous editing denied');
select * from finish();
rollback;

-- Read-only admin checks AFTER all seven migrations. Does not test RLS by itself.
select version from supabase_migrations.schema_migrations order by version;
select count(*) as auth_users_after from auth.users;
select count(*) as missing_profiles from auth.users u
 left join public.profiles p on p.id=u.id where p.id is null;
select count(*) as missing_settings from auth.users u
 left join public.user_settings s on s.user_id=u.id where s.user_id is null;
select id,count(*) from public.profiles group by id having count(*)>1;
select user_id,count(*) from public.user_settings group by user_id having count(*)>1;
select user_id,count(*) from public.notifications where kind='welcome'
 group by user_id having count(*)>1;

-- All 25 application tables must report rls_enabled=true. No new tables in repairs.
select c.relname as table_name,c.relrowsecurity as rls_enabled,
 (select count(*) from pg_policy p where p.polrelid=c.oid) as policy_count
 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind='r' order by c.relname;
select tablename,policyname,roles,cmd,qual,with_check from pg_policies
 where schemaname='public' order by tablename,policyname;
select conrelid::regclass as source_table,conname,confrelid::regclass as target_table,
 convalidated,pg_get_constraintdef(oid) as definition from pg_constraint
 where contype='f' and connamespace='public'::regnamespace
 order by conrelid::regclass::text,conname;

select tgrelid::regclass as source_table,tgname,pg_get_triggerdef(oid) as definition
 from pg_trigger where not tgisinternal and tgrelid in
 ('auth.users'::regclass,'public.notifications'::regclass,
  'public.comments'::regclass,'public.activity_reactions'::regclass,
  'public.follows'::regclass,'public.reports'::regclass);
select pg_get_functiondef('public.create_profile()'::regprocedure);
select pg_get_functiondef('public.claim_notification_push_jobs()'::regprocedure);
select indexdef from pg_indexes where schemaname='public'
 and indexname='notifications_one_welcome_per_user';
select pubname,schemaname,tablename from pg_publication_tables
 where pubname='supabase_realtime' and schemaname='public' and tablename='notifications';
select id,public,file_size_limit,allowed_mime_types from storage.buckets where id='avatars';

-- Neither secrets, raw GPS nor device tokens are selected by this file.
select grantee,table_name,privilege_type from information_schema.role_table_grants
 where table_schema='public' and grantee in ('anon','authenticated','service_role')
 order by table_name,grantee,privilege_type;
select grantee,table_name,column_name,privilege_type from information_schema.column_privileges
 where table_schema='public' and table_name in ('profiles','notifications')
 and grantee='authenticated' and privilege_type='UPDATE'
 order by table_name,column_name;
select p.proname,p.prosecdef,p.proconfig,
 has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
 has_function_privilege('service_role',p.oid,'EXECUTE') as service_execute
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' order by p.proname;
select count(*) as client_truncate_grants from pg_class c
 join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
 and c.relkind='r' and (has_table_privilege('anon',c.oid,'TRUNCATE')
 or has_table_privilege('authenticated',c.oid,'TRUNCATE'));

-- Read-only, safe before any application tables exist. Run as project SQL admin.
select current_database() as database_name, current_user as database_role;
select count(*) as auth_users_before from auth.users;
select schemaname,tablename from pg_tables
 where schemaname='public' order by tablename;
select to_regclass('public.profiles') as profiles,
 to_regclass('public.club_members') as club_members,
 to_regclass('supabase_migrations.schema_migrations') as migration_history;
select e.extname,n.nspname as extension_schema from pg_extension e
 join pg_namespace n on n.oid=e.extnamespace where e.extname in ('postgis','pgcrypto');
select tgname,pg_get_triggerdef(oid) as definition from pg_trigger
 where tgrelid='auth.users'::regclass and not tgisinternal;
select c.relname,c.relkind from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind in ('v','m','f','p') order by c.relname;
select p.proname,pg_get_function_identity_arguments(p.oid) as arguments
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and not exists(
  select 1 from pg_depend d where d.classid='pg_proc'::regclass
  and d.objid=p.oid and d.deptype='e'
 ) order by p.proname;
select id,public,file_size_limit,allowed_mime_types from storage.buckets where id='avatars';
select policyname,roles,cmd,qual,with_check from pg_policies
 where schemaname='storage' and tablename='objects' and policyname='avatar_owner';
-- Inspect auth INSERT triggers for custom provisioning before applying the baseline.
-- Use CLI `migration list --remote` to inspect history even when its table is absent.

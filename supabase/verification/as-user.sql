-- Replace the UUID below with Authentication > Users > your existing user's ID.
-- SQL-admin impersonation tests database policies, not OAuth/JWT verification.
begin read only;
select set_config('request.jwt.claim.sub','REPLACE_WITH_AUTH_USER_UUID',true);
set local role authenticated;
select auth.uid() as simulated_user_id;
select id,name,username,is_private from public.profiles where id=auth.uid();
select count(*) as own_settings from public.user_settings where user_id=auth.uid();
select club_id,joined_at from public.club_members where user_id=auth.uid();
select count(*) as other_memberships_visible from public.club_members where user_id<>auth.uid();
select count(*) as other_private_activities_visible from public.activities
 where visibility='private' and user_id<>auth.uid();
select count(*) as non_owner_points_visible from public.activity_points p
 where not exists(select 1 from public.activities a where a.id=p.activity_id and a.user_id=auth.uid());
select count(*) as other_inbox_rows_visible from public.notifications where user_id<>auth.uid();
select count(*) as own_welcome_count from public.notifications where user_id=auth.uid() and kind='welcome';
rollback;

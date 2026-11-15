-- RETURNS TABLE creates a PL/pgSQL variable named attempts. Qualify job columns
-- so the pending-job update does not collide with that output parameter.
create or replace function public.claim_notification_push_jobs()
returns table(notification_id uuid,user_id uuid,expo_token text,title text,body text,attempts integer)
language plpgsql security definer set search_path='' as $$
begin
 update public.notification_push_jobs j set state='uncertain',updated_at=now()
 where j.state='sending' and j.updated_at<now()-interval '5 minutes';
 update public.notification_push_jobs j set state='failed',updated_at=now()
 where j.state='pending' and j.attempts>=5;
 return query
 with candidates as (
  select j.notification_id,d.installation_id,d.expo_token from public.notification_push_jobs j
  join public.user_settings s on s.user_id=j.user_id and s.notifications_enabled
  join lateral(select p.installation_id,p.expo_token from public.push_devices p
   where p.user_id=j.user_id and p.enabled and p.registered_at>now()-interval '30 days'
   order by p.registered_at desc limit 1)d on true
  where j.state='pending' and j.next_attempt_at<=now() and j.attempts<5
  order by j.next_attempt_at limit 25 for update of j skip locked
 ), claimed as (
  update public.notification_push_jobs j set state='sending',attempts=j.attempts+1,
   installation_id=c.installation_id,target_token=c.expo_token,updated_at=now()
  from candidates c where j.notification_id=c.notification_id
  returning j.notification_id,j.user_id,j.attempts,c.expo_token
 ) select c.notification_id,c.user_id,c.expo_token,n.title,n.body,c.attempts
 from claimed c join public.notifications n on n.id=c.notification_id;
end $$;
revoke all on function public.claim_notification_push_jobs() from public,anon,authenticated;
grant execute on function public.claim_notification_push_jobs() to service_role;
notify pgrst, 'reload schema';

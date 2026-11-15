-- Make API grants deterministic instead of relying on project default grants.
-- This changes privileges only; all existing RLS policies remain enabled/intact.
do $$
declare t text;
begin
 foreach t in array array[
  'profiles','user_settings','blocks','follows','activities','activity_points',
  'routes','activity_reactions','comments','clubs','club_members','challenges',
  'challenge_entries','segments','segment_efforts','subscriptions',
  'training_metrics','ai_insights','notifications','privacy_zones','reports',
  'ai_usage','social_rate_limits','push_devices','notification_push_jobs'
 ] loop
  execute format('revoke all on table public.%I from public,anon,authenticated',t);
  execute format('grant all on table public.%I to service_role',t);
 end loop;
end $$;
grant usage on schema public to anon,authenticated,service_role;

grant select on public.profiles to authenticated;
grant update(name,username,bio,is_private,avatar_path) on public.profiles to authenticated;
grant select,insert,update,delete on public.user_settings,public.blocks,
 public.routes,public.clubs,public.segments,public.privacy_zones to authenticated;
grant select,insert,delete on public.follows,public.activity_reactions,
 public.comments,public.club_members,public.challenge_entries to authenticated;
grant select,delete on public.activities to authenticated;
grant select on public.activity_points,public.challenges,public.segment_efforts,
 public.subscriptions,public.training_metrics,public.ai_insights to authenticated;
grant select,insert on public.reports to authenticated;
grant select,update(read_at) on public.notifications to authenticated;
-- Preserve the existing anonymous summary test/API behavior: zero rows via RLS.
-- There are no anonymous activity policies, so this grants no activity visibility.
grant select on public.activities to anon;

revoke all on function public.save_workout(jsonb),public.can_view_activity(uuid),
 public.is_blocked(uuid),public.register_push_device(uuid,text,text,boolean),
 public.disable_push_device(uuid) from public,anon,authenticated;
grant execute on function public.save_workout(jsonb),public.can_view_activity(uuid),
 public.is_blocked(uuid),public.register_push_device(uuid,text,text,boolean),
 public.disable_push_device(uuid) to authenticated;
revoke all on function public.reserve_ai_request(uuid),public.claim_notification_push_jobs()
 from public,anon,authenticated;
grant execute on function public.reserve_ai_request(uuid),public.claim_notification_push_jobs()
 to service_role;
revoke all on function public.create_profile(),public.limit_social_write(),
 public.enqueue_notification_push() from public,anon,authenticated;

notify pgrst, 'reload schema';

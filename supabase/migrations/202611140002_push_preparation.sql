-- Push delivery is optional. No scheduler or external delivery is enabled by this migration.
create table public.push_devices (
 installation_id uuid primary key, user_id uuid not null references public.profiles on delete cascade,
 expo_token text not null unique check(length(expo_token)<=256), platform text not null check(platform in ('ios','android')),
 enabled boolean not null default true, registered_at timestamptz not null default now()
);
alter table public.push_devices enable row level security;
revoke all on public.push_devices from anon,authenticated;
create table public.notification_push_jobs (
 notification_id uuid primary key references public.notifications on delete cascade,
 user_id uuid not null references public.profiles on delete cascade,
 state text not null default 'pending' check(state in ('pending','sending','accepted','sent','failed','uncertain')),
 attempts integer not null default 0, next_attempt_at timestamptz not null default now(),
 ticket_id text, installation_id uuid, target_token text, updated_at timestamptz not null default now()
);
alter table public.notification_push_jobs enable row level security;
revoke all on public.notification_push_jobs from anon,authenticated;
grant all on public.push_devices,public.notification_push_jobs to service_role;
create function public.enqueue_notification_push() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.notification_push_jobs(notification_id,user_id) values(new.id,new.user_id) on conflict do nothing;
 return new;
end $$;
create trigger notification_push_created after insert on public.notifications for each row execute function public.enqueue_notification_push();
insert into public.notification_push_jobs(notification_id,user_id) select id,user_id from public.notifications where kind='welcome' on conflict do nothing;
revoke all on function public.enqueue_notification_push() from public,anon,authenticated;

create function public.register_push_device(installation uuid, token text, device_platform text, enable_consent boolean default false)
returns void language plpgsql security definer set search_path='' as $$
declare viewer uuid:=auth.uid();
begin
 if viewer is null then raise exception 'Authentication required'; end if;
 if token !~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$' or length(token)>256 or device_platform not in ('ios','android') then raise exception 'Invalid device token'; end if;
 if not enable_consent and not exists(select 1 from public.push_devices where installation_id=installation and user_id=viewer and enabled) then raise exception 'Explicit push consent required'; end if;
 -- Possession of the device token permits rebinding it on an explicit new account opt-in.
 delete from public.push_devices where expo_token=token and installation_id<>installation;
 insert into public.push_devices(installation_id,user_id,expo_token,platform) values(installation,viewer,token,device_platform)
 on conflict(installation_id) do update set user_id=viewer,expo_token=excluded.expo_token,platform=excluded.platform,enabled=true,registered_at=now();
 if enable_consent then update public.user_settings set notifications_enabled=true where user_id=viewer; end if;
end $$;
create function public.disable_push_device(installation uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 update public.push_devices set enabled=false where installation_id=installation and user_id=auth.uid();
end $$;
revoke all on function public.register_push_device(uuid,text,text,boolean),public.disable_push_device(uuid) from public,anon;
grant execute on function public.register_push_device(uuid,text,text,boolean),public.disable_push_device(uuid) to authenticated;

create function public.claim_notification_push_jobs() returns table(notification_id uuid,user_id uuid,expo_token text,title text,body text,attempts integer)
language plpgsql security definer set search_path='' as $$
begin
 -- A crashed/ambiguous send is not blindly resent: receipt/manual reconciliation is required.
 update public.notification_push_jobs set state='uncertain',updated_at=now() where state='sending' and updated_at<now()-interval '5 minutes';
 update public.notification_push_jobs set state='failed',updated_at=now() where state='pending' and attempts>=5;
 return query
 with candidates as (
  select j.notification_id,d.installation_id,d.expo_token from public.notification_push_jobs j
  join public.user_settings s on s.user_id=j.user_id and s.notifications_enabled
  join lateral(select p.installation_id,p.expo_token from public.push_devices p where p.user_id=j.user_id and p.enabled and p.registered_at>now()-interval '30 days' order by p.registered_at desc limit 1)d on true
  where j.state='pending' and j.next_attempt_at<=now() and j.attempts<5
  order by j.next_attempt_at limit 25 for update of j skip locked
 ), claimed as (
  update public.notification_push_jobs j set state='sending',attempts=j.attempts+1,installation_id=c.installation_id,target_token=c.expo_token,updated_at=now()
  from candidates c where j.notification_id=c.notification_id
  returning j.notification_id,j.user_id,j.attempts,c.expo_token
 ) select c.notification_id,c.user_id,c.expo_token,n.title,n.body,c.attempts from claimed c join public.notifications n on n.id=c.notification_id;
end $$;
revoke all on function public.claim_notification_push_jobs() from public,anon,authenticated;
grant execute on function public.claim_notification_push_jobs() to service_role;

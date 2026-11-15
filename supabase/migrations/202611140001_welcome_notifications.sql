-- Existing notifications table; no backfill for returning users.
alter table public.notifications add column title text not null default 'StravaKinda';
create unique index notifications_one_welcome_per_user on public.notifications(user_id) where kind='welcome';

-- Reuse the existing auth.users INSERT trigger. Profiles exist before notification FK insertion.
create or replace function public.create_profile() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id) values(new.id);
 insert into public.user_settings(user_id) values(new.id);
 insert into public.notifications(user_id,kind,title,body)
 values(new.id,'welcome','Welcome to StravaKinda! 🏔️','Your adventure starts here. Track your first activity, discover Nepal''s trails, and connect with fellow athletes.')
 on conflict(user_id) where kind='welcome' do nothing;
 return new;
end $$;
revoke all on function public.create_profile() from public,anon,authenticated;

-- Clients can only read their own rows and change read state, never create a welcome.
revoke all on public.notifications from anon,authenticated;
grant select,update(read_at) on public.notifications to authenticated;
create policy notifications_update_read on public.notifications for update to authenticated
 using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime')
 and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='notifications') then
  alter publication supabase_realtime add table public.notifications;
 end if;
end $$;

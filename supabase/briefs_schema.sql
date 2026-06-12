-- ============================================================
-- Artha Insights — brief send tracking
-- Prevents duplicate sends and gives a send history log.
-- Run in Supabase SQL Editor → New query → Run.
-- ============================================================

create table if not exists public.sent_briefs (
  id         bigserial primary key,
  slug       text not null unique,       -- brief slug; unique prevents duplicate sends
  title      text not null,
  sent_at    timestamptz default now(),
  recipient_count integer default 0,
  test_only  boolean default false        -- true = test send, false = real send
);

-- No sensitive data here; public read is fine (shows send history on site later).
alter table public.sent_briefs enable row level security;

drop policy if exists "public read sent_briefs" on public.sent_briefs;
create policy "public read sent_briefs"
  on public.sent_briefs for select using (true);

-- ============================================================
-- Artha Insights — schema v1
-- ============================================================
-- Three tables to start:
--   1. market_quotes     → snapshot of NIFTY, Sensex, INR/USD, etc.
--   2. headlines         → news from RSS feeds, deduped, tagged
--   3. signups           → email subscribers
--
-- Run this in Supabase Dashboard → SQL Editor → New query → paste → Run.
-- ============================================================

-- 1. MARKET QUOTES ------------------------------------------------
create table if not exists public.market_quotes (
  id           bigserial primary key,
  symbol       text not null,
  label        text not null,
  price        numeric,
  change       numeric,
  change_pct   numeric,
  currency     text,
  source       text default 'yahoo',
  fetched_at   timestamptz default now()
);

-- Latest snapshot per symbol — fast lookup for the public site
create unique index if not exists market_quotes_symbol_latest
  on public.market_quotes (symbol, fetched_at desc);

create index if not exists market_quotes_fetched_at
  on public.market_quotes (fetched_at desc);


-- 2. HEADLINES ----------------------------------------------------
create table if not exists public.headlines (
  id           bigserial primary key,
  url          text not null unique,
  title        text not null,
  excerpt      text,
  source       text not null,                    -- 'mint', 'inc42', etc.
  pillar       text not null check (pillar in ('markets','startups','macro','other')),
  published_at timestamptz,
  fetched_at   timestamptz default now()
);

create index if not exists headlines_pillar_published
  on public.headlines (pillar, published_at desc);

create index if not exists headlines_published_at
  on public.headlines (published_at desc);


-- 3. SIGNUPS ------------------------------------------------------
create table if not exists public.signups (
  id            bigserial primary key,
  email         text not null unique,
  source        text default 'subscribe',
  level         text,                              -- from orientation
  interests     text[],                            -- from orientation
  depth         text,                              -- from orientation
  name          text,
  created_at    timestamptz default now()
);


-- ============================================================
-- ROW-LEVEL SECURITY
-- Public site: read-only access to quotes + headlines.
-- Signups:    public can INSERT only.
-- Cron jobs:  use service_role key (bypasses RLS).
-- ============================================================

alter table public.market_quotes  enable row level security;
alter table public.headlines      enable row level security;
alter table public.signups        enable row level security;

-- READ policies (anonymous read for site)
create policy "public read market_quotes"
  on public.market_quotes for select
  using (true);

create policy "public read headlines"
  on public.headlines for select
  using (true);

-- WRITE policies (signups: insert only, no read/update/delete)
create policy "public insert signups"
  on public.signups for insert
  with check (true);

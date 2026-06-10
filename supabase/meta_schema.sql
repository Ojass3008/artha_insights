-- ============================================================
-- Artha Insights — meta-allocator schema (v2)
-- ============================================================
-- Tables powering the regime-aware meta-allocator (the "self-improving
-- capital allocator"). Run AFTER schema.sql.
--
--   1. strategy_returns  → point-in-time daily return per strategy,
--                          tagged with the regime that was active THEN.
--                          This is the ledger the meta-layer learns from.
--   2. meta_weights      → time series of strategy weights produced by the
--                          meta-layer (learned + confidence-blended final).
--                          Powers the "strategy-weight evolution" chart.
--   3. confidence_log    → system confidence c and its drivers per run.
--
-- Run in Supabase Dashboard → SQL Editor → New query → paste → Run.
-- ============================================================

-- 1. STRATEGY RETURNS (the ledger) -------------------------------
-- One row per (strategy, day). `regime` and `regime_probs` are the
-- POINT-IN-TIME labels — what the regime engine believed on that day,
-- never a hindsight-smoothed label (that would poison the ledger).
create table if not exists public.strategy_returns (
  id            bigserial primary key,
  strategy      text not null,                 -- 'risk_parity', 'ts_momentum', ...
  as_of         date not null,                 -- the day the return was realized
  ret           numeric not null,              -- period return as a decimal (0.012 = 1.2%)
  regime        text not null,                 -- point-in-time hard label (max-prob regime)
  regime_probs  jsonb,                          -- full P(k) vector active that day
  created_at    timestamptz default now(),
  unique (strategy, as_of)
);

create index if not exists strategy_returns_as_of
  on public.strategy_returns (as_of desc);
create index if not exists strategy_returns_strat_regime
  on public.strategy_returns (strategy, regime);


-- 2. META WEIGHTS (the output time series) -----------------------
-- One row per (as_of, strategy). `weight_learned` is what the Hedge
-- meta-layer wants; `weight_final` is after blending toward the risk-parity
-- anchor by system confidence. In anchor-only mode the two diverge but only
-- weight_final is traded.
create table if not exists public.meta_weights (
  id              bigserial primary key,
  as_of           date not null,
  strategy        text not null,
  weight_learned  numeric not null,            -- meta-layer's desired weight
  weight_final    numeric not null,            -- after confidence blend (what we trade)
  reliability     numeric,                      -- rho in [0,1], soft-mixed across regimes
  lcb_sharpe      numeric,                      -- pessimistic (lower-confidence-bound) Sharpe
  is_anchor       boolean default false,
  created_at      timestamptz default now(),
  unique (as_of, strategy)
);

create index if not exists meta_weights_as_of
  on public.meta_weights (as_of desc);


-- 3. CONFIDENCE LOG ----------------------------------------------
-- One row per run. c_raw is the uncapped confidence the drivers imply;
-- c_effective = min(c_raw, confidence_ceiling). In anchor-only mode the
-- ceiling is 0, so c_effective = 0 and the system trades pure risk parity.
create table if not exists public.confidence_log (
  id                   bigserial primary key,
  as_of                date not null unique,
  c_raw                numeric not null,        -- what the drivers imply, [0,1]
  c_effective          numeric not null,        -- after ceiling; this drives the blend
  anchor_blend         numeric not null,        -- 1 - c_effective
  confidence_ceiling   numeric not null,        -- trust the meta-layer has "earned"
  regime_entropy       numeric,                  -- normalized [0,1]; high = uncertain regime
  strategy_dispersion  numeric,                  -- high = experts disagree
  mean_reliability     numeric,                  -- avg rho of active regime
  active_regime        text,
  regime_probs         jsonb,
  notes                text,
  created_at           timestamptz default now()
);


-- ============================================================
-- ROW-LEVEL SECURITY
-- Dashboard reads these tables with the anon key → public read.
-- Writes happen only from the Python service via the service_role key
-- (which bypasses RLS), so no write policy is granted to anon.
-- ============================================================
alter table public.strategy_returns enable row level security;
alter table public.meta_weights      enable row level security;
alter table public.confidence_log     enable row level security;

-- Drop first so this whole file is safe to re-run any number of times.
drop policy if exists "public read strategy_returns" on public.strategy_returns;
drop policy if exists "public read meta_weights"      on public.meta_weights;
drop policy if exists "public read confidence_log"     on public.confidence_log;

create policy "public read strategy_returns"
  on public.strategy_returns for select using (true);

create policy "public read meta_weights"
  on public.meta_weights for select using (true);

create policy "public read confidence_log"
  on public.confidence_log for select using (true);

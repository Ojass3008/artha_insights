# Supabase setup

## 1. Run the schema

1. Open Supabase Dashboard → your project
2. Left sidebar → **SQL Editor** → **New query**
3. Open `schema.sql` from this folder, copy the whole thing
4. Paste into the SQL editor → click **Run**
5. Should see "Success. No rows returned." for each statement

## 2. Verify

In the dashboard:
- **Table Editor** → you should see 3 tables: `market_quotes`, `headlines`, `signups`
- Click each one → **Authentication** column should show RLS is **on**

## 3. Get keys

- **Settings → API**:
  - `Project URL` → goes into `VITE_SUPABASE_URL`
  - `anon` `public` key → goes into `VITE_SUPABASE_ANON_KEY`
  - `service_role` `secret` key → keep this, paste into Vercel later as `SUPABASE_SERVICE_ROLE_KEY`. Never commit it.

## 4. Local dev

Create `.env.local` at the project root:

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

Vercel deploy will use the same names — set them in
**Vercel Dashboard → Project → Settings → Environment Variables**.

The `SUPABASE_SERVICE_ROLE_KEY` only ever lives in Vercel's
environment, never in code or git.

## 5. Meta-allocator tables (v2)

After `schema.sql`, run `meta_schema.sql` the same way (SQL Editor → paste →
Run). It adds three public-read tables that power the capital-allocation
dashboard, written to by the Python compute service in `quant/`:

- `strategy_returns` — the point-in-time return ledger the meta-layer learns
  from (one row per strategy per day, tagged with the regime active that day).
- `meta_weights` — the strategy weights produced each run (`weight_learned` =
  what the meta-layer wants, `weight_final` = what we actually trade after the
  confidence blend toward the risk-parity anchor).
- `confidence_log` — system confidence and its drivers per run.

These have **public read** RLS policies (the dashboard reads them with the anon
key). Writes happen only from `quant/` using the `service_role` key, exactly
like the existing cron jobs.

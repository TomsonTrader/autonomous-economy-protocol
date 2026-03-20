-- ============================================================
-- Human Operators — AEP Human Branch
-- Run this in Supabase SQL Editor
-- ============================================================

create table if not exists human_profiles (
  id              uuid primary key default gen_random_uuid(),
  email           text unique not null,
  wallet          text unique,                          -- Ethereum address (optional until claim)
  display_name    text,
  referral_code   text unique default substr(md5(random()::text), 1, 8),
  referred_by     text,                                 -- referral_code of referrer
  airdrop_claimed boolean not null default false,
  airdrop_tx_hash text,
  airdrop_amount  integer not null default 500,
  source          text,                                 -- utm_source for marketing attribution
  created_at      timestamptz not null default now(),
  last_seen       timestamptz not null default now()
);

-- Indexes
create index if not exists human_profiles_wallet_idx       on human_profiles(wallet);
create index if not exists human_profiles_referral_idx     on human_profiles(referral_code);
create index if not exists human_profiles_referred_by_idx  on human_profiles(referred_by);

-- RLS
alter table human_profiles enable row level security;

-- Users can only read their own profile (auth.uid() maps to the Supabase auth user id)
create policy "users read own profile"
  on human_profiles for select
  using (auth.uid() = id);

-- Service role can do anything (backend uses service key — bypasses RLS automatically)
-- No extra policy needed for service role.

-- Public stats: allow anonymous reads of aggregate counts
-- (handled via a separate VIEW or RPC, not direct table access)

-- ============================================================
-- View: public stats (safe for anon reads)
-- ============================================================
create or replace view human_stats
  with (security_invoker = true)
as
select
  count(*)                                        as total_humans,
  count(*) filter (where wallet is not null)      as wallets_connected,
  count(*) filter (where airdrop_claimed = true)  as airdrops_claimed,
  coalesce(sum(airdrop_amount) filter (where airdrop_claimed = true), 0) as total_agt_distributed
from human_profiles;

-- Allow anonymous access to the stats view
grant select on human_stats to anon;
grant select on human_stats to authenticated;

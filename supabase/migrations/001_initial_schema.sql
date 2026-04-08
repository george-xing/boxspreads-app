-- Treasury rates cached daily from FRED API
create table treasury_rates (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  tenor text not null,
  yield_pct numeric(5,3) not null,
  source text not null default 'FRED',
  fetched_at timestamptz not null default now(),
  unique (date, tenor)
);

create index idx_treasury_rates_date on treasury_rates (date desc);

-- Brokerage margin/SBLOC rates for comparison
create table brokerage_rates (
  id uuid primary key default gen_random_uuid(),
  brokerage text not null,
  product text not null,
  rate_pct numeric(5,3) not null,
  min_balance numeric,
  updated_at timestamptz not null default now(),
  source_url text
);

-- Brokerage per-leg trading fees
create table brokerage_fees (
  id uuid primary key default gen_random_uuid(),
  brokerage text not null unique,
  commission numeric(6,2) not null,
  exchange_fee numeric(6,2) not null,
  regulatory_fee numeric(6,4) not null,
  updated_at timestamptz not null default now()
);

-- Seed brokerage fees
insert into brokerage_fees (brokerage, commission, exchange_fee, regulatory_fee) values
  ('ibkr', 0.65, 0.68, 0.21),
  ('fidelity', 0.65, 0.68, 0.21),
  ('schwab', 0.65, 0.68, 0.21);

-- Seed comparison rates (approximate, updated manually)
insert into brokerage_rates (brokerage, product, rate_pct, source_url) values
  ('ibkr', 'margin', 11.33, 'https://www.interactivebrokers.com/en/trading/margin-rates.php'),
  ('fidelity', 'margin', 11.75, 'https://www.fidelity.com/trading/margin-loans/margin-rates'),
  ('fidelity', 'sbloc', 6.80, 'https://www.fidelity.com/lending/securities-backed-line-of-credit'),
  ('schwab', 'margin', 11.25, 'https://www.schwab.com/margin-rates'),
  ('schwab', 'sbloc', 6.50, 'https://www.schwab.com/pledged-asset-line');

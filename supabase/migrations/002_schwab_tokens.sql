-- Schwab OAuth refresh token persistence (single-user, Individual tier).
-- Constrained to a single row so concurrent callers race on the same record.
create table schwab_tokens (
  id text primary key check (id = 'singleton'),
  refresh_token text not null,
  updated_at timestamptz not null default now(),
  invalid_at timestamptz
);

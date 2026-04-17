-- Stores Schwab OAuth refresh tokens keyed by signed session cookie.
-- Phase 1: one row per admin login (George). Phase 2: one row per OAuth-connected user.
create table schwab_connections (
  session_id text primary key,
  refresh_token text not null,
  connected_at timestamptz not null default now(),
  last_refreshed_at timestamptz
);

create index idx_schwab_connections_connected_at
  on schwab_connections (connected_at desc);

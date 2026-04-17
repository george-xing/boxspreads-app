-- H1: lock down `schwab_connections`.
--
-- Background: this table stores Schwab OAuth refresh tokens, which grant
-- account-level read access to the brokerage account they were minted
-- against. Until this migration the table had no RLS, so anyone who
-- captured the public `NEXT_PUBLIC_SUPABASE_ANON_KEY` from the JS bundle
-- could `select * from schwab_connections` via PostgREST and exfiltrate
-- every refresh token.
--
-- Fix: enable RLS and add an explicit no-op policy for anon/authenticated
-- roles. The Supabase service-role key bypasses RLS entirely, so server
-- code (which now uses `src/lib/supabase-admin.ts`) keeps working.
--
-- Defense in depth: refresh tokens are also AES-256-GCM encrypted at the
-- application layer (see `src/lib/schwab/refresh-token-crypto.ts` and the
-- `key_version` column added below). RLS keeps casual readers out; AEAD
-- limits blast radius if the service-role key or a DB backup leaks.
--
-- Idempotent / re-runnable: every statement uses IF [NOT] EXISTS so this
-- is safe to apply against a Supabase that already has unencrypted data.
-- The data-encryption pass is a separate one-shot script
-- (scripts/encrypt-existing-refresh-tokens.mjs), to be run AFTER this
-- migration applies and AFTER `REFRESH_TOKEN_KMS_KEY` is set in the env.

alter table public.schwab_connections enable row level security;

-- Track which key version encrypted each row so we can rotate without
-- requiring a synchronous re-encrypt of every row. Nullable for now —
-- legacy plaintext rows get null until the data-migration script runs.
alter table public.schwab_connections
  add column if not exists key_version smallint;

-- Explicit no-anon, no-authenticated policies. Without an explicit
-- policy, RLS denies by default, but spelling it out documents intent
-- and gives a clear "if you ever add a policy here, you almost
-- certainly meant something else" signal in code review.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'schwab_connections'
      and policyname = 'no_anon_access'
  ) then
    create policy no_anon_access
      on public.schwab_connections
      as restrictive
      for all
      to anon
      using (false)
      with check (false);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'schwab_connections'
      and policyname = 'no_authenticated_access'
  ) then
    -- Phase 1 has no Supabase Auth users at all, but this future-proofs
    -- against accidentally letting a logged-in JWT read other users'
    -- refresh tokens once Phase 2 rolls in OAuth-per-user.
    create policy no_authenticated_access
      on public.schwab_connections
      as restrictive
      for all
      to authenticated
      using (false)
      with check (false);
  end if;
end$$;

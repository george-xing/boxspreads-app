# Schwab API Productization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn boxspreads.app from an estimate-only calculator into a Schwab-connected box spread optimizer. User enters a target borrow amount; the app ranks strike-pair candidates by real-chain liquidity and returns a Schwab-pasteable order.

**Architecture:** Per-request `getSchwabClientForRequest(req)` factory + signed session cookie + Supabase `schwab_connections` table. Phase 1: George is the only connected user via an admin cookie route seeded from env. Phase 2 (post-Commercial OAuth) plugs into the same session store with zero changes downstream. Disconnected users see Treasury-derived aggregate estimates; no fabricated strikes/OI/bid-ask. Spec: [docs/superpowers/specs/2026-04-15-schwab-api-productization-design.md](../specs/2026-04-15-schwab-api-productization-design.md).

**Tech Stack:** Next.js 16 App Router, TypeScript, React 19, Tailwind v4, Supabase (`@supabase/supabase-js`), Vitest + jsdom, `@sudowealth/schwab-api` (new dependency), built-in `crypto` for cookie signing.

**Conventions referenced:**
- Tests live in `__tests__/` at repo root (mirror `src/` tree). Vitest via `pnpm test`. `@/` alias → `src/`.
- API routes: `src/app/api/.../route.ts`, `NextResponse.json(...)`.
- Supabase client: `src/lib/supabase.ts` (lazy proxy singleton).
- Migrations: `supabase/migrations/NNN_name.sql` (numbered).

---

## Phase A — Foundations

### Task 1: Install `@sudowealth/schwab-api`

**Files:**
- Modify: `package.json` (dependency added automatically)
- Modify: `pnpm-lock.yaml` (lock regenerated automatically)

- [ ] **Step 1: Install the package**

Run:
```bash
pnpm add @sudowealth/schwab-api
```

Expected: `package.json` picks up `"@sudowealth/schwab-api": "^<version>"` under `dependencies`.

- [ ] **Step 2: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add @sudowealth/schwab-api dependency"
```

---

### Task 2: Supabase migration — `schwab_connections` table

**Files:**
- Create: `supabase/migrations/002_schwab_connections.sql`

- [ ] **Step 1: Write the migration**

```sql
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
```

- [ ] **Step 2: Apply locally**

Run (against your Supabase dev project):
```bash
# e.g. via Supabase CLI if configured; otherwise paste into SQL editor in the Supabase dashboard
supabase db push
```

Expected: migration runs; `schwab_connections` table exists.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/002_schwab_connections.sql
git commit -m "feat(db): add schwab_connections table for session-keyed refresh tokens"
```

---

### Task 3: Signed session cookie helper (TDD)

**Files:**
- Create: `src/lib/session.ts`
- Create: `__tests__/session.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// __tests__/session.test.ts
import { describe, it, expect } from "vitest";
import { signSessionId, verifySessionCookie, generateSessionId } from "@/lib/session";

describe("session cookie", () => {
  const secret = "test-secret-at-least-32-chars-long-abcdef";

  it("signs a session id deterministically given the same secret", () => {
    const a = signSessionId("abc", secret);
    const b = signSessionId("abc", secret);
    expect(a).toBe(b);
    expect(a).toContain(".");
  });

  it("round-trips: verifySessionCookie returns the session id", () => {
    const signed = signSessionId("xyz", secret);
    expect(verifySessionCookie(signed, secret)).toBe("xyz");
  });

  it("rejects a tampered cookie", () => {
    const signed = signSessionId("xyz", secret);
    const tampered = signed.replace(/^./, "z");
    expect(verifySessionCookie(tampered, secret)).toBeNull();
  });

  it("rejects a malformed cookie", () => {
    expect(verifySessionCookie("no-dot-here", secret)).toBeNull();
    expect(verifySessionCookie("", secret)).toBeNull();
  });

  it("generateSessionId produces a 32+ char url-safe string", () => {
    const id = generateSessionId();
    expect(id.length).toBeGreaterThanOrEqual(32);
    expect(/^[A-Za-z0-9_-]+$/.test(id)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
pnpm test session
```

Expected: FAIL with "Cannot find module '@/lib/session'".

- [ ] **Step 3: Implement**

```typescript
// src/lib/session.ts
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "boxspreads_session";

export function generateSessionId(): string {
  return randomBytes(24).toString("base64url");
}

export function signSessionId(sessionId: string, secret: string): string {
  const mac = createHmac("sha256", secret).update(sessionId).digest("base64url");
  return `${sessionId}.${mac}`;
}

export function verifySessionCookie(cookie: string, secret: string): string | null {
  if (!cookie || typeof cookie !== "string") return null;
  const dot = cookie.indexOf(".");
  if (dot <= 0 || dot === cookie.length - 1) return null;
  const sessionId = cookie.slice(0, dot);
  const providedMac = cookie.slice(dot + 1);
  const expectedMac = createHmac("sha256", secret)
    .update(sessionId)
    .digest("base64url");
  try {
    const a = Buffer.from(providedMac);
    const b = Buffer.from(expectedMac);
    if (a.length !== b.length) return null;
    return timingSafeEqual(a, b) ? sessionId : null;
  } catch {
    return null;
  }
}

export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET env var must be set and ≥ 32 chars");
  }
  return secret;
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
pnpm test session
```

Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/session.ts __tests__/session.test.ts
git commit -m "feat(session): HMAC-signed session cookie helpers"
```

---

### Task 4: Schwab types

**Files:**
- Create: `src/lib/schwab/types.ts`

- [ ] **Step 1: Write the types file**

```typescript
// src/lib/schwab/types.ts

/** One element of the per-pair optimizer result. */
export interface Candidate {
  lowerStrike: number;
  upperStrike: number;
  strikeWidth: number;
  contracts: number;
  boxCredit: number;       // per contract, dollars (not x100)
  actualBorrow: number;    // boxCredit * 100 * contracts
  rate: number;            // annualized, e.g. 0.0439
  minOI: number;
  spreadWidth: number;     // sum of (ask-bid) across 4 legs
  score: number;           // rate minus penalties
  muted: boolean;          // liquidity/spread too low for this size
  legs: CandidateLeg[];    // 4 legs with real prices
}

export interface CandidateLeg {
  action: "BUY" | "SELL";
  type: "CALL" | "PUT";
  strike: number;
  symbol: string;          // e.g. SPXW  260219C05500000
  bid: number;
  ask: number;
  openInterest: number;
}

export interface ChainSnapshot {
  underlying: { symbol: string; last: number; mark: number };
  expiration: string;       // ISO date
  dte: number;
  contracts: ChainContract[];
  asOf: string;             // ISO timestamp
}

export interface ChainContract {
  strike: number;
  type: "CALL" | "PUT";
  symbol: string;
  bid: number;
  ask: number;
  mark: number;
  openInterest: number;
  settlementType: "AM" | "PM";
  optionRoot: string;       // "SPX" | "SPXW"
}

export type CandidatesReason =
  | "min_credit_exceeds_target"
  | "thin_liquidity"
  | null;

export interface CandidatesResponse {
  underlying: { symbol: string; last: number; mark: number };
  expiration: string;
  candidates: Candidate[];
  selected: Candidate | null;
  asOf: string;
  reason: CandidatesReason;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/schwab/types.ts
git commit -m "feat(schwab): types for chain snapshot and candidates"
```

---

### Task 5: Supabase connections data-access (TDD with mocked supabase)

**Files:**
- Create: `src/lib/schwab/connections.ts`
- Create: `__tests__/schwab/connections.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// __tests__/schwab/connections.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the supabase module before importing the unit under test.
const mockFrom = vi.fn();
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
  },
}));

import {
  upsertConnection,
  findConnection,
  deleteConnection,
} from "@/lib/schwab/connections";

describe("schwab connections data-access", () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it("upsertConnection calls supabase upsert with correct row", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ upsert });
    await upsertConnection("sess-1", "refresh-token-abc");
    expect(mockFrom).toHaveBeenCalledWith("schwab_connections");
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        session_id: "sess-1",
        refresh_token: "refresh-token-abc",
      }),
      { onConflict: "session_id" },
    );
  });

  it("findConnection returns the row when found", async () => {
    const single = vi.fn().mockResolvedValue({
      data: { session_id: "sess-1", refresh_token: "t" },
      error: null,
    });
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ single }) }),
    });
    const row = await findConnection("sess-1");
    expect(row?.refresh_token).toBe("t");
  });

  it("findConnection returns null when not found", async () => {
    const single = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "PGRST116" },
    });
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ single }) }),
    });
    const row = await findConnection("missing");
    expect(row).toBeNull();
  });

  it("deleteConnection calls delete by session_id", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ delete: () => ({ eq }) });
    await deleteConnection("sess-1");
    expect(eq).toHaveBeenCalledWith("session_id", "sess-1");
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
pnpm test schwab/connections
```

Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement**

```typescript
// src/lib/schwab/connections.ts
import { supabase } from "@/lib/supabase";

export interface ConnectionRow {
  session_id: string;
  refresh_token: string;
  connected_at: string;
  last_refreshed_at: string | null;
}

export async function upsertConnection(
  sessionId: string,
  refreshToken: string,
): Promise<void> {
  const { error } = await supabase
    .from("schwab_connections")
    .upsert(
      {
        session_id: sessionId,
        refresh_token: refreshToken,
        connected_at: new Date().toISOString(),
      },
      { onConflict: "session_id" },
    );
  if (error) throw new Error(`upsertConnection: ${error.message}`);
}

export async function findConnection(
  sessionId: string,
): Promise<ConnectionRow | null> {
  const { data, error } = await supabase
    .from("schwab_connections")
    .select("session_id, refresh_token, connected_at, last_refreshed_at")
    .eq("session_id", sessionId)
    .single();
  if (error || !data) return null;
  return data as ConnectionRow;
}

export async function deleteConnection(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from("schwab_connections")
    .delete()
    .eq("session_id", sessionId);
  if (error) throw new Error(`deleteConnection: ${error.message}`);
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
pnpm test schwab/connections
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/schwab/connections.ts __tests__/schwab/connections.test.ts
git commit -m "feat(schwab): connections data-access layer on schwab_connections table"
```

---

### Task 6: Schwab client factory (`getSchwabClientForRequest`)

**Files:**
- Create: `src/lib/schwab/client.ts`
- Create: `__tests__/schwab/client.test.ts`

This wraps `@sudowealth/schwab-api`, maps session cookie → refresh token → authenticated client. In tests we mock the Schwab library entirely.

- [ ] **Step 1: Write failing tests**

```typescript
// __tests__/schwab/client.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/session", () => ({
  SESSION_COOKIE_NAME: "boxspreads_session",
  verifySessionCookie: vi.fn(),
  getSessionSecret: vi.fn(() => "test-secret-at-least-32-chars-long-abcdef"),
}));

const mockFind = vi.fn();
const mockDelete = vi.fn();
vi.mock("@/lib/schwab/connections", () => ({
  findConnection: mockFind,
  deleteConnection: mockDelete,
}));

const mockMakeClient = vi.fn();
vi.mock("@sudowealth/schwab-api", () => ({
  createApiClient: (...args: unknown[]) => mockMakeClient(...args),
}));

import { getSchwabClientForRequest } from "@/lib/schwab/client";
import { verifySessionCookie } from "@/lib/session";

function makeRequest(cookieHeader: string | null): Request {
  const headers = new Headers();
  if (cookieHeader) headers.set("cookie", cookieHeader);
  return new Request("http://localhost/x", { headers });
}

describe("getSchwabClientForRequest", () => {
  beforeEach(() => {
    mockFind.mockReset();
    mockDelete.mockReset();
    mockMakeClient.mockReset();
    (verifySessionCookie as ReturnType<typeof vi.fn>).mockReset();
  });

  it("returns null when no cookie", async () => {
    expect(await getSchwabClientForRequest(makeRequest(null))).toBeNull();
  });

  it("returns null when cookie invalid", async () => {
    (verifySessionCookie as ReturnType<typeof vi.fn>).mockReturnValueOnce(null);
    const r = makeRequest("boxspreads_session=bad.mac");
    expect(await getSchwabClientForRequest(r)).toBeNull();
  });

  it("returns null when no connection row", async () => {
    (verifySessionCookie as ReturnType<typeof vi.fn>).mockReturnValueOnce("sess-1");
    mockFind.mockResolvedValueOnce(null);
    const r = makeRequest("boxspreads_session=sess-1.mac");
    expect(await getSchwabClientForRequest(r)).toBeNull();
  });

  it("builds a client when connection exists", async () => {
    (verifySessionCookie as ReturnType<typeof vi.fn>).mockReturnValueOnce("sess-1");
    mockFind.mockResolvedValueOnce({
      session_id: "sess-1",
      refresh_token: "r1",
      connected_at: "2026-04-15T00:00:00Z",
      last_refreshed_at: null,
    });
    const fakeClient = { marketData: { options: { getOptionChain: vi.fn() } } };
    mockMakeClient.mockReturnValueOnce(fakeClient);
    const r = makeRequest("boxspreads_session=sess-1.mac");
    const client = await getSchwabClientForRequest(r);
    expect(client).toBe(fakeClient);
    expect(mockMakeClient).toHaveBeenCalled();
  });

  it("deletes the row and returns null on invalid_grant from refresh", async () => {
    (verifySessionCookie as ReturnType<typeof vi.fn>).mockReturnValueOnce("sess-1");
    mockFind.mockResolvedValueOnce({
      session_id: "sess-1",
      refresh_token: "expired",
      connected_at: "2026-04-01T00:00:00Z",
      last_refreshed_at: null,
    });
    mockMakeClient.mockImplementationOnce(() => {
      throw new Error("invalid_grant");
    });
    const r = makeRequest("boxspreads_session=sess-1.mac");
    expect(await getSchwabClientForRequest(r)).toBeNull();
    expect(mockDelete).toHaveBeenCalledWith("sess-1");
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
pnpm test schwab/client
```

Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement**

```typescript
// src/lib/schwab/client.ts
import { createApiClient } from "@sudowealth/schwab-api";
import {
  SESSION_COOKIE_NAME,
  verifySessionCookie,
  getSessionSecret,
} from "@/lib/session";
import { findConnection, deleteConnection } from "@/lib/schwab/connections";

export type SchwabClient = ReturnType<typeof createApiClient>;

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  const parts = header.split(/;\s*/);
  for (const p of parts) {
    const eq = p.indexOf("=");
    if (eq < 0) continue;
    if (p.slice(0, eq) === name) return decodeURIComponent(p.slice(eq + 1));
  }
  return null;
}

export async function getSchwabClientForRequest(
  req: Request,
): Promise<SchwabClient | null> {
  const cookie = readCookie(req, SESSION_COOKIE_NAME);
  if (!cookie) return null;

  const sessionId = verifySessionCookie(cookie, getSessionSecret());
  if (!sessionId) return null;

  const row = await findConnection(sessionId);
  if (!row) return null;

  const appKey = process.env.SCHWAB_APP_KEY;
  const appSecret = process.env.SCHWAB_APP_SECRET;
  if (!appKey || !appSecret) {
    throw new Error("SCHWAB_APP_KEY / SCHWAB_APP_SECRET env vars required");
  }

  try {
    return createApiClient({
      auth: {
        type: "oauth-refresh",
        appKey,
        appSecret,
        refreshToken: row.refresh_token,
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("invalid_grant")) {
      await deleteConnection(sessionId);
      return null;
    }
    throw err;
  }
}
```

Note: the exact `createApiClient` signature may differ — verify against the `@sudowealth/schwab-api` package README when implementing. Adjust the options shape accordingly. The *behavior* (build on demand from refresh token; library handles access token refresh internally) is the invariant.

- [ ] **Step 4: Run tests — expect PASS**

```bash
pnpm test schwab/client
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/schwab/client.ts __tests__/schwab/client.test.ts
git commit -m "feat(schwab): per-request Schwab client factory"
```

---

## Phase B — `computeCandidates` (core optimizer)

### Task 7: Fixture — sample SPX chain

**Files:**
- Create: `__tests__/fixtures/spx-chain.json`

- [ ] **Step 1: Author a minimal realistic fixture**

Aim: one expiration (`2027-02-19`), 4 strikes (5000, 5500, 6000, 6500) each as CALL + PUT, all `optionRoot: "SPX"`, `settlementType: "AM"`. Plus one non-standard (SPXW) pair to assert filtering.

```json
{
  "underlying": { "symbol": "$SPX", "last": 5782.10, "mark": 5782.10 },
  "expiration": "2027-02-19",
  "dte": 301,
  "asOf": "2026-04-15T18:30:00Z",
  "contracts": [
    { "strike": 5000, "type": "CALL", "symbol": "SPX 270219C05000000", "bid": 845.10, "ask": 846.40, "mark": 845.75, "openInterest": 900, "settlementType": "AM", "optionRoot": "SPX" },
    { "strike": 5000, "type": "PUT",  "symbol": "SPX 270219P05000000", "bid":  55.00, "ask":  55.90, "mark":  55.45, "openInterest": 910, "settlementType": "AM", "optionRoot": "SPX" },
    { "strike": 5500, "type": "CALL", "symbol": "SPX 270219C05500000", "bid": 300.10, "ask": 300.80, "mark": 300.45, "openInterest": 1240, "settlementType": "AM", "optionRoot": "SPX" },
    { "strike": 5500, "type": "PUT",  "symbol": "SPX 270219P05500000", "bid":  44.00, "ask":  44.60, "mark":  44.30, "openInterest": 1250, "settlementType": "AM", "optionRoot": "SPX" },
    { "strike": 6000, "type": "CALL", "symbol": "SPX 270219C06000000", "bid":  90.00, "ask":  90.70, "mark":  90.35, "openInterest": 890,  "settlementType": "AM", "optionRoot": "SPX" },
    { "strike": 6000, "type": "PUT",  "symbol": "SPX 270219P06000000", "bid": 290.00, "ask": 290.70, "mark": 290.35, "openInterest": 900,  "settlementType": "AM", "optionRoot": "SPX" },
    { "strike": 6500, "type": "CALL", "symbol": "SPX 270219C06500000", "bid":   5.50, "ask":   5.90, "mark":   5.70, "openInterest": 1240, "settlementType": "AM", "optionRoot": "SPX" },
    { "strike": 6500, "type": "PUT",  "symbol": "SPX 270219P06500000", "bid": 997.80, "ask": 999.10, "mark": 998.45, "openInterest": 1300, "settlementType": "AM", "optionRoot": "SPX" },
    { "strike": 5500, "type": "CALL", "symbol": "SPXW 270219C05500000", "bid": 300.00, "ask": 300.90, "mark": 300.45, "openInterest": 80, "settlementType": "PM", "optionRoot": "SPXW" },
    { "strike": 5500, "type": "PUT",  "symbol": "SPXW 270219P05500000", "bid":  44.00, "ask":  44.80, "mark":  44.40, "openInterest": 80, "settlementType": "PM", "optionRoot": "SPXW" }
  ]
}
```

Note: values are plausible but not tied to actual market data — only need to produce predictable compute output.

- [ ] **Step 2: Commit**

```bash
git add __tests__/fixtures/spx-chain.json
git commit -m "test: add SPX chain fixture for candidate compute"
```

---

### Task 8: `computeCandidates` — TDD

**Files:**
- Create: `src/lib/schwab/compute-candidates.ts`
- Create: `__tests__/schwab/compute-candidates.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// __tests__/schwab/compute-candidates.test.ts
import { describe, it, expect } from "vitest";
import fixture from "../fixtures/spx-chain.json";
import { computeCandidates } from "@/lib/schwab/compute-candidates";
import type { ChainSnapshot } from "@/lib/schwab/types";

const chain = fixture as ChainSnapshot;

describe("computeCandidates", () => {
  it("filters out non-SPX option roots (SPXW) and non-AM settlement", () => {
    const result = computeCandidates(chain, 500_000);
    // None of the returned candidates should reference an SPXW symbol.
    for (const c of result.candidates) {
      for (const leg of c.legs) {
        expect(leg.symbol.startsWith("SPX ")).toBe(true);
      }
    }
  });

  it("returns at least one candidate for a reasonable $500K target", () => {
    const result = computeCandidates(chain, 500_000);
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.selected).not.toBeNull();
    expect(result.reason).toBeNull();
  });

  it("selected is the top-scored candidate", () => {
    const result = computeCandidates(chain, 500_000);
    const top = [...result.candidates].sort((a, b) => b.score - a.score)[0];
    expect(result.selected).toEqual(top);
  });

  it("all returned candidates are within ±15% of target borrow", () => {
    const target = 500_000;
    const result = computeCandidates(chain, target);
    for (const c of result.candidates) {
      const drift = Math.abs(c.actualBorrow - target) / target;
      expect(drift).toBeLessThanOrEqual(0.15);
    }
  });

  it("mutes candidates whose min OI < contracts × 10 rather than dropping them", () => {
    // Force a large contract count so liquidity check bites
    const result = computeCandidates(chain, 5_000_000);
    const muted = result.candidates.filter((c) => c.muted);
    const clean  = result.candidates.filter((c) => !c.muted);
    // With our fixture (OI ≤ 1300), contracts ≥ 131 will trigger mute
    expect(muted.length + clean.length).toBe(result.candidates.length);
    // At least one should be muted at this large target
    expect(muted.length).toBeGreaterThan(0);
  });

  it("returns reason=min_credit_exceeds_target for a tiny target", () => {
    const result = computeCandidates(chain, 100);
    expect(result.candidates).toEqual([]);
    expect(result.reason).toBe("min_credit_exceeds_target");
    expect(result.selected).toBeNull();
  });

  it("computes rate formula: ((width - credit) / credit) × (365/DTE)", () => {
    const result = computeCandidates(chain, 500_000);
    const c = result.selected!;
    const expected =
      ((c.strikeWidth - c.boxCredit) / c.boxCredit) * (365 / chain.dte);
    expect(c.rate).toBeCloseTo(expected, 6);
  });

  it("actualBorrow = boxCredit * 100 * contracts", () => {
    const result = computeCandidates(chain, 500_000);
    for (const c of result.candidates) {
      expect(c.actualBorrow).toBeCloseTo(c.boxCredit * 100 * c.contracts, 2);
    }
  });

  it("each candidate has exactly 4 legs with correct actions", () => {
    const result = computeCandidates(chain, 500_000);
    for (const c of result.candidates) {
      expect(c.legs).toHaveLength(4);
      const summary = c.legs.map((l) => `${l.action} ${l.type}@${l.strike}`).sort();
      expect(summary).toEqual([
        `BUY CALL@${c.lowerStrike}`,
        `BUY PUT@${c.upperStrike}`,
        `SELL CALL@${c.upperStrike}`,
        `SELL PUT@${c.lowerStrike}`,
      ].sort());
    }
  });

  it("returns top 5 candidates max", () => {
    const result = computeCandidates(chain, 500_000);
    expect(result.candidates.length).toBeLessThanOrEqual(5);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm test compute-candidates
```

Expected: module-not-found.

- [ ] **Step 3: Implement**

```typescript
// src/lib/schwab/compute-candidates.ts
import type {
  ChainSnapshot,
  ChainContract,
  Candidate,
  CandidateLeg,
  CandidatesResponse,
} from "@/lib/schwab/types";

const SPX_MULTIPLIER = 100;
const TOLERANCE = 0.15;               // ±15% of target borrow
const LIQUIDITY_MULTIPLIER = 10;      // minOI must be ≥ contracts × 10
const TOP_N = 5;
const LIQUIDITY_PENALTY_WEIGHT = 0.02; // subtracted when below threshold
const SPREAD_PENALTY_WEIGHT = 0.5;     // weight on (spreadWidth / boxCredit)

interface StrikeBuckets {
  calls: Map<number, ChainContract>;
  puts: Map<number, ChainContract>;
  strikes: number[]; // sorted ascending, strikes that have BOTH call + put
}

function bucket(chain: ChainSnapshot): StrikeBuckets {
  const calls = new Map<number, ChainContract>();
  const puts = new Map<number, ChainContract>();
  for (const c of chain.contracts) {
    if (c.optionRoot !== "SPX" || c.settlementType !== "AM") continue;
    if (c.type === "CALL") calls.set(c.strike, c);
    else puts.set(c.strike, c);
  }
  const strikes = [...calls.keys()]
    .filter((k) => puts.has(k))
    .sort((a, b) => a - b);
  return { calls, puts, strikes };
}

function candidateFor(
  lowerCall: ChainContract,
  upperCall: ChainContract,
  lowerPut: ChainContract,
  upperPut: ChainContract,
  target: number,
  dte: number,
): Candidate | null {
  const boxCredit =
    (lowerCall.bid - upperCall.ask) + (upperPut.bid - lowerPut.ask);
  if (boxCredit <= 0) return null;

  const strikeWidth = upperCall.strike - lowerCall.strike;
  if (strikeWidth <= 0) return null;

  const contracts = Math.max(
    1,
    Math.round(target / (boxCredit * SPX_MULTIPLIER)),
  );
  const actualBorrow = boxCredit * SPX_MULTIPLIER * contracts;

  // tolerance filter
  if (Math.abs(actualBorrow - target) / target > TOLERANCE) return null;

  const rate = ((strikeWidth - boxCredit) / boxCredit) * (365 / dte);

  const minOI = Math.min(
    lowerCall.openInterest,
    upperCall.openInterest,
    lowerPut.openInterest,
    upperPut.openInterest,
  );

  const spreadWidth =
    (lowerCall.ask - lowerCall.bid) +
    (upperCall.ask - upperCall.bid) +
    (lowerPut.ask - lowerPut.bid) +
    (upperPut.ask - upperPut.bid);

  const liquidityThreshold = contracts * LIQUIDITY_MULTIPLIER;
  const muted = minOI < liquidityThreshold;

  const liquidityPenalty = muted ? LIQUIDITY_PENALTY_WEIGHT : 0;
  const spreadPenalty = (spreadWidth / boxCredit) * SPREAD_PENALTY_WEIGHT;
  const score = rate - liquidityPenalty - spreadPenalty;

  const legs: CandidateLeg[] = [
    { action: "BUY",  type: "CALL", strike: lowerCall.strike, symbol: lowerCall.symbol, bid: lowerCall.bid, ask: lowerCall.ask, openInterest: lowerCall.openInterest },
    { action: "SELL", type: "CALL", strike: upperCall.strike, symbol: upperCall.symbol, bid: upperCall.bid, ask: upperCall.ask, openInterest: upperCall.openInterest },
    { action: "SELL", type: "PUT",  strike: lowerPut.strike,  symbol: lowerPut.symbol,  bid: lowerPut.bid,  ask: lowerPut.ask,  openInterest: lowerPut.openInterest },
    { action: "BUY",  type: "PUT",  strike: upperPut.strike,  symbol: upperPut.symbol,  bid: upperPut.bid,  ask: upperPut.ask,  openInterest: upperPut.openInterest },
  ];

  return {
    lowerStrike: lowerCall.strike,
    upperStrike: upperCall.strike,
    strikeWidth,
    contracts,
    boxCredit,
    actualBorrow,
    rate,
    minOI,
    spreadWidth,
    score,
    muted,
    legs,
  };
}

export function computeCandidates(
  chain: ChainSnapshot,
  target: number,
): CandidatesResponse {
  const { calls, puts, strikes } = bucket(chain);

  const found: Candidate[] = [];
  for (let i = 0; i < strikes.length; i++) {
    for (let j = i + 1; j < strikes.length; j++) {
      const lower = strikes[i];
      const upper = strikes[j];
      const lc = calls.get(lower)!;
      const uc = calls.get(upper)!;
      const lp = puts.get(lower)!;
      const up = puts.get(upper)!;
      const cand = candidateFor(lc, uc, lp, up, target, chain.dte);
      if (cand) found.push(cand);
    }
  }

  if (found.length === 0) {
    return {
      underlying: chain.underlying,
      expiration: chain.expiration,
      candidates: [],
      selected: null,
      asOf: chain.asOf,
      reason: "min_credit_exceeds_target",
    };
  }

  found.sort((a, b) => b.score - a.score);
  const top = found.slice(0, TOP_N);

  const allMuted = top.every((c) => c.muted);
  const reason = allMuted ? "thin_liquidity" : null;

  return {
    underlying: chain.underlying,
    expiration: chain.expiration,
    candidates: top,
    selected: top[0],
    asOf: chain.asOf,
    reason,
  };
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
pnpm test compute-candidates
```

Adjust fixture values or constants if a test fails at the margin (e.g., thin_liquidity threshold). All 10 tests must pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/schwab/compute-candidates.ts __tests__/schwab/compute-candidates.test.ts
git commit -m "feat(schwab): pure computeCandidates ranker (rate, liquidity, spread)"
```

---

### Task 9: Chain fetcher (`getChainSnapshot`) with server-side cache

**Files:**
- Create: `src/lib/schwab/chain.ts`
- Create: `__tests__/schwab/chain.test.ts`

This wraps the Schwab client call + normalizes the response into `ChainSnapshot` and handles a 5-minute in-memory cache.

- [ ] **Step 1: Write failing tests**

```typescript
// __tests__/schwab/chain.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchChainSnapshot, __resetChainCacheForTests } from "@/lib/schwab/chain";

describe("fetchChainSnapshot", () => {
  beforeEach(() => {
    __resetChainCacheForTests();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function fakeClient(counter: { n: number }) {
    return {
      marketData: {
        options: {
          getOptionChain: vi.fn(async () => {
            counter.n += 1;
            return {
              underlyingPrice: 5782.1,
              underlying: { last: 5782.1, mark: 5782.1, symbol: "$SPX" },
              callExpDateMap: {
                "2027-02-19:301": {
                  "5500.0": [{
                    symbol: "SPX 270219C05500000",
                    strikePrice: 5500,
                    bidPrice: 300.1, askPrice: 300.8, markPrice: 300.45,
                    openInterest: 1240, settlementType: "AM", optionRoot: "SPX",
                    daysToExpiration: 301,
                  }],
                },
              },
              putExpDateMap: {
                "2027-02-19:301": {
                  "5500.0": [{
                    symbol: "SPX 270219P05500000",
                    strikePrice: 5500,
                    bidPrice: 44, askPrice: 44.6, markPrice: 44.3,
                    openInterest: 1250, settlementType: "AM", optionRoot: "SPX",
                    daysToExpiration: 301,
                  }],
                },
              },
            };
          }),
        },
      },
    };
  }

  it("calls Schwab and normalizes to ChainSnapshot", async () => {
    const counter = { n: 0 };
    const client = fakeClient(counter);
    const snap = await fetchChainSnapshot(
      client as never,
      "2027-02-19",
    );
    expect(snap.underlying.last).toBe(5782.1);
    expect(snap.contracts.length).toBe(2);
    expect(snap.contracts[0].optionRoot).toBe("SPX");
    expect(counter.n).toBe(1);
  });

  it("reuses cache within TTL", async () => {
    const counter = { n: 0 };
    const client = fakeClient(counter);
    await fetchChainSnapshot(client as never, "2027-02-19");
    await fetchChainSnapshot(client as never, "2027-02-19");
    expect(counter.n).toBe(1);
  });

  it("refetches after TTL", async () => {
    const counter = { n: 0 };
    const client = fakeClient(counter);
    await fetchChainSnapshot(client as never, "2027-02-19");
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    await fetchChainSnapshot(client as never, "2027-02-19");
    expect(counter.n).toBe(2);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm test schwab/chain
```

- [ ] **Step 3: Implement**

```typescript
// src/lib/schwab/chain.ts
import type { ChainSnapshot, ChainContract } from "@/lib/schwab/types";
import type { SchwabClient } from "@/lib/schwab/client";

const TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  snap: ChainSnapshot;
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();

export function __resetChainCacheForTests(): void {
  cache.clear();
}

function cacheKey(expiration: string): string {
  return `chain:${expiration}`;
}

// Normalize Schwab SDK response into our ChainSnapshot.
// Schwab returns per-expiration maps keyed by "YYYY-MM-DD:DTE" → strike string → [contract, ...].
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalize(raw: any, expiration: string): ChainSnapshot {
  const contracts: ChainContract[] = [];
  let dte = 0;
  const underlying = {
    symbol: raw.underlying?.symbol ?? "$SPX",
    last: raw.underlying?.last ?? raw.underlyingPrice,
    mark: raw.underlying?.mark ?? raw.underlyingPrice,
  };

  for (const type of ["CALL", "PUT"] as const) {
    const mapKey = type === "CALL" ? "callExpDateMap" : "putExpDateMap";
    const byExp = raw[mapKey] ?? {};
    for (const expKey of Object.keys(byExp)) {
      const [date, dteStr] = expKey.split(":");
      if (date !== expiration) continue;
      dte = Number(dteStr);
      const byStrike = byExp[expKey];
      for (const strikeKey of Object.keys(byStrike)) {
        for (const c of byStrike[strikeKey]) {
          contracts.push({
            strike: c.strikePrice,
            type,
            symbol: c.symbol,
            bid: c.bidPrice,
            ask: c.askPrice,
            mark: c.markPrice,
            openInterest: c.openInterest ?? 0,
            settlementType: c.settlementType,
            optionRoot: c.optionRoot,
          });
        }
      }
    }
  }

  return {
    underlying,
    expiration,
    dte,
    contracts,
    asOf: new Date().toISOString(),
  };
}

export async function fetchChainSnapshot(
  client: SchwabClient,
  expiration: string,
): Promise<ChainSnapshot> {
  const key = cacheKey(expiration);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.fetchedAt < TTL_MS) return hit.snap;

  const raw = await client.marketData.options.getOptionChain({
    queryParams: {
      symbol: "$SPX",
      contractType: "ALL",
      includeUnderlyingQuote: true,
      optionType: "S",
      fromDate: expiration,
      toDate: expiration,
    },
  });
  const snap = normalize(raw, expiration);
  cache.set(key, { snap, fetchedAt: Date.now() });
  return snap;
}
```

Note: the precise Schwab SDK response shape is taken from the plan doc. If the SDK package you installed exposes a typed shape (call/put expiration maps), swap `any` for that type.

- [ ] **Step 4: Run — expect PASS**

```bash
pnpm test schwab/chain
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/schwab/chain.ts __tests__/schwab/chain.test.ts
git commit -m "feat(schwab): chain fetcher with 5-min in-memory cache"
```

---

## Phase C — API routes

### Task 10: `GET /api/schwab/status`

**Files:**
- Create: `src/app/api/schwab/status/route.ts`
- Create: `__tests__/api/schwab-status.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// __tests__/api/schwab-status.test.ts
import { describe, it, expect, vi } from "vitest";

const mockGetClient = vi.fn();
vi.mock("@/lib/schwab/client", () => ({
  getSchwabClientForRequest: (req: Request) => mockGetClient(req),
}));

import { GET } from "@/app/api/schwab/status/route";

describe("GET /api/schwab/status", () => {
  it("returns connected: false when no client", async () => {
    mockGetClient.mockResolvedValueOnce(null);
    const res = await GET(new Request("http://x/api/schwab/status"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ connected: false });
  });

  it("returns connected: true when client resolved", async () => {
    mockGetClient.mockResolvedValueOnce({});
    const res = await GET(new Request("http://x/api/schwab/status"));
    const body = await res.json();
    expect(body).toEqual({ connected: true });
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm test schwab-status
```

- [ ] **Step 3: Implement**

```typescript
// src/app/api/schwab/status/route.ts
import { NextResponse } from "next/server";
import { getSchwabClientForRequest } from "@/lib/schwab/client";

export async function GET(req: Request) {
  try {
    const client = await getSchwabClientForRequest(req);
    return NextResponse.json({ connected: client !== null });
  } catch {
    return NextResponse.json({ connected: false });
  }
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/app/api/schwab/status/route.ts __tests__/api/schwab-status.test.ts
git commit -m "feat(api): GET /api/schwab/status (connected boolean)"
```

---

### Task 11: `GET /api/schwab/chain`

**Files:**
- Create: `src/app/api/schwab/chain/route.ts`
- Create: `__tests__/api/schwab-chain.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// __tests__/api/schwab-chain.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import fixture from "../fixtures/spx-chain.json";

const mockGetClient = vi.fn();
vi.mock("@/lib/schwab/client", () => ({
  getSchwabClientForRequest: (req: Request) => mockGetClient(req),
}));

const mockFetchSnap = vi.fn();
vi.mock("@/lib/schwab/chain", () => ({
  fetchChainSnapshot: (...args: unknown[]) => mockFetchSnap(...args),
}));

import { GET } from "@/app/api/schwab/chain/route";

function url(q: string): Request {
  return new Request(`http://x/api/schwab/chain?${q}`);
}

describe("GET /api/schwab/chain", () => {
  beforeEach(() => {
    mockGetClient.mockReset();
    mockFetchSnap.mockReset();
  });

  it("returns 401 when not connected", async () => {
    mockGetClient.mockResolvedValueOnce(null);
    const res = await GET(url("expiration=2027-02-19&target=500000"));
    expect(res.status).toBe(401);
  });

  it("returns 400 on missing params", async () => {
    mockGetClient.mockResolvedValueOnce({});
    const res = await GET(url("expiration=2027-02-19"));
    expect(res.status).toBe(400);
  });

  it("returns candidates from compute", async () => {
    mockGetClient.mockResolvedValueOnce({});
    mockFetchSnap.mockResolvedValueOnce(fixture);
    const res = await GET(url("expiration=2027-02-19&target=500000"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.candidates.length).toBeGreaterThan(0);
    expect(body.selected).not.toBeNull();
  });

  it("returns 503 on chain fetch failure", async () => {
    mockGetClient.mockResolvedValueOnce({});
    mockFetchSnap.mockRejectedValueOnce(new Error("schwab down"));
    const res = await GET(url("expiration=2027-02-19&target=500000"));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("chain_unavailable");
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

```typescript
// src/app/api/schwab/chain/route.ts
import { NextResponse } from "next/server";
import { getSchwabClientForRequest } from "@/lib/schwab/client";
import { fetchChainSnapshot } from "@/lib/schwab/chain";
import { computeCandidates } from "@/lib/schwab/compute-candidates";

export async function GET(req: Request) {
  const client = await getSchwabClientForRequest(req);
  if (!client) {
    return NextResponse.json({ error: "not_connected" }, { status: 401 });
  }

  const url = new URL(req.url);
  const expiration = url.searchParams.get("expiration");
  const targetRaw = url.searchParams.get("target");
  const target = targetRaw ? Number(targetRaw) : NaN;

  if (!expiration || !Number.isFinite(target) || target <= 0 || target > 10_000_000) {
    return NextResponse.json({ error: "invalid_params" }, { status: 400 });
  }

  try {
    const snap = await fetchChainSnapshot(client, expiration);
    const result = computeCandidates(snap, target);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("chain fetch failed:", err);
    return NextResponse.json(
      { error: "chain_unavailable" },
      { status: 503 },
    );
  }
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/app/api/schwab/chain/route.ts __tests__/api/schwab-chain.test.ts
git commit -m "feat(api): GET /api/schwab/chain returns ranked candidates"
```

---

### Task 12: `POST /api/schwab/admin/login`

**Files:**
- Create: `src/app/api/schwab/admin/login/route.ts`
- Create: `__tests__/api/schwab-admin-login.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// __tests__/api/schwab-admin-login.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockUpsert = vi.fn();
vi.mock("@/lib/schwab/connections", () => ({
  upsertConnection: (...args: unknown[]) => mockUpsert(...args),
}));

vi.mock("@/lib/session", async (orig) => {
  const actual = await orig<typeof import("@/lib/session")>();
  return {
    ...actual,
    getSessionSecret: () => "test-secret-at-least-32-chars-long-abcdef",
  };
});

import { POST } from "@/app/api/schwab/admin/login/route";

function postWith(bodyJson: unknown): Request {
  return new Request("http://x/api/schwab/admin/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(bodyJson),
  });
}

describe("POST /api/schwab/admin/login", () => {
  beforeEach(() => {
    mockUpsert.mockReset();
    process.env.ADMIN_KEY = "correct-horse-battery-staple";
    process.env.SCHWAB_REFRESH_TOKEN = "env-refresh-token";
  });

  it("rejects wrong admin key", async () => {
    const res = await POST(postWith({ key: "wrong" }));
    expect(res.status).toBe(403);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("rejects missing env token", async () => {
    delete process.env.SCHWAB_REFRESH_TOKEN;
    const res = await POST(postWith({ key: "correct-horse-battery-staple" }));
    expect(res.status).toBe(500);
  });

  it("on valid key, upserts row and sets signed cookie", async () => {
    mockUpsert.mockResolvedValueOnce(undefined);
    const res = await POST(postWith({ key: "correct-horse-battery-staple" }));
    expect(res.status).toBe(200);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.any(String),
      "env-refresh-token",
    );
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toMatch(/^boxspreads_session=/);
    expect(setCookie).toMatch(/HttpOnly/i);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

```typescript
// src/app/api/schwab/admin/login/route.ts
import { NextResponse } from "next/server";
import { upsertConnection } from "@/lib/schwab/connections";
import {
  SESSION_COOKIE_NAME,
  generateSessionId,
  signSessionId,
  getSessionSecret,
} from "@/lib/session";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { key?: string };

  const expected = process.env.ADMIN_KEY;
  if (!expected || body.key !== expected) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const refreshToken = process.env.SCHWAB_REFRESH_TOKEN;
  if (!refreshToken) {
    return NextResponse.json(
      { error: "server_not_configured" },
      { status: 500 },
    );
  }

  const sessionId = generateSessionId();
  await upsertConnection(sessionId, refreshToken);

  const signed = signSessionId(sessionId, getSessionSecret());
  const cookie = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(signed)}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    // 7 days — matches Schwab refresh token lifetime
    "Max-Age=604800",
    ...(process.env.NODE_ENV === "production" ? ["Secure"] : []),
  ].join("; ");

  return NextResponse.json(
    { ok: true },
    { headers: { "set-cookie": cookie } },
  );
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/app/api/schwab/admin/login/route.ts __tests__/api/schwab-admin-login.test.ts
git commit -m "feat(api): POST /api/schwab/admin/login (Phase 1 George login)"
```

---

### Task 13: `POST /api/schwab/disconnect`

**Files:**
- Create: `src/app/api/schwab/disconnect/route.ts`
- Create: `__tests__/api/schwab-disconnect.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// __tests__/api/schwab-disconnect.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDelete = vi.fn();
vi.mock("@/lib/schwab/connections", () => ({
  deleteConnection: (id: string) => mockDelete(id),
}));

vi.mock("@/lib/session", async (orig) => {
  const actual = await orig<typeof import("@/lib/session")>();
  return {
    ...actual,
    verifySessionCookie: vi.fn(() => "sess-x"),
    getSessionSecret: () => "test-secret-at-least-32-chars-long-abcdef",
  };
});

import { POST } from "@/app/api/schwab/disconnect/route";

describe("POST /api/schwab/disconnect", () => {
  beforeEach(() => mockDelete.mockReset());

  it("deletes the row and clears the cookie", async () => {
    const headers = new Headers();
    headers.set("cookie", "boxspreads_session=sess-x.mac");
    const res = await POST(new Request("http://x/api/schwab/disconnect", { method: "POST", headers }));
    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalledWith("sess-x");
    expect(res.headers.get("set-cookie")).toMatch(/Max-Age=0/);
  });

  it("no-ops (200) when no cookie", async () => {
    const res = await POST(new Request("http://x/api/schwab/disconnect", { method: "POST" }));
    expect(res.status).toBe(200);
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

```typescript
// src/app/api/schwab/disconnect/route.ts
import { NextResponse } from "next/server";
import { deleteConnection } from "@/lib/schwab/connections";
import {
  SESSION_COOKIE_NAME,
  verifySessionCookie,
  getSessionSecret,
} from "@/lib/session";

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const p of header.split(/;\s*/)) {
    const eq = p.indexOf("=");
    if (eq > 0 && p.slice(0, eq) === name) {
      return decodeURIComponent(p.slice(eq + 1));
    }
  }
  return null;
}

export async function POST(req: Request) {
  const cookie = readCookie(req, SESSION_COOKIE_NAME);
  const sessionId = cookie ? verifySessionCookie(cookie, getSessionSecret()) : null;
  if (sessionId) {
    await deleteConnection(sessionId);
  }
  const clear = `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;
  return NextResponse.json({ ok: true }, { headers: { "set-cookie": clear } });
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/app/api/schwab/disconnect/route.ts __tests__/api/schwab-disconnect.test.ts
git commit -m "feat(api): POST /api/schwab/disconnect"
```

---

## Phase D — UI components

### Task 14: Admin login page for George

**Files:**
- Create: `src/app/admin/page.tsx`

- [ ] **Step 1: Implement**

```tsx
// src/app/admin/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function AdminPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "err">(
    "idle",
  );
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const key = params.get("key");
    if (!key) return;
    setStatus("loading");
    fetch("/api/schwab/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        setStatus("ok");
        setTimeout(() => router.replace("/"), 500);
      })
      .catch((e) => {
        setStatus("err");
        setMsg(String(e));
      });
  }, [params, router]);

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-lg font-semibold">Admin login</h1>
      <p className="mt-2 text-sm text-gray-600">
        {status === "idle" && "Waiting for ?key=… parameter…"}
        {status === "loading" && "Connecting…"}
        {status === "ok" && "Connected. Redirecting…"}
        {status === "err" && `Error: ${msg}`}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "feat(admin): /admin page for Phase-1 George login via ?key=..."
```

---

### Task 15: `TargetBorrowInput` component

**Files:**
- Create: `src/components/calculator/TargetBorrowInput.tsx`
- Create: `__tests__/components/TargetBorrowInput.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// __tests__/components/TargetBorrowInput.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { TargetBorrowInput } from "@/components/calculator/TargetBorrowInput";

describe("TargetBorrowInput", () => {
  it("renders formatted value", () => {
    const { getByDisplayValue } = render(
      <TargetBorrowInput value={500_000} onChange={() => {}} />,
    );
    expect(getByDisplayValue("$500,000")).toBeTruthy();
  });

  it("parses typed value and calls onChange", () => {
    const onChange = vi.fn();
    const { getByRole } = render(
      <TargetBorrowInput value={0} onChange={onChange} />,
    );
    const input = getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "1,250,000" } });
    expect(onChange).toHaveBeenCalledWith(1_250_000);
  });

  it("ignores non-numeric input", () => {
    const onChange = vi.fn();
    const { getByRole } = render(
      <TargetBorrowInput value={100_000} onChange={onChange} />,
    );
    fireEvent.change(getByRole("textbox"), { target: { value: "abc" } });
    expect(onChange).toHaveBeenCalledWith(0);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

```tsx
// src/components/calculator/TargetBorrowInput.tsx
"use client";

import { useMemo } from "react";

interface Props {
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}

function formatDollars(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "";
  return `$${n.toLocaleString("en-US")}`;
}

function parseDollars(s: string): number {
  const digits = s.replace(/[^\d]/g, "");
  if (!digits) return 0;
  return Number(digits);
}

export function TargetBorrowInput({ value, onChange, disabled }: Props) {
  const display = useMemo(() => formatDollars(value), [value]);
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-widest text-gray-500 mb-1">
        How much to borrow?
      </div>
      <input
        type="text"
        inputMode="numeric"
        value={display}
        disabled={disabled}
        onChange={(e) => onChange(parseDollars(e.target.value))}
        placeholder="$500,000"
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-lg font-semibold tabular-nums text-gray-900 focus:outline-none focus:border-blue-500"
      />
    </div>
  );
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/components/calculator/TargetBorrowInput.tsx __tests__/components/TargetBorrowInput.test.tsx
git commit -m "feat(ui): TargetBorrowInput — replaces width+contracts+mid inputs"
```

---

### Task 16: `ConnectStatus` nav component + layout wiring

**Files:**
- Create: `src/components/calculator/ConnectStatus.tsx`
- Modify: `src/app/layout.tsx`
- Create: `__tests__/components/ConnectStatus.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// __tests__/components/ConnectStatus.test.tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ConnectStatus } from "@/components/calculator/ConnectStatus";

describe("ConnectStatus", () => {
  it("renders disabled Connect CTA when disconnected", () => {
    const { getByRole } = render(<ConnectStatus connected={false} />);
    const btn = getByRole("button") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toMatch(/Connect Schwab/i);
    expect(btn.textContent).toMatch(/coming soon/i);
  });

  it("renders Connected pill with timestamp when connected", () => {
    const { getByText } = render(
      <ConnectStatus
        connected
        asOf="2026-04-15T18:30:00Z"
        underlyingLast={5782.1}
        onRefresh={() => {}}
      />,
    );
    expect(getByText(/Connected/i)).toBeTruthy();
    expect(getByText(/5,782/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

```tsx
// src/components/calculator/ConnectStatus.tsx
"use client";

import { useEffect, useState } from "react";

interface Props {
  connected: boolean;
  asOf?: string;
  underlyingLast?: number;
  onRefresh?: () => void;
}

function relativeAgo(iso: string, nowMs: number): string {
  const diff = Math.max(0, Math.floor((nowMs - Date.parse(iso)) / 1000));
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export function ConnectStatus({ connected, asOf, underlyingLast, onRefresh }: Props) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(id);
  }, []);

  if (!connected) {
    return (
      <button
        type="button"
        disabled
        aria-disabled="true"
        className="rounded-md bg-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-500 cursor-not-allowed"
        title="Schwab Commercial API approval pending"
      >
        + Connect Schwab · coming soon
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs font-semibold text-green-700">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
        Connected
        {underlyingLast ? (
          <span className="text-gray-600 font-normal">
            · SPX {underlyingLast.toLocaleString("en-US", { maximumFractionDigits: 2 })}
          </span>
        ) : null}
        {asOf ? (
          <span className="text-gray-400 font-normal">· {relativeAgo(asOf, now)}</span>
        ) : null}
      </span>
      {onRefresh ? (
        <button
          type="button"
          onClick={onRefresh}
          className="text-gray-500 hover:text-gray-900"
          title="Refresh chain"
        >
          ↻
        </button>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Wire into layout nav**

Modify `src/app/layout.tsx`:

```tsx
// Replace the existing <nav> JSX with a version that includes ConnectStatus on the right.
// The full new RootLayout body:
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import { ConnectStatusSlot } from "@/components/calculator/ConnectStatusSlot";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "boxspreads.app — Borrow at Near-Treasury Rates",
  description:
    "Schwab-connected SPX box spread optimizer — target a borrow amount, get a Schwab-pasteable order.",
  openGraph: {
    title: "boxspreads.app — Borrow at Near-Treasury Rates",
    description: "Schwab-connected SPX box spread optimizer.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} text-gray-900 antialiased`}>
        <nav className="mx-auto flex max-w-screen-2xl items-center justify-between px-6 py-3 border-b border-gray-300">
          <div className="flex items-center gap-5">
            <Link href="/" className="text-sm font-bold tracking-tight text-gray-900">
              boxspreads.app
            </Link>
            <div className="flex gap-5 text-sm font-medium text-gray-500">
              <Link href="/" className="hover:text-gray-900 transition-colors">Calculator</Link>
              <Link href="/learn" className="hover:text-gray-900 transition-colors">Learn</Link>
            </div>
          </div>
          <ConnectStatusSlot />
        </nav>
        <main className="mx-auto max-w-screen-2xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
```

`ConnectStatusSlot` is a thin client component that fetches `/api/schwab/status` and renders `ConnectStatus`. We need it as a separate file because `layout.tsx` is a server component:

Create `src/components/calculator/ConnectStatusSlot.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { ConnectStatus } from "./ConnectStatus";

export function ConnectStatusSlot() {
  const [connected, setConnected] = useState<boolean | null>(null);
  useEffect(() => {
    fetch("/api/schwab/status")
      .then((r) => r.json())
      .then((d) => setConnected(Boolean(d.connected)))
      .catch(() => setConnected(false));
  }, []);
  if (connected === null) return null;
  // When connected, the Calculator itself will render a richer ConnectStatus beneath (with underlyingLast/asOf);
  // this slot just shows the minimal pill or the disabled CTA.
  return <ConnectStatus connected={connected} />;
}
```

- [ ] **Step 5: Run — expect PASS**

```bash
pnpm test ConnectStatus
```

- [ ] **Step 6: Commit**

```bash
git add src/components/calculator/ConnectStatus.tsx src/components/calculator/ConnectStatusSlot.tsx src/app/layout.tsx __tests__/components/ConnectStatus.test.tsx
git commit -m "feat(ui): ConnectStatus nav pill + disabled CTA for disconnected state"
```

---

### Task 17: `ConnectBanner` (disconnected explain-bar)

**Files:**
- Create: `src/components/calculator/ConnectBanner.tsx`

- [ ] **Step 1: Implement**

```tsx
// src/components/calculator/ConnectBanner.tsx
export function ConnectBanner() {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
      <div>
        <strong className="font-semibold">Connect Schwab for accurate rates and a pastable order.</strong>{" "}
        The numbers below use Treasury yields — real box prices, liquidity, and Schwab-pasteable orders require your chain.
      </div>
      <button
        type="button"
        disabled
        className="flex-shrink-0 rounded-md bg-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-500 cursor-not-allowed"
        title="Schwab Commercial API approval pending"
      >
        Connect · soon
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/calculator/ConnectBanner.tsx
git commit -m "feat(ui): ConnectBanner — disconnected state explain bar"
```

---

### Task 18: `CandidatesPanel` — connected rows + empty state

**Files:**
- Create: `src/components/calculator/CandidatesPanel.tsx`
- Create: `__tests__/components/CandidatesPanel.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// __tests__/components/CandidatesPanel.test.tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { CandidatesPanel } from "@/components/calculator/CandidatesPanel";
import type { Candidate } from "@/lib/schwab/types";

const baseLegs = [
  { action: "BUY" as const, type: "CALL" as const, strike: 5500, symbol: "SPX 270219C05500000", bid: 300.1, ask: 300.8, openInterest: 1240 },
  { action: "SELL" as const, type: "CALL" as const, strike: 6500, symbol: "SPX 270219C06500000", bid:   5.5, ask:   5.9, openInterest: 1240 },
  { action: "SELL" as const, type: "PUT"  as const, strike: 5500, symbol: "SPX 270219P05500000", bid:  44.0, ask:  44.6, openInterest: 1250 },
  { action: "BUY" as const, type: "PUT"  as const, strike: 6500, symbol: "SPX 270219P06500000", bid: 997.8, ask: 999.1, openInterest: 1300 },
];

const cand: Candidate = {
  lowerStrike: 5500, upperStrike: 6500, strikeWidth: 1000, contracts: 1,
  boxCredit: 948.5, actualBorrow: 94850, rate: 0.0439,
  minOI: 1240, spreadWidth: 3.4, score: 0.042, muted: false, legs: baseLegs,
};

describe("CandidatesPanel", () => {
  it("renders candidates with selected highlighted", () => {
    const { getByText } = render(
      <CandidatesPanel
        state="connected"
        candidates={[cand]}
        selected={cand}
        onSelect={() => {}}
      />,
    );
    expect(getByText("5500 / 6500")).toBeTruthy();
  });

  it("renders empty state when state=disconnected", () => {
    const { getByText } = render(
      <CandidatesPanel state="disconnected" candidates={[]} selected={null} onSelect={() => {}} />,
    );
    expect(getByText(/Strike candidates appear here once connected/i)).toBeTruthy();
  });

  it("renders thin-liquidity reason", () => {
    const muted = { ...cand, muted: true };
    const { getByText } = render(
      <CandidatesPanel state="connected" candidates={[muted]} selected={muted} onSelect={() => {}} reason="thin_liquidity" />,
    );
    expect(getByText(/thin/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

```tsx
// src/components/calculator/CandidatesPanel.tsx
"use client";

import type { Candidate, CandidatesReason } from "@/lib/schwab/types";

type State = "connected" | "disconnected";

interface Props {
  state: State;
  candidates: Candidate[];
  selected: Candidate | null;
  onSelect: (c: Candidate) => void;
  reason?: CandidatesReason;
}

function fmtPct(n: number) { return `${(n * 100).toFixed(2)}%`; }
function fmtDollars(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function CandidatesPanel({ state, candidates, selected, onSelect, reason }: Props) {
  if (state === "disconnected") {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
        <div className="text-sm font-semibold text-gray-700 mb-1">
          Strike candidates appear here once connected
        </div>
        <div className="text-xs text-gray-500 mb-3 max-w-md mx-auto">
          We&apos;ll show strike pairs ranked for your target size — rate, real open interest, bid/ask width. Schwab&apos;s option chain is required to find actual tradeable strikes.
        </div>
        <button type="button" disabled className="rounded-md bg-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-500 cursor-not-allowed">
          + Connect Schwab · coming soon
        </button>
      </div>
    );
  }

  if (candidates.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        {reason === "min_credit_exceeds_target"
          ? "Your target is too small for any standard strike width at this expiration. Try a larger amount or a longer DTE."
          : "No candidates found for this expiration."}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-sky-700">
          Candidates · ranked for your size
        </div>
        {reason === "thin_liquidity" ? (
          <div className="text-[11px] text-amber-800 font-medium">
            Thin liquidity — consider a shorter DTE
          </div>
        ) : null}
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-[10px] font-semibold uppercase tracking-widest text-gray-500">
            <th className="px-2 py-1"></th>
            <th className="px-2 py-1">Strikes</th>
            <th className="px-2 py-1 text-right">Contracts</th>
            <th className="px-2 py-1 text-right">Borrow</th>
            <th className="px-2 py-1 text-right">Rate</th>
            <th className="px-2 py-1 text-right">Min OI</th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((c) => {
            const isSel = selected &&
              c.lowerStrike === selected.lowerStrike && c.upperStrike === selected.upperStrike;
            return (
              <tr
                key={`${c.lowerStrike}-${c.upperStrike}-${c.contracts}`}
                onClick={() => onSelect(c)}
                className={`cursor-pointer transition-colors ${isSel ? "bg-sky-100" : "hover:bg-white"} ${c.muted ? "opacity-50" : ""}`}
              >
                <td className="px-2 py-1.5 font-bold text-sky-700 w-4">{isSel ? "✓" : ""}</td>
                <td className="px-2 py-1.5 font-semibold">{c.lowerStrike} / {c.upperStrike}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">× {c.contracts}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{fmtDollars(c.actualBorrow)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{fmtPct(c.rate)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{c.minOI.toLocaleString()}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/components/calculator/CandidatesPanel.tsx __tests__/components/CandidatesPanel.test.tsx
git commit -m "feat(ui): CandidatesPanel with connected rows + disconnected empty state"
```

---

## Phase E — Calculator integration & order section

### Task 19: Rewire `Calculator.tsx`

This is the largest single edit. Split into substeps for clarity.

**Files:**
- Modify: `src/components/calculator/Calculator.tsx`
- Remove (stop referencing from Calculator): `UnifiedCalculator.tsx`, `BrokerageCTA.tsx`
- Modify: `src/components/order/LegTable.tsx` (accept real legs; small shape change)

- [ ] **Step 1: Replace Calculator.tsx**

Full replacement of `src/components/calculator/Calculator.tsx`:

```tsx
"use client";

import { useState, useEffect, useMemo, useSyncExternalStore } from "react";
import { YieldCurve } from "./YieldCurve";
import { ExpirationTable } from "./ExpirationTable";
import type { ExpirationRow } from "./ExpirationTable";
import { TargetBorrowInput } from "./TargetBorrowInput";
import { TaxRateInputs } from "./TaxRateInputs";
import { CandidatesPanel } from "./CandidatesPanel";
import { ConnectBanner } from "./ConnectBanner";
import { ConnectStatus } from "./ConnectStatus";
import { Tooltip } from "@/components/ui/Tooltip";
import { LegTable } from "@/components/order/LegTable";
import { OrderParams } from "@/components/order/OrderParams";
import { FeeBreakdown } from "@/components/order/FeeBreakdown";
import { BrokerageGuide } from "@/components/order/BrokerageGuide";
import {
  calcBoxRateSimple,
  calcBlendedTaxRate,
  calcAfterTaxRate,
  calcFeeImpact,
  calcAllInRate,
  interpolateTreasuryYield,
} from "@/lib/calc";
import { generateSpxExpirations } from "@/lib/strikes";
import {
  BROKERAGE_FEES,
  DEFAULT_SPREAD_BPS,
  DEFAULT_FEDERAL_TAX_RATE,
  DEFAULT_STATE_TAX_RATE,
  LTCG_RATE_FEDERAL,
  SPX_MULTIPLIER,
} from "@/lib/constants";
import type { TreasuryRates } from "@/lib/types";
import type { Candidate, CandidatesResponse } from "@/lib/schwab/types";
import { formatPct, formatDollars } from "@/lib/format";

const FEES = BROKERAGE_FEES.schwab;
const DEFAULT_TARGET_BORROW = 500_000;

type ConnState = "loading" | "connected" | "disconnected";

export function Calculator() {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const [connState, setConnState] = useState<ConnState>("loading");
  const [targetBorrow, setTargetBorrow] = useState(DEFAULT_TARGET_BORROW);
  const [federalTaxRate, setFederalTaxRate] = useState(DEFAULT_FEDERAL_TAX_RATE);
  const [stateTaxRate, setStateTaxRate] = useState(DEFAULT_STATE_TAX_RATE);

  const [treasuryRates, setTreasuryRates] = useState<TreasuryRates>({});
  const [ratesError, setRatesError] = useState(false);

  const [expirations] = useState(() => generateSpxExpirations(new Date()));
  const [selectedExpiry, setSelectedExpiry] = useState(() => {
    const target = expirations.find((e) => e.dte >= 350) ?? expirations[expirations.length - 1];
    return target?.date ?? expirations[0]?.date ?? "";
  });

  const [chainData, setChainData] = useState<CandidatesResponse | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [chainError, setChainError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // 1) Resolve connection state
  useEffect(() => {
    fetch("/api/schwab/status")
      .then((r) => r.json())
      .then((d) => setConnState(d.connected ? "connected" : "disconnected"))
      .catch(() => setConnState("disconnected"));
  }, []);

  // 2) Treasury fallback rates (always fetched — powers yield curve & disconnected estimates)
  useEffect(() => {
    fetch("/api/rates/treasury")
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data) => {
        if (data.error || Object.keys(data).length === 0) setRatesError(true);
        else setTreasuryRates(data);
      })
      .catch(() => setRatesError(true));
  }, []);

  // 3) Live chain — only when connected, and on changes
  useEffect(() => {
    if (connState !== "connected" || !selectedExpiry || targetBorrow <= 0) return;
    let cancelled = false;
    setChainError(null);
    const params = new URLSearchParams({
      expiration: selectedExpiry,
      target: String(targetBorrow),
    });
    fetch(`/api/schwab/chain?${params}`)
      .then((r) => {
        if (r.status === 401) { setConnState("disconnected"); return null; }
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: CandidatesResponse | null) => {
        if (cancelled || !data) return;
        setChainData(data);
        setSelectedCandidate(data.selected);
      })
      .catch((e) => {
        if (!cancelled) setChainError(String(e));
      });
    return () => { cancelled = true; };
  }, [connState, selectedExpiry, targetBorrow, refreshKey]);

  const selectedExp = expirations.find((e) => e.date === selectedExpiry);
  const dte = selectedExp?.dte ?? 365;

  // Aggregate estimate math (used in disconnected + fallback)
  const clampedFederal = Math.max(0, Math.min(1, federalTaxRate));
  const clampedState = Math.max(0, Math.min(1, stateTaxRate));
  const ltcg = clampedFederal <= 0.24 ? 0.15 : LTCG_RATE_FEDERAL;
  const blendedTax = Math.min(1, calcBlendedTaxRate(ltcg, clampedFederal, clampedState));

  const treasuryYield = interpolateTreasuryYield(dte, treasuryRates);
  const estimatedRate = calcBoxRateSimple(treasuryYield, DEFAULT_SPREAD_BPS);

  // Rate source: live if connected + candidate selected, else Treasury estimate
  const liveRate = selectedCandidate?.rate;
  const displayedRate = liveRate ?? estimatedRate;
  const feeImpact = calcFeeImpact(FEES, selectedCandidate?.contracts ?? 1, Math.max(1, targetBorrow), dte);
  const allInRate = calcAllInRate(displayedRate, feeImpact);
  const afterTaxRate = calcAfterTaxRate(allInRate, blendedTax);

  const interestCost = Math.abs((displayedRate) * targetBorrow * (dte / 365));
  const taxSavings = interestCost * blendedTax;
  const afterTaxCost = interestCost - taxSavings;

  const boxRatesMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const exp of expirations) {
      const ty = interpolateTreasuryYield(exp.dte, treasuryRates);
      map[exp.date] = calcBoxRateSimple(ty, DEFAULT_SPREAD_BPS);
    }
    return map;
  }, [expirations, treasuryRates]);

  const tableRows: ExpirationRow[] = useMemo(() => {
    return expirations.map((exp) => ({
      date: exp.date,
      label: exp.label,
      dte: exp.dte,
      boxRate: boxRatesMap[exp.date] ?? 0,
    }));
  }, [expirations, boxRatesMap]);

  if (!mounted) {
    return (
      <div className="text-center py-20">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Borrow at near-Treasury rates</h1>
        <p className="mt-1 text-sm text-gray-500">SPX box spread optimizer</p>
      </div>
    );
  }

  const isConnected = connState === "connected";

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Borrow at near-Treasury rates</h1>
          <p className="mt-1 text-sm text-gray-500">Schwab-connected SPX box spread optimizer</p>
        </div>
        {isConnected && (
          <ConnectStatus
            connected
            asOf={chainData?.asOf}
            underlyingLast={chainData?.underlying.last}
            onRefresh={() => setRefreshKey((k) => k + 1)}
          />
        )}
      </div>

      {ratesError && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          Using fallback rates — live Treasury data unavailable
        </div>
      )}

      {!isConnected && <ConnectBanner />}

      {chainError && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          Schwab chain unavailable — showing last known candidates. Try the refresh button.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-5">
        <div className="rounded-xl border border-gray-300 bg-white p-5 flex flex-col">
          <div className="flex-1 min-h-[200px]">
            <YieldCurve
              expirations={expirations}
              selectedExpiry={selectedExpiry}
              onSelect={setSelectedExpiry}
              boxRates={boxRatesMap}
            />
          </div>
          <div className="border-t border-gray-200 pt-3 mt-3">
            <ExpirationTable
              rows={tableRows}
              selectedExpiry={selectedExpiry}
              onSelect={setSelectedExpiry}
            />
          </div>
        </div>

        <div className="rounded-xl border border-gray-300 bg-white p-5 space-y-4">
          <TargetBorrowInput value={targetBorrow} onChange={setTargetBorrow} />
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Expiration</span>
            <span className="font-semibold text-gray-900">
              {selectedExp?.label ?? ""} <span className="font-normal text-gray-500">({dte}d)</span>
            </span>
          </div>
          <div className="border-t border-gray-200 pt-3">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-gray-500">Tax rates</div>
            <TaxRateInputs
              federalRate={federalTaxRate}
              stateRate={stateTaxRate}
              onFederalChange={setFederalTaxRate}
              onStateChange={setStateTaxRate}
            />
          </div>
          <div className="border-t border-gray-200 pt-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Pre-tax rate {isConnected ? "" : "(est.)"}</span>
              <span className="text-sm font-semibold tabular-nums text-gray-900">{formatPct(allInRate)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">After-tax effective rate</span>
              <span className="text-base font-bold tabular-nums text-green-600">{formatPct(afterTaxRate)}</span>
            </div>
            <div className="text-[13px] text-gray-700 leading-relaxed pt-2">
              <strong>Borrow {formatDollars(targetBorrow)} today</strong>,
              {" "}total interest over {dte}d is{" "}
              <span className="text-orange-600 font-semibold">{formatDollars(interestCost)}</span>.
              {" "}After-tax cost ≈ <span className="text-green-700 font-bold">{formatDollars(afterTaxCost)}</span>.
              <Tooltip content={`Section 1256: 60% long-term (${formatPct(ltcg)}) + 40% short-term (${formatPct(clampedFederal)}). Tax savings of ${formatDollars(taxSavings)} require sufficient capital gains.`} />
            </div>
          </div>
        </div>
      </div>

      <CandidatesPanel
        state={isConnected ? "connected" : "disconnected"}
        candidates={chainData?.candidates ?? []}
        selected={selectedCandidate}
        onSelect={setSelectedCandidate}
        reason={chainData?.reason}
      />

      {isConnected && selectedCandidate && (
        <div className="rounded-xl border border-gray-300 bg-white p-5 space-y-4">
          <h2 className="text-base font-bold text-gray-900">Your Order — paste into Schwab</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <LegTable
              liveLegs={selectedCandidate.legs}
              expiry={selectedExpiry}
            />
            <OrderParams
              spreadWidth={selectedCandidate.strikeWidth}
              limitPrice={selectedCandidate.boxCredit}
              contracts={selectedCandidate.contracts}
            />
            <FeeBreakdown
              fees={FEES}
              contracts={selectedCandidate.contracts}
              borrowAmount={selectedCandidate.actualBorrow}
              dte={dte}
            />
          </div>
          <div className="border-t border-gray-200 pt-4">
            <BrokerageGuide expiry={selectedExpiry} limitPrice={selectedCandidate.boxCredit} />
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run the app; fix any type errors**

Run:
```bash
pnpm dev
```

Open `http://localhost:3000`. Expect: disconnected state renders with ConnectBanner, empty CandidatesPanel, yield curve + estimate totals panel.

Fix any remaining compile errors (most likely `LegTable` props signature — see Task 20).

- [ ] **Step 3: Commit**

```bash
git add src/components/calculator/Calculator.tsx
git commit -m "feat(calculator): rewire to target-borrow input + live chain + connect states"
```

---

### Task 20: `LegTable` accepts `liveLegs`

**Files:**
- Modify: `src/components/order/LegTable.tsx`

- [ ] **Step 1: Replace the file with a version that accepts `liveLegs` (preferred) with a fallback to `legs`**

Replace `src/components/order/LegTable.tsx` entirely with:

```tsx
// src/components/order/LegTable.tsx
import type { BoxLeg } from "@/lib/types";
import type { CandidateLeg } from "@/lib/schwab/types";

interface LegTableProps {
  legs?: BoxLeg[];             // legacy illustrative legs
  liveLegs?: CandidateLeg[];   // preferred when connected — real bid/ask
  expiry: string;
}

function expiryLabel(expiry: string): string {
  return new Date(expiry + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

export function LegTable({ legs, liveLegs, expiry }: LegTableProps) {
  const label = expiryLabel(expiry);

  if (liveLegs && liveLegs.length > 0) {
    return (
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <div className="grid grid-cols-[40px_1fr_80px_70px_70px] border-b border-gray-100 px-4 py-2.5 text-xs uppercase tracking-wide text-gray-400">
          <div>Leg</div>
          <div>Contract</div>
          <div className="text-center">Action</div>
          <div className="text-right">Bid</div>
          <div className="text-right">Ask</div>
        </div>
        {liveLegs.map((leg, i) => (
          <div
            key={i}
            className="grid grid-cols-[40px_1fr_80px_70px_70px] items-center border-b border-gray-50 px-4 py-3 last:border-b-0"
          >
            <div className={`text-sm font-semibold ${leg.action === "BUY" ? "text-green-600" : "text-red-600"}`}>
              {i + 1}
            </div>
            <div className="text-sm text-gray-700">
              SPX {label} {leg.strike} {leg.type === "CALL" ? "Call" : "Put"}
              <div className="text-[10px] text-gray-400 font-mono">{leg.symbol}</div>
            </div>
            <div className="text-center">
              <span
                className={`rounded px-2.5 py-1 text-xs font-semibold ${
                  leg.action === "BUY"
                    ? "bg-green-50 text-green-600"
                    : "bg-red-50 text-red-600"
                }`}
              >
                {leg.action}
              </span>
            </div>
            <div className="text-right text-sm tabular-nums text-gray-700">{leg.bid.toFixed(2)}</div>
            <div className="text-right text-sm tabular-nums text-gray-700">{leg.ask.toFixed(2)}</div>
          </div>
        ))}
      </div>
    );
  }

  // Legacy fallback — illustrative legs only (disconnected cases won't render the order block,
  // so this path mostly exists for safety / potential future reuse).
  const safeLegs: BoxLeg[] = legs ?? [];
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <div className="grid grid-cols-[40px_1fr_80px_60px_80px] border-b border-gray-100 px-4 py-2.5 text-xs uppercase tracking-wide text-gray-400">
        <div>Leg</div>
        <div>Contract</div>
        <div className="text-center">Action</div>
        <div className="text-center">Type</div>
        <div className="text-center">Strike</div>
      </div>
      {safeLegs.map((leg, i) => (
        <div
          key={i}
          className="grid grid-cols-[40px_1fr_80px_60px_80px] items-center border-b border-gray-50 px-4 py-3 last:border-b-0"
        >
          <div className={`text-sm font-semibold ${leg.action === "buy" ? "text-green-600" : "text-red-600"}`}>
            {i + 1}
          </div>
          <div className="text-sm text-gray-600">
            SPX {label} {leg.strike} {leg.type === "call" ? "Call" : "Put"}
          </div>
          <div className="text-center">
            <span
              className={`rounded px-2.5 py-1 text-xs font-semibold ${
                leg.action === "buy"
                  ? "bg-green-50 text-green-600"
                  : "bg-red-50 text-red-600"
              }`}
            >
              {leg.action.toUpperCase()}
            </span>
          </div>
          <div className="text-center text-sm capitalize text-gray-400">{leg.type}</div>
          <div className="text-center text-sm font-medium text-gray-900">{leg.strike}</div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Run full test suite**

```bash
pnpm test
```

Expect: all tests pass. (Existing tests don't cover LegTable; no regressions expected.)

- [ ] **Step 3: Commit**

```bash
git add src/components/order/LegTable.tsx
git commit -m "feat(order): LegTable accepts liveLegs (real bid/ask) with legacy fallback"
```

---

### Task 21: Strip IBKR/Fidelity from `BrokerageGuide` + remove `BrokerageCTA` wire-up

**Files:**
- Modify: `src/components/order/BrokerageGuide.tsx`

- [ ] **Step 1: Edit `BrokerageGuide.tsx`**

- Remove the `brokerage` prop.
- Keep only the Schwab content branch.
- Props become `{ expiry: string; limitPrice: number }` only.
- Fidelity/IBKR content blocks are deleted.

- [ ] **Step 2: Verify no remaining references**

Run:
```bash
pnpm grep -r "BrokerageCTA" src/ || true
pnpm grep -r 'brokerage="ibkr"' src/ || true
```

Expected: no matches in `Calculator.tsx`. `BrokerageCTA.tsx` file may remain in the tree (unreferenced) — leave it for now.

- [ ] **Step 3: Run tests and dev server to spot-check**

```bash
pnpm test
pnpm dev
```

- [ ] **Step 4: Commit**

```bash
git add src/components/order/BrokerageGuide.tsx
git commit -m "refactor(order): BrokerageGuide → Schwab-only"
```

---

## Phase F — Final polish & smoke test

### Task 22: Env template + README note

**Files:**
- Modify or create: `.env.local.example`
- Modify: `README.md` (optional short section on admin setup)

- [ ] **Step 1: Create or update `.env.local.example`**

```
# Supabase (existing)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# FRED (existing)
FRED_API_KEY=

# Schwab API (new)
SCHWAB_APP_KEY=
SCHWAB_APP_SECRET=
SCHWAB_REFRESH_TOKEN=

# Session cookie signing (new, ≥32 chars)
SESSION_SECRET=

# Admin login key for Phase 1 George access (new)
ADMIN_KEY=
```

- [ ] **Step 2: Commit**

```bash
git add .env.local.example
git commit -m "chore: document Schwab + session env vars"
```

---

### Task 23: Manual smoke test

**Prerequisites:**
- `.env.local` populated with all vars above.
- Supabase migration applied.
- Schwab refresh token obtained via a one-off OAuth script (out of scope here; use the `@sudowealth/schwab-api` README or a small local script).

- [ ] **Step 1: Start dev server**

```bash
pnpm dev
```

- [ ] **Step 2: Disconnected state**

Visit `http://localhost:3000`.

Expect:
- Nav shows disabled "+ Connect Schwab · coming soon" button.
- `ConnectBanner` visible.
- Yield curve + expiration table render with Treasury-estimate rates.
- `CandidatesPanel` shows empty state with Connect CTA.
- Order/BrokerageGuide sections hidden.
- Target-borrow input accepts changes; aggregate pre-tax/after-tax rate + interest cost update from Treasury estimate.

- [ ] **Step 3: Admin login**

Visit `http://localhost:3000/admin?key=<ADMIN_KEY>`.

Expect: "Connecting…" → "Connected. Redirecting…" → bounced to `/`.

- [ ] **Step 4: Connected state**

Back on `/`, expect:
- Nav pill "● Connected · SPX <price> · Ns ago · ↻".
- `ConnectBanner` gone.
- `CandidatesPanel` populated with 1–5 rows for the selected expiration.
- Selecting a candidate updates the order section beneath (real legs with real bid/ask).
- Changing target borrow re-ranks candidates within ~500 ms.
- Refresh button forces a re-fetch.

- [ ] **Step 5: Disconnect**

Run:
```bash
curl -i -X POST http://localhost:3000/api/schwab/disconnect --cookie "boxspreads_session=<paste from devtools>"
```

Reload page — expect disconnected state restored.

- [ ] **Step 6: Commit notes**

No code commit needed — smoke test is manual. If anything failed, file follow-up tasks.

---

## Self-review coverage map

| Spec section                  | Implementing task(s)                   |
| ----------------------------- | --------------------------------------- |
| 1. Product framing            | 19 (Calculator), 17 (ConnectBanner), 16 (ConnectStatus) |
| 2. Architecture — factory     | 6                                       |
| 2. Architecture — Supabase    | 2, 5                                    |
| 2. Architecture — session     | 3                                       |
| 2. Architecture — routes      | 10, 11, 12, 13                          |
| 2. Architecture — admin path  | 12, 14                                  |
| 3. `computeCandidates`        | 8 (+ fixture: 7)                        |
| 3. Chain fetch + 5-min cache  | 9                                       |
| 3. Edge cases                 | 8 (min_credit_exceeds_target, thin_liquidity), 11 (invalid params) |
| 4. UI files — `TargetBorrowInput` | 15                                |
| 4. UI files — `CandidatesPanel`   | 18                                |
| 4. UI files — `ConnectStatus` + slot | 16                             |
| 4. UI files — `ConnectBanner` | 17                                      |
| 4. UI files — Calculator      | 19                                      |
| 4. UI files — LegTable update | 20                                      |
| 4. UI files — BrokerageGuide  | 21                                      |
| 5. Error handling             | 11 (503), 13, 19 (chainError banner)    |
| 5. Testing                    | 3, 5, 6, 8, 9, 10, 11, 12, 13, 15, 16, 18 |
| 5. Non-goals                  | (none — intentional)                    |
| 6. Tunables                   | Constants in `compute-candidates.ts` (Task 8) |
| 7. Implementation order       | This plan follows it                    |

## Notes for the implementer

- The Schwab SDK's exact option-chain request shape (and auth options) may differ slightly between library versions. Task 6 and Task 9 have the expected shape but verify against the `@sudowealth/schwab-api` README when installing; adjust the `createApiClient` options and the `getOptionChain` response normalization accordingly. The behavior contracts are what matter.
- `LegTable.tsx` / `OrderParams.tsx` / `FeeBreakdown.tsx` already exist and have their own prop shapes — the instructions in Task 20 are minimal edits; do not rewrite them wholesale.
- Seeding George's first `SCHWAB_REFRESH_TOKEN` via a Schwab OAuth dance is out of scope of this plan. A small standalone CLI script using `@sudowealth/schwab-api`'s OAuth helpers is the expected path.
- Outside market hours, chain cache TTL should probably be longer — the spec defers this as a tunable; leave it at 5 min for v1 unless you want to add a trivial `isMarketHours()` check.

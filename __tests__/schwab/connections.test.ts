import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the server-only admin Supabase client. The data-access layer was
// migrated to `supabase-admin` so anon-key reads can no longer leak
// refresh tokens (H1).
const mockFrom = vi.fn();
vi.mock("@/lib/supabase-admin", () => ({
  supabaseAdmin: {
    from: (table: string) => mockFrom(table),
  },
}));

// Stub the crypto module so these tests stay focused on data-access
// behavior. Round-trip / wrong-key correctness lives in
// `refresh-token-crypto.test.ts`.
vi.mock("@/lib/schwab/refresh-token-crypto", () => ({
  encryptRefreshToken: (plaintext: string) => ({
    ciphertext: `enc:v1:STUB(${plaintext})`,
    keyVersion: 1,
  }),
  decryptRefreshToken: (value: string) => {
    // Strip the stubbed wrapper if present, otherwise return as-is
    // (legacy plaintext path).
    const m = value.match(/^enc:v1:STUB\((.*)\)$/);
    return m ? m[1] : value;
  },
}));

import {
  upsertConnection,
  findConnection,
  deleteConnection,
  deleteOtherConnections,
  updateRefreshToken,
} from "@/lib/schwab/connections";

describe("schwab connections data-access", () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it("upsertConnection encrypts before writing and includes key_version", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ upsert });
    await upsertConnection("sess-1", "refresh-token-abc");
    expect(mockFrom).toHaveBeenCalledWith("schwab_connections");
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        session_id: "sess-1",
        refresh_token: "enc:v1:STUB(refresh-token-abc)",
        key_version: 1,
      }),
      { onConflict: "session_id" },
    );
  });

  it("updateRefreshToken encrypts and stamps last_refreshed_at", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ update });
    await updateRefreshToken("sess-1", "rotated-token");
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        refresh_token: "enc:v1:STUB(rotated-token)",
        key_version: 1,
        last_refreshed_at: expect.any(String),
      }),
    );
    expect(eq).toHaveBeenCalledWith("session_id", "sess-1");
  });

  it("findConnection decrypts the stored ciphertext before returning", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        session_id: "sess-1",
        refresh_token: "enc:v1:STUB(plaintext-token)",
        key_version: 1,
        connected_at: "2026-04-15T00:00:00Z",
        last_refreshed_at: null,
      },
      error: null,
    });
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle }) }),
    });
    const row = await findConnection("sess-1");
    expect(row?.refresh_token).toBe("plaintext-token");
  });

  it("findConnection passes through legacy plaintext rows unchanged", async () => {
    // Pre-migration rows have no sentinel — they must keep working until
    // the data-migration script encrypts them.
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        session_id: "sess-1",
        refresh_token: "raw-legacy-token",
        key_version: null,
        connected_at: "2026-04-15T00:00:00Z",
        last_refreshed_at: null,
      },
      error: null,
    });
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle }) }),
    });
    const row = await findConnection("sess-1");
    expect(row?.refresh_token).toBe("raw-legacy-token");
  });

  it("findConnection returns null when no row matches", async () => {
    // .maybeSingle() returns data=null with no error when the row is missing
    // (this is its whole reason for being — distinguishes 'no row' from
    // 'RLS denied' by returning a clean null without the PGRST116 sentinel).
    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle }) }),
    });
    const row = await findConnection("missing");
    expect(row).toBeNull();
  });

  it("findConnection throws on real DB errors (e.g. server shutdown)", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "57P03", message: "server shutdown" },
    });
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle }) }),
    });
    await expect(findConnection("sess-1")).rejects.toThrow(/server shutdown/);
  });

  it("deleteConnection calls delete by session_id", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ delete: () => ({ eq }) });
    await deleteConnection("sess-1");
    expect(eq).toHaveBeenCalledWith("session_id", "sess-1");
  });

  it("deleteOtherConnections deletes all rows except the given session_id", async () => {
    const neq = vi.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ delete: () => ({ neq }) });
    await deleteOtherConnections("keep-me");
    expect(mockFrom).toHaveBeenCalledWith("schwab_connections");
    expect(neq).toHaveBeenCalledWith("session_id", "keep-me");
  });
});

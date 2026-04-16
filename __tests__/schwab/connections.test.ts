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
  deleteOtherConnections,
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

  it("findConnection throws on non-PGRST116 errors (real DB failure)", async () => {
    const single = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "57P03", message: "server shutdown" },
    });
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ single }) }),
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

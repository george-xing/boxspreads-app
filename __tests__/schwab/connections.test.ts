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

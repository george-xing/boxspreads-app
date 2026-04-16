import { describe, it, expect, vi, beforeEach } from "vitest";

const mockUpsert = vi.fn();
const mockDeleteOthers = vi.fn();
vi.mock("@/lib/schwab/connections", () => ({
  upsertConnection: (...args: unknown[]) => mockUpsert(...args),
  deleteOtherConnections: (...args: unknown[]) => mockDeleteOthers(...args),
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
    mockDeleteOthers.mockReset();
    mockDeleteOthers.mockResolvedValue(undefined);
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

  it("reaps stale rows after a successful login — keeps only the new session", async () => {
    mockUpsert.mockResolvedValueOnce(undefined);
    await POST(postWith({ key: "correct-horse-battery-staple" }));
    expect(mockDeleteOthers).toHaveBeenCalledTimes(1);
    // The session_id passed to deleteOtherConnections must match the one passed to upsertConnection.
    const upsertSessionId = mockUpsert.mock.calls[0][0];
    const keepSessionId = mockDeleteOthers.mock.calls[0][0];
    expect(keepSessionId).toBe(upsertSessionId);
  });
});

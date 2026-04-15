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
    const { verifySessionCookie } = await import("@/lib/session");
    (verifySessionCookie as ReturnType<typeof vi.fn>).mockReturnValueOnce(null);
    const res = await POST(new Request("http://x/api/schwab/disconnect", { method: "POST" }));
    expect(res.status).toBe(200);
    expect(mockDelete).not.toHaveBeenCalled();
  });
});

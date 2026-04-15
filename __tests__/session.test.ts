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

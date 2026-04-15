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
    throw new Error("SESSION_SECRET env var must be set and \u2265 32 chars");
  }
  return secret;
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;

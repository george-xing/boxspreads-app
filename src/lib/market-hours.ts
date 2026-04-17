/**
 * US equity/options market hours detection — 9:30 AM – 4:00 PM ET,
 * Monday–Friday. Handles DST automatically via the Intl.DateTimeFormat
 * "America/New_York" timezone. Does NOT account for US market holidays
 * (Thanksgiving, Christmas, etc.) — close enough for a display hint.
 */
export function isMarketOpen(now: Date = new Date()): boolean {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value;
  const hour = Number(parts.find((p) => p.type === "hour")?.value);
  const minute = Number(parts.find((p) => p.type === "minute")?.value);

  if (weekday === "Sat" || weekday === "Sun") return false;
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return false;

  const minutes = hour * 60 + minute;
  const open = 9 * 60 + 30;
  const close = 16 * 60;
  return minutes >= open && minutes < close;
}

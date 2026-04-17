"use client";

import { useEffect, useState } from "react";
import { ConnectStatus } from "./ConnectStatus";

export function ConnectStatusSlot() {
  const [connected, setConnected] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    fetch("/api/schwab/status", { signal: controller.signal })
      .then(async (r) => {
        // On 503 (status_unavailable), default to the disabled-connect
        // pill. The Calculator page surfaces the detailed banner — the
        // nav stays visually simple.
        if (!r.ok) return { connected: false };
        return r.json();
      })
      .then((d) => { if (!cancelled) setConnected(Boolean(d.connected)); })
      .catch(() => { if (!cancelled) setConnected(false); });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);
  if (connected === null) return null;
  return <ConnectStatus connected={connected} />;
}

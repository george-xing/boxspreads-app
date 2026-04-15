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
  return <ConnectStatus connected={connected} />;
}

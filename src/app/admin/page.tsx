"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminPage() {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [msg, setMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!key) return;
    setStatus("loading");
    setMsg("");
    try {
      const r = await fetch("/api/schwab/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
        throw new Error(body.error ?? `HTTP ${r.status}`);
      }
      setStatus("ok");
      setTimeout(() => router.replace("/"), 400);
    } catch (err) {
      setStatus("err");
      setMsg(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="mx-auto max-w-sm py-16">
      <h1 className="text-lg font-semibold text-center mb-1">Admin login</h1>
      <p className="text-xs text-gray-500 text-center mb-5">
        Enter admin key to connect George&apos;s Schwab account.
      </p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="password"
          autoComplete="off"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          disabled={status === "loading" || status === "ok"}
          placeholder="Admin key"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-blue-500"
        />
        <button
          type="submit"
          disabled={status === "loading" || status === "ok" || !key}
          className="w-full rounded-md bg-gray-900 text-white px-3 py-2 text-sm font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {status === "loading" ? "Connecting…" : status === "ok" ? "Connected — redirecting" : "Connect"}
        </button>
        {status === "err" && (
          <p className="text-xs text-red-600 text-center">{msg}</p>
        )}
      </form>
    </div>
  );
}

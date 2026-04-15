"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function AdminPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "err">(
    "idle",
  );
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const key = params.get("key");
    if (!key) return;
    setStatus("loading");
    fetch("/api/schwab/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        setStatus("ok");
        setTimeout(() => router.replace("/"), 500);
      })
      .catch((e) => {
        setStatus("err");
        setMsg(String(e));
      });
  }, [params, router]);

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-lg font-semibold">Admin login</h1>
      <p className="mt-2 text-sm text-gray-600">
        {status === "idle" && "Waiting for ?key=… parameter…"}
        {status === "loading" && "Connecting…"}
        {status === "ok" && "Connected. Redirecting…"}
        {status === "err" && `Error: ${msg}`}
      </p>
    </div>
  );
}

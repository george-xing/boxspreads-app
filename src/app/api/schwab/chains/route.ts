import { NextResponse } from "next/server";
import { getSchwabClient } from "@/lib/schwab";
import { computeBoxRates, type RawChain } from "@/lib/boxrate";

function addYears(d: Date, years: number): Date {
  const out = new Date(d);
  out.setUTCFullYear(out.getUTCFullYear() + years);
  return out;
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function fetchChain(from: string, to: string): Promise<RawChain> {
  const schwab = getSchwabClient();
  const res = await schwab.marketData.options.getOptionChain({
    queryParams: {
      symbol: "$SPX",
      contractType: "ALL",
      optionType: "S",
      includeUnderlyingQuote: true,
      fromDate: from,
      toDate: to,
    },
  });
  return res as unknown as RawChain;
}

async function fetchWithRetry(from: string, to: string): Promise<RawChain> {
  try {
    return await fetchChain(from, to);
  } catch (err) {
    const name = (err as Error)?.name ?? "";
    if (name === "SchwabAuthError" || name === "SchwabRateLimitError") throw err;
    await new Promise((r) => setTimeout(r, 250));
    return fetchChain(from, to);
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const today = new Date();
  const from = searchParams.get("from") ?? fmt(today);
  const to = searchParams.get("to") ?? fmt(addYears(today, 2));

  try {
    const chain = await fetchWithRetry(from, to);
    const expirations = computeBoxRates(chain);
    const underlying = chain.underlying?.last ?? chain.underlying?.mark ?? null;
    const stale = chain.underlying?.delayed === true;

    return NextResponse.json(
      { underlying, expirations, stale, fallback: false },
      {
        headers: {
          "Cache-Control":
            "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (err) {
    console.error("Schwab chain fetch failed:", err);
    return NextResponse.json({
      underlying: null,
      expirations: [],
      stale: false,
      fallback: true,
      error: (err as Error).message ?? "unknown",
    });
  }
}

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { TENOR_TO_FRED_SERIES } from "@/lib/constants";

const FRED_BASE_URL = "https://api.stlouisfed.org/fred/series/observations";
const CACHE_MAX_AGE_HOURS = 24;

async function fetchFromFred(
  seriesId: string
): Promise<number | null> {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) return null;

  const url = `${FRED_BASE_URL}?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=5`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) return null;

  const data = await res.json();
  // Walk back past holiday/weekend "." entries to find the most recent real value
  for (const obs of data.observations ?? []) {
    if (obs.value && obs.value !== ".") {
      return parseFloat(obs.value) / 100;
    }
  }
  return null;
}

async function getLatestRates(): Promise<{ rates: Record<string, number>; source: "cache" | "fred" | "empty" }> {
  // Try cache first — get the latest date's rows only
  const { data: latestDate } = await supabase
    .from("treasury_rates")
    .select("date")
    .order("date", { ascending: false })
    .limit(1);

  if (latestDate && latestDate.length > 0) {
    const { data: cached, error: cacheError } = await supabase
      .from("treasury_rates")
      .select("tenor, yield_pct, fetched_at")
      .eq("date", latestDate[0].date);

    if (!cacheError && cached && cached.length > 0) {
      const now = new Date();
      const oldestFetch = cached.reduce((oldest, row) =>
        new Date(row.fetched_at) < oldest ? new Date(row.fetched_at) : oldest,
        new Date(cached[0].fetched_at)
      );
      const cacheValid =
        now.getTime() - oldestFetch.getTime() <
        CACHE_MAX_AGE_HOURS * 3600 * 1000;

      if (cacheValid) {
        const rates: Record<string, number> = {};
        for (const row of cached) {
          rates[row.tenor] = Number(row.yield_pct) / 100;
        }
        // Only use cache if all expected tenors are present
        const expectedTenors = Object.keys(TENOR_TO_FRED_SERIES);
        const hasAllTenors = expectedTenors.every((t) => t in rates);
        if (hasAllTenors) {
          return { rates, source: "cache" };
        }
      }
    }
  }

  // Fetch fresh from FRED
  const rates: Record<string, number> = {};
  const today = new Date().toISOString().split("T")[0];

  for (const [tenor, seriesId] of Object.entries(TENOR_TO_FRED_SERIES)) {
    const yieldVal = await fetchFromFred(seriesId);
    if (yieldVal !== null) {
      rates[tenor] = yieldVal;
      await supabase.from("treasury_rates").upsert(
        {
          date: today,
          tenor,
          yield_pct: yieldVal * 100,
          source: "FRED",
          fetched_at: new Date().toISOString(),
        },
        { onConflict: "date,tenor" }
      );
    }
  }

  if (Object.keys(rates).length === 0) {
    return { rates, source: "empty" };
  }

  return { rates, source: "fred" };
}

export async function GET() {
  try {
    const { rates, source } = await getLatestRates();

    if (source === "empty") {
      return NextResponse.json(
        { error: "No treasury rate data available", rates: {} },
        { status: 503 }
      );
    }

    return NextResponse.json(rates, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("Failed to fetch treasury rates:", error);
    return NextResponse.json(
      { error: "Failed to fetch rates" },
      { status: 500 }
    );
  }
}

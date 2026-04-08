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

  const url = `${FRED_BASE_URL}?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=1`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) return null;

  const data = await res.json();
  const value = data.observations?.[0]?.value;
  if (!value || value === ".") return null;
  return parseFloat(value) / 100;
}

interface TreasuryRateRow {
  tenor: string;
  yield_pct: number;
  fetched_at: string;
}

async function getLatestRates(): Promise<Record<string, number>> {
  const { data: cached } = await supabase
    .from("treasury_rates")
    .select("tenor, yield_pct, fetched_at")
    .order("date", { ascending: false })
    .limit(9);

  const now = new Date();
  const cacheValid =
    cached &&
    cached.length > 0 &&
    now.getTime() - new Date(cached[0].fetched_at).getTime() <
      CACHE_MAX_AGE_HOURS * 3600 * 1000;

  if (cacheValid && cached) {
    const rates: Record<string, number> = {};
    for (const row of cached) {
      rates[row.tenor] = Number(row.yield_pct) / 100;
    }
    return rates;
  }

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

  return rates;
}

export async function GET() {
  try {
    const rates = await getLatestRates();
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

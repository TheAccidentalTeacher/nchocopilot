// API route: GET /api/dashboard — fetches store health data
import { NextResponse } from "next/server";
import { fetchDashboardData } from "@/lib/shopify-queries";

// Cache dashboard data for 5 minutes
let cache: { data: Awaited<ReturnType<typeof fetchDashboardData>>; ts: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

export async function GET() {
  try {
    if (cache && Date.now() - cache.ts < CACHE_TTL) {
      return NextResponse.json(cache.data);
    }

    const data = await fetchDashboardData();
    cache = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (error) {
    console.error("Dashboard fetch error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}

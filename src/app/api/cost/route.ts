// GET /api/cost — Get cost tracking summary

import { NextResponse } from "next/server";
import { getCostSummary } from "@/lib/supabase";

export async function GET() {
  try {
    const summary = await getCostSummary();
    return NextResponse.json(summary);
  } catch (error) {
    console.error("Cost summary error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}

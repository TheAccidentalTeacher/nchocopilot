// API route: GET /api/products — fetches all products from Shopify
import { NextResponse } from "next/server";
import { fetchProducts } from "@/lib/shopify-queries";

let cache: { data: Awaited<ReturnType<typeof fetchProducts>>; ts: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

export async function GET() {
  try {
    if (cache && Date.now() - cache.ts < CACHE_TTL) {
      return NextResponse.json(cache.data);
    }

    const products = await fetchProducts();
    cache = { data: products, ts: Date.now() };
    return NextResponse.json(products);
  } catch (error) {
    console.error("Products fetch error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch products" },
      { status: 500 }
    );
  }
}

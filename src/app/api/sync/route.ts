// POST /api/sync — Force refresh product cache + return updated stats
// Used by the Sync button in the chat UI

import { NextResponse } from "next/server";
import { invalidateProductCache } from "@/lib/chat-tools";
import { fetchProducts, fetchCollections, fetchShopInfo } from "@/lib/shopify-queries";

export async function POST() {
  try {
    // Invalidate the in-memory product cache
    invalidateProductCache();

    // Re-fetch everything
    const [shop, products, collections] = await Promise.all([
      fetchShopInfo(),
      fetchProducts(),
      fetchCollections(),
    ]);

    const total = products.length;
    const withSeo = products.filter(
      (p) => p.seo?.title || p.seo?.description
    ).length;

    return NextResponse.json({
      success: true,
      stats: {
        totalProducts: total,
        withSeo,
        collections: collections.length,
        storeName: shop.name,
      },
    });
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    );
  }
}

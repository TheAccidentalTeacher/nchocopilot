// API route: POST /api/update-product-seo — pushes SEO data back to Shopify
// ⚠️ Requires write_products scope (not yet enabled — see handoff doc)
import { NextResponse } from "next/server";
import { gql } from "@/lib/shopify";

export async function POST(request: Request) {
  try {
    const { productId, seoTitle, seoDescription } = await request.json();

    if (!productId) {
      return NextResponse.json({ error: "Product ID is required" }, { status: 400 });
    }

    const data = await gql<{
      productUpdate: {
        product: { id: string; seo: { title: string; description: string } } | null;
        userErrors: Array<{ field: string[]; message: string }>;
      };
    }>(
      `mutation productUpdate($input: ProductInput!) {
        productUpdate(input: $input) {
          product {
            id
            seo { title description }
          }
          userErrors {
            field
            message
          }
        }
      }`,
      {
        input: {
          id: productId,
          seo: {
            title: seoTitle,
            description: seoDescription,
          },
        },
      }
    );

    if (data.productUpdate.userErrors.length > 0) {
      return NextResponse.json(
        { error: data.productUpdate.userErrors[0].message },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, product: data.productUpdate.product });
  } catch (error) {
    console.error("Product SEO update error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update product SEO" },
      { status: 500 }
    );
  }
}

// POST /api/undo — Undo a single change log entry with freshness check
// Fetches current live value from Shopify before reverting

import { getAuthUser } from "@/lib/auth-helpers";
import { db, logChange, type ChangeLogEntry } from "@/lib/supabase";
import { gql } from "@/lib/shopify";
import { invalidateProductCache } from "@/lib/chat-tools";

const REVERSIBLE_FIELDS = new Set([
  "tags", "seo_title", "seo_description", "description",
  "title", "vendor", "productType", "handle", "compareAtPrice",
]);

interface ProductQueryResult {
  product: {
    id: string;
    title: string;
    handle: string;
    tags: string[];
    vendor: string;
    productType: string;
    descriptionHtml: string;
    seo: { title: string; description: string };
    variants: { edges: Array<{ node: { id: string; compareAtPrice: string | null } }> };
  } | null;
}

async function fetchCurrentProduct(productId: string) {
  const data = await gql<ProductQueryResult>(
    `query product($id: ID!) {
      product(id: $id) {
        id title handle tags vendor productType descriptionHtml
        seo { title description }
        variants(first: 50) { edges { node { id compareAtPrice } } }
      }
    }`,
    { id: productId }
  );
  return data.product;
}

function getCurrentValue(
  product: NonNullable<ProductQueryResult["product"]>,
  field: string
): string | null {
  switch (field) {
    case "tags": return product.tags.join(", ");
    case "seo_title": return product.seo?.title || null;
    case "seo_description": return product.seo?.description || null;
    case "description": return (product.descriptionHtml || "").slice(0, 200);
    case "title": return product.title;
    case "vendor": return product.vendor;
    case "productType": return product.productType;
    case "handle": return product.handle;
    case "compareAtPrice": {
      const first = product.variants?.edges?.[0]?.node;
      return first?.compareAtPrice ? `$${first.compareAtPrice}` : "cleared";
    }
    default: return null;
  }
}

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { changeId, force } = await request.json();
  if (!changeId) {
    return Response.json({ error: "changeId is required" }, { status: 400 });
  }

  // Fetch the change log entry
  const { data: entry, error: fetchError } = await db()
    .from("ncho_change_log")
    .select("*")
    .eq("id", changeId)
    .single<ChangeLogEntry>();

  if (fetchError || !entry) {
    return Response.json({ error: "Change not found" }, { status: 404 });
  }

  if (entry.action === "undo") {
    return Response.json({ error: "Cannot undo an undo" }, { status: 400 });
  }

  if (!REVERSIBLE_FIELDS.has(entry.field)) {
    return Response.json(
      { error: `Field "${entry.field}" is not reversible` },
      { status: 400 }
    );
  }

  if (entry.old_value == null) {
    return Response.json(
      { error: "No old value recorded — cannot undo" },
      { status: 400 }
    );
  }

  // Freshness check — fetch current value from Shopify
  const product = await fetchCurrentProduct(entry.product_id);
  if (!product) {
    return Response.json(
      { error: "Product no longer exists in Shopify" },
      { status: 404 }
    );
  }

  const currentValue = getCurrentValue(product, entry.field);
  const expectedValue = entry.new_value;
  const drifted = currentValue !== expectedValue;

  // If drifted and not forcing, return a conflict for UI to confirm
  if (drifted && !force) {
    return Response.json({
      conflict: true,
      changeId: entry.id,
      field: entry.field,
      product: entry.product_title || entry.product_id,
      expectedValue,
      currentValue,
      restoreValue: entry.old_value,
      message: "This field was modified since this change. Confirm to override.",
    });
  }

  // Execute the undo
  try {
    if (entry.field === "tags") {
      const oldTags = entry.old_value.split(", ").filter(Boolean);
      await gql(
        `mutation productUpdate($input: ProductInput!) {
          productUpdate(input: $input) { product { id } userErrors { message } }
        }`,
        { input: { id: entry.product_id, tags: oldTags } }
      );
    } else if (entry.field === "seo_title" || entry.field === "seo_description") {
      const seoField = entry.field === "seo_title" ? "title" : "description";
      await gql(
        `mutation productUpdate($input: ProductInput!) {
          productUpdate(input: $input) { product { id } userErrors { message } }
        }`,
        { input: { id: entry.product_id, seo: { [seoField]: entry.old_value } } }
      );
    } else if (entry.field === "compareAtPrice") {
      // Restore compare at price on all variants
      const variantEdges = product.variants?.edges || [];
      const restoreValue = entry.old_value.startsWith("$")
        ? entry.old_value.slice(1)
        : entry.old_value === "cleared" ? null : entry.old_value;
      const variantInputs = variantEdges.map((edge) => ({
        id: edge.node.id,
        compareAtPrice: restoreValue,
      }));
      await gql(
        `mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
          productVariantsBulkUpdate(productId: $productId, variants: $variants) {
            productVariants { id compareAtPrice }
            userErrors { field message }
          }
        }`,
        { productId: entry.product_id, variants: variantInputs }
      );
    } else {
      const fieldMap: Record<string, string> = {
        description: "descriptionHtml",
        title: "title",
        vendor: "vendor",
        productType: "productType",
        handle: "handle",
      };
      const shopifyField = fieldMap[entry.field] || entry.field;
      await gql(
        `mutation productUpdate($input: ProductInput!) {
          productUpdate(input: $input) { product { id } userErrors { message } }
        }`,
        { input: { id: entry.product_id, [shopifyField]: entry.old_value } }
      );
    }

    // Log the undo action
    await logChange({
      product_id: entry.product_id,
      product_title: entry.product_title,
      field: entry.field,
      old_value: currentValue,
      new_value: entry.old_value,
      action: "undo",
      source: "ui",
      confidence: null,
    });

    invalidateProductCache();

    return Response.json({
      success: true,
      product: entry.product_title || entry.product_id,
      field: entry.field,
      restoredValue: entry.old_value,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Undo failed" },
      { status: 500 }
    );
  }
}

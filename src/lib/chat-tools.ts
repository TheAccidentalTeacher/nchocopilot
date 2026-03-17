// Claude tool definitions for the NCHO chatbot
// Each tool has a definition (sent to Claude) and an executor (runs server-side)

import type Anthropic from "@anthropic-ai/sdk";
import { fetchProducts, fetchCollections, fetchShopInfo } from "./shopify-queries";
import { gql } from "./shopify";
import { logChange, getRecentChanges, addStoreMemory } from "./supabase";
import type { ShopifyProduct } from "./types";

// ── Tool Definitions (sent to Claude) ──

export const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: "get_store_stats",
    description:
      "Get current store health: total products, SEO coverage, tag coverage, vendor issues, collections count. Use when Anna asks about store status or you need context.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "fetch_products",
    description:
      "Fetch products from the Shopify store. Can filter by various criteria. Returns product details including tags, description, SEO, vendor, productType.",
    input_schema: {
      type: "object" as const,
      properties: {
        filter: {
          type: "string",
          description:
            'Filter type: "all", "no-seo", "no-tags", "vendor-issues", "no-description", "by-tag", "by-vendor", "by-type", "search"',
        },
        value: {
          type: "string",
          description: 'Filter value — required for "by-tag", "by-vendor", "by-type", "search"',
        },
        limit: {
          type: "number",
          description: "Max products to return (default 20)",
        },
      },
      required: [],
    },
  },
  {
    name: "fetch_collections",
    description: "List all collections in the store with product counts.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "tag_product",
    description:
      "Add or remove tags on a Shopify product. Use tag prefixes: Grade: (e.g. Grade:3rd), Age: (e.g. Age:8-10), Book: (e.g. Book:Chapter), Genre: (e.g. Genre:Fiction). Also supports plain tags like GetBooks.",
    input_schema: {
      type: "object" as const,
      properties: {
        productId: {
          type: "string",
          description: "Shopify product GID (e.g. gid://shopify/Product/123)",
        },
        addTags: {
          type: "array",
          items: { type: "string" },
          description: "Tags to add",
        },
        removeTags: {
          type: "array",
          items: { type: "string" },
          description: "Tags to remove",
        },
      },
      required: ["productId"],
    },
  },
  {
    name: "update_product",
    description:
      "Update a product's description, SEO title, SEO description, productType, or vendor. Can update one or multiple fields at once.",
    input_schema: {
      type: "object" as const,
      properties: {
        productId: {
          type: "string",
          description: "Shopify product GID",
        },
        descriptionHtml: {
          type: "string",
          description: "New product description (HTML)",
        },
        seoTitle: {
          type: "string",
          description: "SEO title (under 60 chars)",
        },
        seoDescription: {
          type: "string",
          description: "SEO meta description (under 155 chars)",
        },
        productType: {
          type: "string",
          description: "Product type category",
        },
        vendor: {
          type: "string",
          description: "Product vendor/publisher name",
        },
      },
      required: ["productId"],
    },
  },
  {
    name: "read_change_log",
    description: "Read the history of changes made to the store. Shows what was changed, when, and by what tool.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Number of recent changes to show (default 20)",
        },
      },
      required: [],
    },
  },
  {
    name: "remember",
    description:
      'Save a fact or preference to store memory. Examples: "Anna prefers Ravensburger products in the puzzles collection", "Grade:K maps to Age:5-6". Use this whenever Anna states a preference or makes a curation decision.',
    input_schema: {
      type: "object" as const,
      properties: {
        fact: {
          type: "string",
          description: "The fact or preference to remember",
        },
        category: {
          type: "string",
          description: '"preference", "product", "brand", "taxonomy", or "general"',
        },
      },
      required: ["fact"],
    },
  },
  {
    name: "generate_seo",
    description:
      "Generate an SEO title and meta description for a product using AI. Follows NCHO brand rules (your child, convicted not curious, teacher voice).",
    input_schema: {
      type: "object" as const,
      properties: {
        productId: {
          type: "string",
          description: "Shopify product GID",
        },
        productTitle: {
          type: "string",
          description: "Product title",
        },
        productDescription: {
          type: "string",
          description: "Product description text (plain text)",
        },
        vendor: {
          type: "string",
          description: "Product vendor",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Product tags",
        },
        price: {
          type: "string",
          description: "Product price",
        },
      },
      required: ["productId", "productTitle"],
    },
  },
  {
    name: "classify_product",
    description:
      "Classify a product by grade level, age range, book type, and genre. Uses AI knowledge + product info to determine appropriate tags. Returns recommended tags with confidence levels.",
    input_schema: {
      type: "object" as const,
      properties: {
        productId: {
          type: "string",
          description: "Shopify product GID",
        },
        productTitle: {
          type: "string",
          description: "Product title",
        },
        productDescription: {
          type: "string",
          description: "Product description text",
        },
        vendor: {
          type: "string",
          description: "Product vendor/publisher",
        },
        existingTags: {
          type: "array",
          items: { type: "string" },
          description: "Current tags on the product",
        },
      },
      required: ["productId", "productTitle"],
    },
  },
  {
    name: "search_web",
    description:
      "Search the web for product information when you need more data to classify a product, write a description, or determine age/grade ranges. Use when confidence is below 75% or the product description is insufficient. Returns extracted text from the URL.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description:
            "A search query or direct URL. For products, try: product title + publisher/vendor + 'age range' or 'grade level'. For direct URLs, provide the full URL.",
        },
      },
      required: ["query"],
    },
  },
];

// ── Tool Executors ──

type ToolInput = Record<string, unknown>;

// In-memory product cache for the session
let productCache: ShopifyProduct[] | null = null;
let productCacheTime = 0;
const PRODUCT_CACHE_TTL = 5 * 60 * 1000;

async function getCachedProducts(): Promise<ShopifyProduct[]> {
  if (productCache && Date.now() - productCacheTime < PRODUCT_CACHE_TTL) {
    return productCache;
  }
  productCache = await fetchProducts();
  productCacheTime = Date.now();
  return productCache;
}

export function invalidateProductCache(): void {
  productCache = null;
  productCacheTime = 0;
}

export async function executeTool(
  toolName: string,
  input: ToolInput
): Promise<string> {
  switch (toolName) {
    case "get_store_stats":
      return executeGetStoreStats();
    case "fetch_products":
      return executeFetchProducts(input);
    case "fetch_collections":
      return executeFetchCollections();
    case "tag_product":
      return executeTagProduct(input);
    case "update_product":
      return executeUpdateProduct(input);
    case "read_change_log":
      return executeReadChangeLog(input);
    case "remember":
      return executeRemember(input);
    case "generate_seo":
      return executeGenerateSeo(input);
    case "classify_product":
      return executeClassifyProduct(input);
    case "search_web":
      return executeSearchWeb(input);
    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}

async function executeGetStoreStats(): Promise<string> {
  const products = await getCachedProducts();
  const collections = await fetchCollections();
  const shop = await fetchShopInfo();

  const total = products.length;
  const withSeo = products.filter((p) => p.seo?.title || p.seo?.description).length;
  const withDescription = products.filter((p) => p.descriptionHtml?.trim()).length;
  const vendorIssues = products.filter((p) => p.vendor === "Author Name").length;
  const withGradeTags = products.filter((p) => p.tags.some((t) => t.startsWith("Grade:"))).length;
  const withAgeTags = products.filter((p) => p.tags.some((t) => t.startsWith("Age:"))).length;
  const withBookTags = products.filter((p) => p.tags.some((t) => t.startsWith("Book:"))).length;
  const withGenreTags = products.filter((p) => p.tags.some((t) => t.startsWith("Genre:"))).length;
  const withGetBooks = products.filter((p) => p.tags.includes("GetBooks")).length;

  // Vendor breakdown
  const vendors: Record<string, number> = {};
  for (const p of products) {
    vendors[p.vendor] = (vendors[p.vendor] || 0) + 1;
  }
  const topVendors = Object.entries(vendors)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  return JSON.stringify({
    storeName: shop.name,
    domain: shop.primaryDomain?.host || shop.myshopifyDomain,
    totalProducts: total,
    seo: { complete: withSeo, missing: total - withSeo, pct: Math.round((withSeo / total) * 100) },
    descriptions: { complete: withDescription, missing: total - withDescription },
    vendorIssues,
    tags: {
      grade: withGradeTags,
      age: withAgeTags,
      book: withBookTags,
      genre: withGenreTags,
      getBooks: withGetBooks,
    },
    collections: collections.length,
    topVendors,
  });
}

async function executeFetchProducts(input: ToolInput): Promise<string> {
  const products = await getCachedProducts();
  const filter = (input.filter as string) || "all";
  const value = (input.value as string) || "";
  const limit = (input.limit as number) || 20;

  let filtered: ShopifyProduct[];
  switch (filter) {
    case "no-seo":
      filtered = products.filter((p) => !p.seo?.title && !p.seo?.description);
      break;
    case "no-tags":
      filtered = products.filter((p) => p.tags.length === 0);
      break;
    case "vendor-issues":
      filtered = products.filter((p) => p.vendor === "Author Name");
      break;
    case "no-description":
      filtered = products.filter((p) => !p.descriptionHtml?.trim());
      break;
    case "by-tag":
      filtered = products.filter((p) =>
        p.tags.some((t) => t.toLowerCase().includes(value.toLowerCase()))
      );
      break;
    case "by-vendor":
      filtered = products.filter((p) =>
        p.vendor.toLowerCase().includes(value.toLowerCase())
      );
      break;
    case "by-type":
      filtered = products.filter((p) =>
        p.productType.toLowerCase().includes(value.toLowerCase())
      );
      break;
    case "search":
      filtered = products.filter(
        (p) =>
          p.title.toLowerCase().includes(value.toLowerCase()) ||
          p.vendor.toLowerCase().includes(value.toLowerCase()) ||
          p.tags.some((t) => t.toLowerCase().includes(value.toLowerCase()))
      );
      break;
    default:
      filtered = products;
  }

  const subset = filtered.slice(0, limit);
  return JSON.stringify({
    total: filtered.length,
    showing: subset.length,
    products: subset.map((p) => ({
      id: p.id,
      title: p.title,
      vendor: p.vendor,
      productType: p.productType,
      tags: p.tags,
      hasSeo: !!(p.seo?.title || p.seo?.description),
      hasDescription: !!p.descriptionHtml?.trim(),
      price: p.priceRangeV2?.minVariantPrice?.amount,
      status: p.status,
    })),
  });
}

async function executeFetchCollections(): Promise<string> {
  const collections = await fetchCollections();
  return JSON.stringify(
    collections.map((c) => ({
      id: c.id,
      title: c.title,
      products: c.productsCount?.count ?? 0,
      hasSeo: !!(c.seo?.title || c.seo?.description),
    }))
  );
}

async function executeTagProduct(input: ToolInput): Promise<string> {
  const productId = input.productId as string;
  const addTags = (input.addTags as string[]) || [];
  const removeTags = (input.removeTags as string[]) || [];

  // Get current product to know existing tags
  const products = await getCachedProducts();
  const product = products.find((p) => p.id === productId);
  if (!product) {
    return JSON.stringify({ error: `Product not found: ${productId}` });
  }

  const currentTags = [...product.tags];
  const newTags = [
    ...currentTags.filter((t) => !removeTags.includes(t)),
    ...addTags.filter((t) => !currentTags.includes(t)),
  ];

  const data = await gql<{
    productUpdate: {
      product: { id: string; tags: string[] } | null;
      userErrors: Array<{ field: string[]; message: string }>;
    };
  }>(
    `mutation productUpdate($input: ProductInput!) {
      productUpdate(input: $input) {
        product { id tags }
        userErrors { field message }
      }
    }`,
    { input: { id: productId, tags: newTags } }
  );

  if (data.productUpdate.userErrors.length > 0) {
    return JSON.stringify({ error: data.productUpdate.userErrors[0].message });
  }

  // Log the change
  if (addTags.length > 0) {
    await logChange({
      product_id: productId,
      product_title: product.title,
      field: "tags",
      old_value: currentTags.join(", "),
      new_value: newTags.join(", "),
      action: "add_tag",
      source: "chatbot",
      confidence: null,
    });
  }
  if (removeTags.length > 0) {
    await logChange({
      product_id: productId,
      product_title: product.title,
      field: "tags",
      old_value: currentTags.join(", "),
      new_value: newTags.join(", "),
      action: "remove_tag",
      source: "chatbot",
      confidence: null,
    });
  }

  invalidateProductCache();
  return JSON.stringify({
    success: true,
    product: product.title,
    added: addTags,
    removed: removeTags,
    currentTags: newTags,
  });
}

async function executeUpdateProduct(input: ToolInput): Promise<string> {
  const productId = input.productId as string;

  const products = await getCachedProducts();
  const product = products.find((p) => p.id === productId);
  if (!product) {
    return JSON.stringify({ error: `Product not found: ${productId}` });
  }

  // Build the mutation input
  const mutationInput: Record<string, unknown> = { id: productId };

  if (input.descriptionHtml) mutationInput.descriptionHtml = input.descriptionHtml;
  if (input.productType) mutationInput.productType = input.productType;
  if (input.vendor) mutationInput.vendor = input.vendor;
  if (input.seoTitle || input.seoDescription) {
    mutationInput.seo = {
      title: (input.seoTitle as string) || product.seo?.title || "",
      description: (input.seoDescription as string) || product.seo?.description || "",
    };
  }

  const data = await gql<{
    productUpdate: {
      product: { id: string; title: string } | null;
      userErrors: Array<{ field: string[]; message: string }>;
    };
  }>(
    `mutation productUpdate($input: ProductInput!) {
      productUpdate(input: $input) {
        product { id title }
        userErrors { field message }
      }
    }`,
    { input: mutationInput }
  );

  if (data.productUpdate.userErrors.length > 0) {
    return JSON.stringify({ error: data.productUpdate.userErrors[0].message });
  }

  // Log each changed field
  const fieldsChanged: string[] = [];
  if (input.descriptionHtml) {
    fieldsChanged.push("description");
    await logChange({
      product_id: productId,
      product_title: product.title,
      field: "description",
      old_value: product.descriptionHtml?.slice(0, 200) || null,
      new_value: (input.descriptionHtml as string).slice(0, 200),
      action: "update_description",
      source: "chatbot",
      confidence: null,
    });
  }
  if (input.seoTitle) {
    fieldsChanged.push("seoTitle");
    await logChange({
      product_id: productId,
      product_title: product.title,
      field: "seo_title",
      old_value: product.seo?.title || null,
      new_value: input.seoTitle as string,
      action: "set_seo",
      source: "chatbot",
      confidence: null,
    });
  }
  if (input.seoDescription) {
    fieldsChanged.push("seoDescription");
    await logChange({
      product_id: productId,
      product_title: product.title,
      field: "seo_description",
      old_value: product.seo?.description || null,
      new_value: input.seoDescription as string,
      action: "set_seo",
      source: "chatbot",
      confidence: null,
    });
  }
  if (input.productType) {
    fieldsChanged.push("productType");
    await logChange({
      product_id: productId,
      product_title: product.title,
      field: "productType",
      old_value: product.productType || null,
      new_value: input.productType as string,
      action: "set_product_type",
      source: "chatbot",
      confidence: null,
    });
  }
  if (input.vendor) {
    fieldsChanged.push("vendor");
    await logChange({
      product_id: productId,
      product_title: product.title,
      field: "vendor",
      old_value: product.vendor,
      new_value: input.vendor as string,
      action: "update_vendor",
      source: "chatbot",
      confidence: null,
    });
  }

  invalidateProductCache();
  return JSON.stringify({
    success: true,
    product: product.title,
    fieldsChanged,
  });
}

async function executeReadChangeLog(input: ToolInput): Promise<string> {
  const limit = (input.limit as number) || 20;
  const changes = await getRecentChanges(limit);
  return JSON.stringify(changes);
}

async function executeRemember(input: ToolInput): Promise<string> {
  const fact = input.fact as string;
  const category = (input.category as string) || "general";
  await addStoreMemory(fact, category, "manual");
  return JSON.stringify({ success: true, fact, category });
}

async function executeGenerateSeo(input: ToolInput): Promise<string> {
  // This returns the data for the chatbot to review — the actual SEO text
  // is crafted by the chatbot itself using brand rules in its system prompt
  const products = await getCachedProducts();
  const product = products.find((p) => p.id === input.productId);
  if (!product) {
    return JSON.stringify({ error: `Product not found: ${input.productId}` });
  }

  return JSON.stringify({
    id: product.id,
    title: product.title,
    description: product.descriptionHtml?.replace(/<[^>]*>/g, "").slice(0, 500),
    vendor: product.vendor,
    tags: product.tags,
    price: product.priceRangeV2?.minVariantPrice?.amount,
    currentSeo: product.seo,
    instruction:
      "Generate an SEO title (under 60 chars) and meta description (under 155 chars) following NCHO brand rules. Then call update_product to save them.",
  });
}

async function executeClassifyProduct(input: ToolInput): Promise<string> {
  // Return product data for the chatbot to classify using its own reasoning
  const products = await getCachedProducts();
  const product = products.find((p) => p.id === input.productId);
  if (!product) {
    return JSON.stringify({ error: `Product not found: ${input.productId}` });
  }

  return JSON.stringify({
    id: product.id,
    title: product.title,
    description: product.descriptionHtml?.replace(/<[^>]*>/g, "").slice(0, 800),
    vendor: product.vendor,
    existingTags: product.tags,
    productType: product.productType,
    instruction:
      "Based on the product title, description, and vendor, determine appropriate classification tags. Use these categories: Grade: (PreK, K, 1st-12th), Age: (ranges like 3-5, 5-7, 8-10, 10-12, 12+), Book: (Board, Picture, Early Reader, Chapter, Middle Grade, Young Adult, Classics, Reference, Workbook), Genre: (Fiction, Nonfiction, and specific genres if clear). Return your recommendations with confidence levels. Then call tag_product to apply them.",
  });
}

async function executeSearchWeb(input: ToolInput): Promise<string> {
  const query = (input.query as string) || "";
  if (!query) {
    return JSON.stringify({ error: "Query is required" });
  }

  // If it looks like a URL, fetch it directly
  if (query.startsWith("http://") || query.startsWith("https://")) {
    try {
      const resp = await fetch(query, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; NCHOTools/1.0)",
          Accept: "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(10000),
      });
      if (!resp.ok) {
        return JSON.stringify({ error: `HTTP ${resp.status} from ${query}` });
      }
      const html = await resp.text();
      // Strip HTML tags, scripts, styles — extract readable text
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 4000);
      return JSON.stringify({
        source: query,
        type: "url_fetch",
        text,
      });
    } catch (err) {
      return JSON.stringify({
        error: `Failed to fetch URL: ${err instanceof Error ? err.message : "unknown"}`,
      });
    }
  }

  // Otherwise, use DuckDuckGo instant answer API (no API key needed)
  try {
    const encoded = encodeURIComponent(query);
    const resp = await fetch(
      `https://api.duckduckgo.com/?q=${encoded}&format=json&no_html=1&skip_disambig=1`,
      {
        headers: { "User-Agent": "NCHOTools/1.0" },
        signal: AbortSignal.timeout(10000),
      }
    );
    if (!resp.ok) {
      return JSON.stringify({ error: `DuckDuckGo returned HTTP ${resp.status}` });
    }
    const data = await resp.json();

    // Collect all useful info from DDG response
    const results: string[] = [];
    if (data.Abstract) results.push(`Abstract: ${data.Abstract}`);
    if (data.AbstractSource) results.push(`Source: ${data.AbstractSource}`);
    if (data.AbstractURL) results.push(`URL: ${data.AbstractURL}`);
    if (data.Answer) results.push(`Answer: ${data.Answer}`);
    if (data.Definition) results.push(`Definition: ${data.Definition}`);
    if (data.RelatedTopics) {
      for (const topic of data.RelatedTopics.slice(0, 5)) {
        if (topic.Text) results.push(`- ${topic.Text}`);
        if (topic.Topics) {
          for (const sub of topic.Topics.slice(0, 3)) {
            if (sub.Text) results.push(`  - ${sub.Text}`);
          }
        }
      }
    }

    if (results.length === 0) {
      // DDG instant answer had no results — try a direct Amazon lookup
      const amazonUrl = `https://www.amazon.com/s?k=${encoded}`;
      return JSON.stringify({
        source: "duckduckgo",
        type: "no_instant_answer",
        suggestion: `No instant answer found. Try calling search_web with a direct URL like "${amazonUrl}" or a publisher website URL to get product details.`,
      });
    }

    return JSON.stringify({
      source: "duckduckgo",
      type: "instant_answer",
      query,
      results: results.join("\n"),
    });
  } catch (err) {
    return JSON.stringify({
      error: `Web search failed: ${err instanceof Error ? err.message : "unknown"}`,
    });
  }
}

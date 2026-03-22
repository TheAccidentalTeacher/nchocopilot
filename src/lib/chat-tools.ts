// Claude tool definitions for the NCHO chatbot
// Each tool has a definition (sent to Claude) and an executor (runs server-side)

import type Anthropic from "@anthropic-ai/sdk";
import { fetchProducts, fetchCollections, fetchShopInfo, fetchBlogs } from "./shopify-queries";
import { gql } from "./shopify";
import { logChange, getRecentChanges, addStoreMemory } from "./supabase";
import type { ShopifyProduct } from "./types";

// Rich tool result type — supports returning images alongside text for Claude vision
export type RichToolResult = {
  type: "rich";
  content: Array<
    | { type: "text"; text: string }
    | {
        type: "image";
        source: {
          type: "base64";
          media_type:
            | "image/jpeg"
            | "image/png"
            | "image/gif"
            | "image/webp";
          data: string;
        };
      }
  >;
  summary: string;
};
export type ToolExecutionResult = string | RichToolResult;

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
            'Filter type: "all", "no-seo", "no-tags", "vendor-issues", "no-description", "no-category", "no-metafields", "by-tag", "by-vendor", "by-type", "search"',
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
      "Update a product's title, description, SEO title, SEO description, productType, or vendor. Can update one or multiple fields at once.",
    input_schema: {
      type: "object" as const,
      properties: {
        productId: {
          type: "string",
          description: "Shopify product GID",
        },
        title: {
          type: "string",
          description: "New product title",
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
        category: {
          type: "string",
          description: "Shopify Standard Product Category GID. Known GIDs: Print Books = gid://shopify/TaxonomyCategory/me-1-3, Board Games = gid://shopify/TaxonomyCategory/tg-2-5, Jigsaw Puzzles = gid://shopify/TaxonomyCategory/tg-4-7, Science Kits = gid://shopify/TaxonomyCategory/tg-5-9-6, Educational Toys = gid://shopify/TaxonomyCategory/tg-5-9, Card Games = gid://shopify/TaxonomyCategory/tg-2-7, Craft Kits = gid://shopify/TaxonomyCategory/tg-5-2-3, Flash Cards = gid://shopify/TaxonomyCategory/tg-5-9-4",
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
  {
    name: "publish_blog",
    description:
      "Publish a blog article to the Shopify store. Write the post in NCHO brand voice (warm, teacher-curated, 'your child' not 'your student'). Include SEO title and meta description.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: {
          type: "string",
          description: "Blog post title",
        },
        body: {
          type: "string",
          description: "Blog post body in HTML format",
        },
        excerpt: {
          type: "string",
          description: "Short excerpt/summary (1-2 sentences)",
        },
        seoTitle: {
          type: "string",
          description: "SEO title (under 60 chars)",
        },
        seoDescription: {
          type: "string",
          description: "SEO meta description (under 155 chars)",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Tags for the blog post",
        },
      },
      required: ["title", "body"],
    },
  },
  {
    name: "update_metafields",
    description:
      "Read or write metafield values on a Shopify product. Known custom metafields (namespace: custom): collapsible_headline_1 (Included/Details), collapsible_headline_2_author_brand (Author/Brand), collapsible_text_1, collapsible_text_2. All are single_line_text_field type. Can also write any future metafields Anna creates — just use the correct namespace and key.",
    input_schema: {
      type: "object" as const,
      properties: {
        productId: {
          type: "string",
          description: "Shopify product GID",
        },
        metafields: {
          type: "array",
          description: "Array of metafields to write",
          items: {
            type: "object" as const,
            properties: {
              namespace: {
                type: "string",
                description: "Metafield namespace (usually 'custom' for Anna's fields)",
              },
              key: {
                type: "string",
                description: "Metafield key (e.g. 'collapsible_headline_1', 'collapsible_text_2')",
              },
              value: {
                type: "string",
                description: "Value to write",
              },
              type: {
                type: "string",
                description: "Metafield type (default: 'single_line_text_field')",
              },
            },
            required: ["namespace", "key", "value"],
          },
        },
      },
      required: ["productId", "metafields"],
    },
  },
  {
    name: "create_collection",
    description:
      "Create a new Shopify collection. Smart collections use rules to auto-include matching products (e.g. by tag, vendor, product type, title, inventory). Manual collections have no rules — products are added separately. Common rule columns: TAG, TITLE, TYPE, VENDOR, VARIANT_PRICE, VARIANT_INVENTORY, VARIANT_WEIGHT. Common relations: EQUALS, NOT_EQUALS, GREATER_THAN, LESS_THAN, STARTS_WITH, ENDS_WITH, CONTAINS, NOT_CONTAINS, IS_SET, IS_NOT_SET.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: {
          type: "string",
          description: "Collection title",
        },
        descriptionHtml: {
          type: "string",
          description: "Collection description (HTML)",
        },
        rules: {
          type: "array",
          description:
            "Smart collection rules. If provided, creates a smart (automated) collection. Each rule has column, relation, condition.",
          items: {
            type: "object" as const,
            properties: {
              column: {
                type: "string",
                description:
                  "Rule column: TAG, TITLE, TYPE, VENDOR, VARIANT_PRICE, VARIANT_INVENTORY, etc.",
              },
              relation: {
                type: "string",
                description:
                  "Rule relation: EQUALS, NOT_EQUALS, GREATER_THAN, LESS_THAN, CONTAINS, NOT_CONTAINS, STARTS_WITH, ENDS_WITH, IS_SET, IS_NOT_SET",
              },
              condition: {
                type: "string",
                description: "Rule condition value (e.g. tag name, vendor name, price threshold)",
              },
            },
            required: ["column", "relation", "condition"],
          },
        },
        disjunctive: {
          type: "boolean",
          description:
            "For smart collections: true = product matches ANY rule (OR), false = product must match ALL rules (AND). Default: false.",
        },
        sortOrder: {
          type: "string",
          description:
            "Sort order: ALPHA_ASC, ALPHA_DESC, BEST_SELLING, CREATED, CREATED_DESC, MANUAL, PRICE_ASC, PRICE_DESC. Default: BEST_SELLING.",
        },
        seoTitle: {
          type: "string",
          description: "SEO title for the collection (under 60 chars)",
        },
        seoDescription: {
          type: "string",
          description: "SEO meta description for the collection (under 155 chars)",
        },
      },
      required: ["title"],
    },
  },
  {
    name: "create_metafield_definition",
    description:
      "Create a metafield definition at the store level so it appears as a named field in Shopify Admin for all products (or collections, etc). This makes the metafield visible and editable in Shopify's admin UI. Use this BEFORE writing values with update_metafields if the field doesn't exist yet.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "Display name shown in Shopify Admin (e.g. 'Product Information')",
        },
        namespace: {
          type: "string",
          description: "Metafield namespace (usually 'custom')",
        },
        key: {
          type: "string",
          description: "Metafield key (e.g. 'product_information'). Must be unique within namespace+ownerType.",
        },
        type: {
          type: "string",
          description:
            "Metafield type: single_line_text_field, multi_line_text_field, rich_text_field, number_integer, number_decimal, boolean, url, date, json, color, etc.",
        },
        ownerType: {
          type: "string",
          description: "Owner type: PRODUCT, COLLECTION, CUSTOMER, ORDER, SHOP. Default: PRODUCT.",
        },
        description: {
          type: "string",
          description: "Optional description shown in Shopify Admin under the field name.",
        },
        pin: {
          type: "boolean",
          description: "If true, pins the metafield so it shows prominently in Shopify Admin. Default: true.",
        },
      },
      required: ["name", "namespace", "key", "type"],
    },
  },
  {
    name: "undo_changes",
    description:
      "Undo recent changes made to Shopify products. Reverses tag additions/removals, SEO updates, description changes, vendor/type changes — anything logged in the change log. Can undo a specific number of recent changes or all changes to a specific product. Always confirm with the user before undoing.",
    input_schema: {
      type: "object" as const,
      properties: {
        productId: {
          type: "string",
          description: "If provided, only undo changes for this specific product (Shopify GID). Otherwise undoes the most recent changes across all products.",
        },
        count: {
          type: "number",
          description: "Number of recent changes to undo (default: 1). Changes are undone newest-first.",
        },
      },
      required: [],
    },
  },
  {
    name: "generate_description",
    description:
      "Generate an accurate product description by analyzing the product's actual Shopify images using AI vision. Downloads the product image so you can SEE the puzzle artwork, game box, kit contents — instead of guessing from the title. Returns the image + product data for you to write a description following Product Description Rules, then call update_product to save it.",
    input_schema: {
      type: "object" as const,
      properties: {
        productId: {
          type: "string",
          description: "Shopify product GID",
        },
      },
      required: ["productId"],
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
): Promise<ToolExecutionResult> {
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
    case "publish_blog":
      return executePublishBlog(input);
    case "update_metafields":
      return executeUpdateMetafields(input);
    case "create_collection":
      return executeCreateCollection(input);
    case "create_metafield_definition":
      return executeCreateMetafieldDefinition(input);
    case "undo_changes":
      return executeUndoChanges(input);
    case "generate_description":
      return executeGenerateDescription(input);
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
    case "no-category":
      filtered = products.filter((p) => !p.category);
      break;
    case "no-metafields":
      filtered = products.filter((p) => {
        const mfs = p.metafields?.edges?.map((e) => e.node) || [];
        const customMfs = mfs.filter((m) => m.namespace === "custom");
        return customMfs.length === 0;
      });
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
    products: subset.map((p) => {
      const mfs = p.metafields?.edges?.map((e) => e.node) || [];
      return {
        id: p.id,
        title: p.title,
        vendor: p.vendor,
        productType: p.productType,
        category: p.category?.fullName || null,
        tags: p.tags,
        hasSeo: !!(p.seo?.title || p.seo?.description),
        hasDescription: !!p.descriptionHtml?.trim(),
        price: p.priceRangeV2?.minVariantPrice?.amount,
        status: p.status,
        metafields: mfs.length > 0
          ? Object.fromEntries(mfs.map((m) => [`${m.namespace}.${m.key}`, m.value]))
          : null,
      };
    }),
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

  if (!data.productUpdate) {
    return JSON.stringify({ error: "Shopify rejected the update — check that write_products scope is enabled" });
  }
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

  if (input.title) mutationInput.title = input.title;
  if (input.descriptionHtml) mutationInput.descriptionHtml = input.descriptionHtml;
  if (input.productType) mutationInput.productType = input.productType;
  if (input.vendor) mutationInput.vendor = input.vendor;
  if (input.category) mutationInput.category = input.category;
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

  if (!data.productUpdate) {
    return JSON.stringify({ error: "Shopify rejected the update — check that write_products scope is enabled" });
  }
  if (data.productUpdate.userErrors.length > 0) {
    return JSON.stringify({ error: data.productUpdate.userErrors[0].message });
  }

  // Log each changed field
  const fieldsChanged: string[] = [];
  if (input.title) {
    fieldsChanged.push("title");
    await logChange({
      product_id: productId,
      product_title: product.title,
      field: "title",
      old_value: product.title,
      new_value: input.title as string,
      action: "update_title",
      source: "chatbot",
      confidence: null,
    });
  }
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
  if (input.category) {
    fieldsChanged.push("category");
    await logChange({
      product_id: productId,
      product_title: product.title,
      field: "category",
      old_value: product.category?.fullName || null,
      new_value: input.category as string,
      action: "set_category",
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

async function executePublishBlog(input: ToolInput): Promise<string> {
  const title = input.title as string;
  const body = input.body as string;
  const excerpt = (input.excerpt as string) || "";
  const seoTitle = (input.seoTitle as string) || title;
  const seoDescription = (input.seoDescription as string) || excerpt;
  const tags = (input.tags as string[]) || [];

  if (!title || !body) {
    return JSON.stringify({ error: "Title and body are required" });
  }

  // Get the first blog
  const blogs = await fetchBlogs();
  if (blogs.length === 0) {
    return JSON.stringify({ error: "No blog found in Shopify store" });
  }
  const blogId = blogs[0].id;

  const data = await gql<{
    articleCreate: {
      article: { id: string; title: string; handle: string } | null;
      userErrors: Array<{ field: string[]; message: string }>;
    };
  }>(
    `mutation articleCreate($article: ArticleCreateInput!) {
      articleCreate(article: $article) {
        article { id title handle }
        userErrors { field message }
      }
    }`,
    {
      article: {
        blogId,
        title,
        body,
        summary: excerpt || undefined,
        tags,
        seo: { title: seoTitle, description: seoDescription },
        isPublished: true,
        author: { name: "Next Chapter Homeschool Outpost" },
      },
    }
  );

  if (!data.articleCreate) {
    return JSON.stringify({ error: "Shopify rejected the article — check that write_content scope is enabled" });
  }
  if (data.articleCreate.userErrors.length > 0) {
    return JSON.stringify({ error: data.articleCreate.userErrors[0].message });
  }

  return JSON.stringify({
    success: true,
    article: data.articleCreate.article,
    message: `Published "${title}" to the store blog.`,
  });
}

async function executeUpdateMetafields(input: ToolInput): Promise<string> {
  const productId = input.productId as string;
  const metafields = input.metafields as Array<{
    namespace: string;
    key: string;
    value: string;
    type?: string;
  }>;

  if (!metafields || metafields.length === 0) {
    return JSON.stringify({ error: "No metafields provided" });
  }

  const products = await getCachedProducts();
  const product = products.find((p) => p.id === productId);
  if (!product) {
    return JSON.stringify({ error: `Product not found: ${productId}` });
  }

  // Get current metafield values for logging
  const currentMfs = product.metafields?.edges?.map((e) => e.node) || [];

  const data = await gql<{
    productUpdate: {
      product: {
        id: string;
        metafields: {
          edges: Array<{ node: { namespace: string; key: string; value: string } }>;
        };
      } | null;
      userErrors: Array<{ field: string[]; message: string }>;
    };
  }>(
    `mutation productUpdate($input: ProductInput!) {
      productUpdate(input: $input) {
        product {
          id
          metafields(first: 20) {
            edges { node { namespace key value } }
          }
        }
        userErrors { field message }
      }
    }`,
    {
      input: {
        id: productId,
        metafields: metafields.map((m) => ({
          namespace: m.namespace,
          key: m.key,
          value: m.value,
          type: m.type || "single_line_text_field",
        })),
      },
    }
  );

  if (!data.productUpdate) {
    return JSON.stringify({ error: "Shopify rejected the update — check that write_products scope is enabled" });
  }
  if (data.productUpdate.userErrors.length > 0) {
    return JSON.stringify({ error: data.productUpdate.userErrors[0].message });
  }

  // Log each metafield change
  for (const mf of metafields) {
    const oldMf = currentMfs.find((m) => m.namespace === mf.namespace && m.key === mf.key);
    await logChange({
      product_id: productId,
      product_title: product.title,
      field: `metafield:${mf.namespace}.${mf.key}`,
      old_value: oldMf?.value || null,
      new_value: mf.value,
      action: "set_metafield",
      source: "chatbot",
      confidence: null,
    });
  }

  invalidateProductCache();

  const updatedMfs = data.productUpdate.product?.metafields?.edges?.map((e) => e.node) || [];
  return JSON.stringify({
    success: true,
    product: product.title,
    metafieldsWritten: metafields.map((m) => `${m.namespace}.${m.key}`),
    currentMetafields: Object.fromEntries(updatedMfs.map((m) => [`${m.namespace}.${m.key}`, m.value])),
  });
}

async function executeCreateCollection(input: ToolInput): Promise<string> {
  const title = input.title as string;
  const descriptionHtml = (input.descriptionHtml as string) || "";
  const rules = (input.rules as Array<{ column: string; relation: string; condition: string }>) || [];
  const disjunctive = (input.disjunctive as boolean) ?? false;
  const sortOrder = (input.sortOrder as string) || "BEST_SELLING";
  const seoTitle = input.seoTitle as string | undefined;
  const seoDescription = input.seoDescription as string | undefined;

  const collectionInput: Record<string, unknown> = {
    title,
    descriptionHtml,
    sortOrder,
  };

  if (rules.length > 0) {
    collectionInput.ruleSet = {
      appliedDisjunctively: disjunctive,
      rules: rules.map((r) => ({
        column: r.column,
        relation: r.relation,
        condition: r.condition,
      })),
    };
  }

  if (seoTitle || seoDescription) {
    collectionInput.seo = {
      ...(seoTitle ? { title: seoTitle } : {}),
      ...(seoDescription ? { description: seoDescription } : {}),
    };
  }

  const data = await gql<{
    collectionCreate: {
      collection: {
        id: string;
        title: string;
        handle: string;
        productsCount: { count: number };
        ruleSet: {
          appliedDisjunctively: boolean;
          rules: Array<{ column: string; relation: string; condition: string }>;
        } | null;
      } | null;
      userErrors: Array<{ field: string[]; message: string }>;
    };
  }>(
    `mutation collectionCreate($input: CollectionInput!) {
      collectionCreate(input: $input) {
        collection {
          id
          title
          handle
          productsCount { count }
          ruleSet {
            appliedDisjunctively
            rules { column relation condition }
          }
        }
        userErrors { field message }
      }
    }`,
    { input: collectionInput }
  );

  if (!data.collectionCreate) {
    return JSON.stringify({
      error: "Shopify rejected the request — check that write_products scope is enabled",
    });
  }
  if (data.collectionCreate.userErrors.length > 0) {
    return JSON.stringify({ error: data.collectionCreate.userErrors[0].message });
  }

  const collection = data.collectionCreate.collection!;

  await logChange({
    product_id: collection.id,
    product_title: collection.title,
    field: "collection",
    old_value: null,
    new_value: JSON.stringify({
      handle: collection.handle,
      type: rules.length > 0 ? "smart" : "manual",
      rules: rules.length > 0 ? rules : undefined,
    }),
    action: "create_collection",
    source: "chatbot",
    confidence: null,
  });

  return JSON.stringify({
    success: true,
    collection: {
      id: collection.id,
      title: collection.title,
      handle: collection.handle,
      type: rules.length > 0 ? "smart" : "manual",
      productsCount: collection.productsCount?.count ?? 0,
      rules: collection.ruleSet?.rules || [],
      url: `https://next-chapter-homeschool.myshopify.com/collections/${collection.handle}`,
    },
  });
}

async function executeCreateMetafieldDefinition(input: ToolInput): Promise<string> {
  const name = input.name as string;
  const namespace = input.namespace as string;
  const key = input.key as string;
  const type = input.type as string;
  const ownerType = (input.ownerType as string) || "PRODUCT";
  const description = (input.description as string) || "";
  const pin = (input.pin as boolean) ?? true;

  const data = await gql<{
    metafieldDefinitionCreate: {
      createdDefinition: {
        id: string;
        name: string;
        namespace: string;
        key: string;
        type: { name: string };
      } | null;
      userErrors: Array<{ field: string[]; message: string; code: string }>;
    };
  }>(
    `mutation metafieldDefinitionCreate($definition: MetafieldDefinitionInput!) {
      metafieldDefinitionCreate(definition: $definition) {
        createdDefinition {
          id
          name
          namespace
          key
          type { name }
        }
        userErrors { field message code }
      }
    }`,
    {
      definition: {
        name,
        namespace,
        key,
        type,
        ownerType,
        ...(description ? { description } : {}),
        ...(pin ? { pin: true } : {}),
      },
    }
  );

  if (!data.metafieldDefinitionCreate) {
    return JSON.stringify({
      error: "Shopify rejected the request — check that write_metafield_definitions scope is enabled",
    });
  }
  if (data.metafieldDefinitionCreate.userErrors.length > 0) {
    const err = data.metafieldDefinitionCreate.userErrors[0];
    if (err.code === "TAKEN") {
      return JSON.stringify({
        success: true,
        alreadyExists: true,
        message: `Metafield definition ${namespace}.${key} already exists for ${ownerType}. You can write values to it with update_metafields.`,
      });
    }
    return JSON.stringify({ error: err.message });
  }

  const def = data.metafieldDefinitionCreate.createdDefinition!;

  await logChange({
    product_id: "store",
    product_title: name,
    field: "metafield_definition",
    old_value: null,
    new_value: JSON.stringify({
      namespace,
      key,
      type,
      ownerType,
    }),
    action: "create_metafield_definition",
    source: "chatbot",
    confidence: null,
  });

  return JSON.stringify({
    success: true,
    definition: {
      id: def.id,
      name: def.name,
      namespace: def.namespace,
      key: def.key,
      type: def.type.name,
      ownerType,
    },
  });
}

// ── Undo Changes ──

async function executeUndoChanges(input: ToolInput): Promise<string> {
  const targetProductId = input.productId as string | undefined;
  const count = Math.min(Math.max((input.count as number) || 1, 1), 20);

  // Fetch recent changes (more than needed, then filter)
  const allChanges = await getRecentChanges(50);

  // Filter by product if specified, exclude non-reversible actions
  const REVERSIBLE_FIELDS = new Set(["tags", "seo_title", "seo_description", "description", "title", "vendor", "productType", "category"]);
  const REVERSIBLE_ACTIONS = new Set(["add_tag", "remove_tag", "set_seo_title", "set_seo_description", "set_description", "set_title", "set_vendor", "set_productType", "set_category", "update_seo", "update_description", "update_title", "update_vendor", "update_productType"]);

  const candidates = allChanges.filter((c) => {
    if (targetProductId && c.product_id !== targetProductId) return false;
    if (c.action === "create_metafield_definition" || c.action === "create_collection" || c.action === "publish_blog" || c.action === "undo") return false;
    if (!c.old_value && !REVERSIBLE_FIELDS.has(c.field)) return false;
    return true;
  });

  if (candidates.length === 0) {
    return JSON.stringify({
      success: false,
      message: targetProductId
        ? "No reversible changes found for that product."
        : "No reversible changes found in the recent change log.",
    });
  }

  const toUndo = candidates.slice(0, count);
  const results: Array<{ product: string; field: string; result: string }> = [];

  // Group changes by product to batch
  for (const change of toUndo) {
    try {
      if (change.field === "tags" && change.old_value != null) {
        // Restore old tags entirely
        const oldTags = change.old_value.split(", ").filter(Boolean);
        await gql<{
          productUpdate: {
            product: { id: string } | null;
            userErrors: Array<{ message: string }>;
          };
        }>(
          `mutation productUpdate($input: ProductInput!) {
            productUpdate(input: $input) {
              product { id }
              userErrors { field message }
            }
          }`,
          { input: { id: change.product_id, tags: oldTags } }
        );

        await logChange({
          product_id: change.product_id,
          product_title: change.product_title,
          field: "tags",
          old_value: change.new_value,
          new_value: change.old_value,
          action: "undo",
          source: "chatbot",
          confidence: null,
        });

        invalidateProductCache();
        results.push({ product: change.product_title || change.product_id, field: "tags", result: "restored" });
      } else if (change.field === "seo_title" || change.field === "seo_description") {
        // Restore SEO field
        const seoField = change.field === "seo_title" ? "title" : "description";
        await gql<{
          productUpdate: {
            product: { id: string } | null;
            userErrors: Array<{ message: string }>;
          };
        }>(
          `mutation productUpdate($input: ProductInput!) {
            productUpdate(input: $input) {
              product { id }
              userErrors { field message }
            }
          }`,
          { input: { id: change.product_id, seo: { [seoField]: change.old_value || "" } } }
        );

        await logChange({
          product_id: change.product_id,
          product_title: change.product_title,
          field: change.field,
          old_value: change.new_value,
          new_value: change.old_value,
          action: "undo",
          source: "chatbot",
          confidence: null,
        });

        invalidateProductCache();
        results.push({ product: change.product_title || change.product_id, field: change.field, result: "restored" });
      } else if (["description", "title", "vendor", "productType"].includes(change.field)) {
        // Restore a simple field
        const fieldMap: Record<string, string> = {
          description: "descriptionHtml",
          title: "title",
          vendor: "vendor",
          productType: "productType",
        };
        const shopifyField = fieldMap[change.field] || change.field;

        await gql<{
          productUpdate: {
            product: { id: string } | null;
            userErrors: Array<{ message: string }>;
          };
        }>(
          `mutation productUpdate($input: ProductInput!) {
            productUpdate(input: $input) {
              product { id }
              userErrors { field message }
            }
          }`,
          { input: { id: change.product_id, [shopifyField]: change.old_value || "" } }
        );

        await logChange({
          product_id: change.product_id,
          product_title: change.product_title,
          field: change.field,
          old_value: change.new_value,
          new_value: change.old_value,
          action: "undo",
          source: "chatbot",
          confidence: null,
        });

        invalidateProductCache();
        results.push({ product: change.product_title || change.product_id, field: change.field, result: "restored" });
      } else {
        results.push({ product: change.product_title || change.product_id, field: change.field, result: "skipped — not reversible" });
      }
    } catch (err) {
      results.push({
        product: change.product_title || change.product_id,
        field: change.field,
        result: `failed: ${err instanceof Error ? err.message : "unknown error"}`,
      });
    }
  }

  return JSON.stringify({
    success: true,
    undone: results.length,
    details: results,
  });
}

// ── Generate Description (with Vision) ──

async function executeGenerateDescription(
  input: ToolInput
): Promise<ToolExecutionResult> {
  const products = await getCachedProducts();
  const product = products.find((p) => p.id === input.productId);
  if (!product) {
    return JSON.stringify({ error: `Product not found: ${input.productId}` });
  }

  const images = product.images?.edges?.map((e) => e.node) || [];

  const metadata = {
    id: product.id,
    title: product.title,
    vendor: product.vendor,
    productType: product.productType,
    tags: product.tags,
    price: product.priceRangeV2?.minVariantPrice?.amount,
    existingDescription:
      product.descriptionHtml?.replace(/<[^>]*>/g, "").slice(0, 500) || null,
    imageCount: images.length,
  };

  if (images.length === 0) {
    return JSON.stringify({
      ...metadata,
      instruction:
        "⚠️ NO PRODUCT IMAGES FOUND. Write a description from title/metadata only, but prepend [NEEDS REVIEW: no product image available — description based on title only]. Then call update_product with descriptionHtml to save it.",
    });
  }

  // Download the first image for vision analysis (resize to 1024px for efficiency)
  const rawUrl = images[0].url;
  const imageUrl = rawUrl.includes("?")
    ? `${rawUrl}&width=1024`
    : `${rawUrl}?width=1024`;

  try {
    const response = await fetch(imageUrl, {
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");

    // Map Content-Type to Anthropic-allowed media types
    const ct = response.headers.get("content-type") || "image/jpeg";
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
    ] as const;
    const mediaType = allowedTypes.find((t) => ct.includes(t)) || "image/jpeg";

    const textPayload = JSON.stringify({
      ...metadata,
      imageAltText: images[0].altText || null,
      instruction:
        "LOOK AT THE ATTACHED IMAGE. Write an accurate HTML product description based on what you ACTUALLY SEE in this image. Follow the Product Description Rules in your system prompt. Then call update_product with the descriptionHtml to save it to Shopify.",
    });

    return {
      type: "rich",
      content: [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: mediaType,
            data: base64,
          },
        },
        {
          type: "text",
          text: textPayload,
        },
      ],
      summary: textPayload,
    };
  } catch (err) {
    return JSON.stringify({
      ...metadata,
      instruction: `⚠️ COULD NOT DOWNLOAD PRODUCT IMAGE (${err instanceof Error ? err.message : "unknown error"}). Write a description from title/metadata only, but prepend [NEEDS REVIEW: image download failed — description based on title only]. Then call update_product with descriptionHtml to save it.`,
    });
  }
}

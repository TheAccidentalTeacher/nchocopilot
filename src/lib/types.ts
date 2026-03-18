// Shared types for Shopify data

export interface ShopInfo {
  name: string;
  email: string;
  myshopifyDomain: string;
  url: string;
  plan: { displayName: string; partnerDevelopment: boolean };
  currencyCode: string;
  primaryDomain: { host: string; sslEnabled: boolean };
}

export interface ShopifyProduct {
  id: string;
  title: string;
  handle: string;
  status: string;
  vendor: string;
  productType: string;
  category?: { id: string; name: string; fullName: string } | null;
  tags: string[];
  descriptionHtml: string;
  totalInventory: number;
  priceRangeV2: {
    minVariantPrice: { amount: string; currencyCode: string };
    maxVariantPrice: { amount: string; currencyCode: string };
  };
  variants: {
    edges: Array<{
      node: {
        id: string;
        title: string;
        price: string;
        compareAtPrice: string | null;
        sku: string;
        barcode: string;
        inventoryQuantity: number;
        selectedOptions: Array<{ name: string; value: string }>;
      };
    }>;
  };
  images: {
    edges: Array<{
      node: { url: string; altText: string | null; width: number; height: number };
    }>;
  };
  seo: { title: string | null; description: string | null };
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

export interface ShopifyCollection {
  id: string;
  title: string;
  handle: string;
  descriptionHtml: string;
  sortOrder: string;
  productsCount: { count: number };
  image: { url: string; altText: string | null } | null;
  seo: { title: string | null; description: string | null };
}

export interface ShopifyBlog {
  id: string;
  title: string;
  handle: string;
  articles: Array<{
    id: string;
    title: string;
    handle: string;
    body: string;
    tags: string[];
    author: { name: string };
    image: { url: string; altText: string | null } | null;
    publishedAt: string | null;
    createdAt: string;
  }>;
}

export interface ShopifyPage {
  id: string;
  title: string;
  handle: string;
  body: string;
  bodySummary: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

export interface ShopifyPolicy {
  body: string;
  type: string;
  url: string;
}

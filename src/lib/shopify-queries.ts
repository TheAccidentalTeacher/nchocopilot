// Shopify data-fetching functions — mirrors the Python audit queries

import { gql, paginateGql, restGet } from "./shopify";
import type {
  ShopifyProduct,
  ShopifyCollection,
  ShopifyBlog,
  ShopifyPage,
  ShopifyPolicy,
  ShopInfo,
} from "./types";

export async function fetchShopInfo(): Promise<ShopInfo> {
  const data = await gql<{ shop: ShopInfo }>(`{
    shop {
      name email myshopifyDomain url
      plan { displayName partnerDevelopment }
      currencyCode
      primaryDomain { host sslEnabled }
    }
  }`);
  return data.shop;
}

export async function fetchProducts(): Promise<ShopifyProduct[]> {
  return paginateGql<ShopifyProduct>(
    `{
      products(first: 50__AFTER__) {
        edges {
          cursor
          node {
            id title handle status vendor productType
            category { id name fullName }
            tags descriptionHtml
            totalInventory
            priceRangeV2 {
              minVariantPrice { amount currencyCode }
              maxVariantPrice { amount currencyCode }
            }
            variants(first: 20) {
              edges {
                node {
                  id title price compareAtPrice sku barcode
                  inventoryQuantity
                  selectedOptions { name value }
                }
              }
            }
            images(first: 5) {
              edges { node { url altText width height } }
            }
            seo { title description }
            metafields(first: 20) {
              edges { node { namespace key value type } }
            }
            createdAt updatedAt publishedAt
          }
        }
        pageInfo { hasNextPage }
      }
    }`,
    "products"
  );
}

export async function fetchCollections(): Promise<ShopifyCollection[]> {
  return paginateGql<ShopifyCollection>(
    `{
      collections(first: 50__AFTER__) {
        edges {
          cursor
          node {
            id title handle descriptionHtml
            sortOrder
            productsCount { count }
            image { url altText }
            seo { title description }
          }
        }
        pageInfo { hasNextPage }
      }
    }`,
    "collections"
  );
}

export async function fetchBlogs(): Promise<ShopifyBlog[]> {
  const data = await gql<{
    blogs: {
      edges: Array<{
        node: ShopifyBlog & {
          articles: { edges: Array<{ node: ShopifyBlog["articles"][number] }> };
        };
      }>;
    };
  }>(`{
    blogs(first: 10) {
      edges {
        node {
          id title handle
          articles(first: 50) {
            edges {
              node {
                id title handle body tags
                author { name }
                image { url altText }
                publishedAt createdAt
              }
            }
          }
        }
      }
    }
  }`);

  return data.blogs.edges.map((e) => ({
    ...e.node,
    articles: e.node.articles.edges.map((a) => a.node),
  }));
}

export async function fetchPages(): Promise<ShopifyPage[]> {
  const data = await gql<{
    pages: { edges: Array<{ node: ShopifyPage }> };
  }>(`{
    pages(first: 50) {
      edges {
        node {
          id title handle body bodySummary
          createdAt updatedAt publishedAt
        }
      }
    }
  }`);
  return data.pages.edges.map((e) => e.node);
}

export async function fetchPolicies(): Promise<ShopifyPolicy[]> {
  try {
    const data = await restGet<{ policies: Array<{ body: string; title: string; url: string }> }>(
      "/policies.json"
    );
    return (data.policies ?? []).map((p) => ({
      body: p.body,
      type: p.title,
      url: p.url,
    }));
  } catch {
    // Policies endpoint may not be available — don't break dashboard
    return [];
  }
}

export interface DashboardData {
  shop: ShopInfo;
  products: ShopifyProduct[];
  collections: ShopifyCollection[];
  blogs: ShopifyBlog[];
  pages: ShopifyPage[];
  policies: ShopifyPolicy[];
}

export async function fetchDashboardData(): Promise<DashboardData> {
  const [shop, products, collections, blogs, pages, policies] =
    await Promise.all([
      fetchShopInfo(),
      fetchProducts(),
      fetchCollections(),
      fetchBlogs(),
      fetchPages(),
      fetchPolicies(),
    ]);
  return { shop, products, collections, blogs, pages, policies };
}

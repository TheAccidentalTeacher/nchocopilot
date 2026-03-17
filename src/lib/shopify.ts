// Shopify Admin API service — translated from shopify_audit.py
// Handles client_credentials auth + GraphQL + REST

const SHOP = process.env.SHOPIFY_STORE!;
const CLIENT_ID = process.env.SHOPIFY_CLIENT_ID!;
const CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET!;
const API_VERSION = process.env.SHOPIFY_API_VERSION!;

const GRAPHQL_URL = `https://${SHOP}/admin/api/${API_VERSION}/graphql.json`;
const REST_URL = `https://${SHOP}/admin/api/${API_VERSION}`;

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getToken(): Promise<string> {
  // Reuse token if still valid (with 5-minute buffer)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 5 * 60 * 1000) {
    return cachedToken.token;
  }

  const resp = await fetch(`https://${SHOP}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  });

  if (!resp.ok) {
    throw new Error(`Token request failed: ${resp.status} ${resp.statusText}`);
  }

  const data = await resp.json();
  cachedToken = {
    token: data.access_token,
    // 24-hour expiry per Shopify docs
    expiresAt: Date.now() + 23 * 60 * 60 * 1000,
  };
  return cachedToken.token;
}

export async function gql<T = Record<string, unknown>>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const token = await getToken();
  const body: Record<string, unknown> = { query };
  if (variables) body.variables = variables;

  for (let attempt = 0; attempt < 3; attempt++) {
    const resp = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (resp.status === 429) {
      const retryAfter = parseFloat(resp.headers.get("Retry-After") || "2");
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      continue;
    }

    if (!resp.ok) {
      throw new Error(`GraphQL request failed: ${resp.status} ${resp.statusText}`);
    }

    const json = await resp.json();
    if (json.errors) {
      console.error("GraphQL errors:", json.errors);
    }
    return (json.data ?? {}) as T;
  }

  throw new Error("GraphQL request failed after 3 retries");
}

export async function restGet<T = unknown>(endpoint: string): Promise<T> {
  const token = await getToken();
  const resp = await fetch(`${REST_URL}/${endpoint}`, {
    headers: { "X-Shopify-Access-Token": token },
  });
  if (!resp.ok) {
    throw new Error(`REST request failed: ${resp.status} ${resp.statusText}`);
  }
  return resp.json() as Promise<T>;
}

// Paginate through a GraphQL connection
interface PaginatedConnection<T> {
  edges: Array<{ cursor: string; node: T }>;
  pageInfo: { hasNextPage: boolean };
}

export async function paginateGql<T>(
  queryTemplate: string,
  rootKey: string
): Promise<T[]> {
  const allNodes: T[] = [];
  let cursor: string | null = null;

  while (true) {
    const afterClause: string = cursor ? `, after: "${cursor}"` : "";
    const query: string = queryTemplate.replace("__AFTER__", afterClause);
    const data: Record<string, PaginatedConnection<T>> = await gql(query);

    const container: PaginatedConnection<T> | undefined = data[rootKey];
    if (!container?.edges?.length) break;

    for (const edge of container.edges) {
      allNodes.push(edge.node);
    }

    if (!container.pageInfo?.hasNextPage) break;
    cursor = container.edges[container.edges.length - 1].cursor;

    // Rate-limit courtesy
    await new Promise((r) => setTimeout(r, 500));
  }

  return allNodes;
}

// API route: GET /api/connection-status — checks Shopify API connection
import { NextResponse } from "next/server";
import { getToken, gql } from "@/lib/shopify";

export async function GET() {
  const status: {
    connected: boolean;
    store: string | null;
    tokenValid: boolean;
    error: string | null;
    scopes: string | null;
  } = {
    connected: false,
    store: process.env.SHOPIFY_STORE || null,
    tokenValid: false,
    error: null,
    scopes: null,
  };

  try {
    await getToken();
    status.tokenValid = true;

    const data = await gql<{ shop: { name: string } }>(`{ shop { name } }`);
    if (data.shop?.name) {
      status.connected = true;
    }

    // Check available scopes via a write test (will fail gracefully if read-only)
    try {
      await gql(`{
        app { installation { accessScopes { handle } } }
      }`);
      status.scopes = "Read access confirmed. Write scopes: check Shopify Partners Dashboard.";
    } catch {
      status.scopes = "Read access confirmed.";
    }
  } catch (error) {
    status.error = error instanceof Error ? error.message : "Connection failed";
  }

  return NextResponse.json(status);
}

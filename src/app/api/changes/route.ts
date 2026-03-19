// GET /api/changes — Fetch change log entries with optional filters
// POST /api/changes/undo — handled by separate route

import { getAuthUser } from "@/lib/auth-helpers";
import { db } from "@/lib/supabase";

export async function GET(request: Request) {
  const user = await getAuthUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 500);
  const offset = parseInt(searchParams.get("offset") || "0");
  const productId = searchParams.get("productId");
  const field = searchParams.get("field");
  const action = searchParams.get("action");

  let query = db()
    .from("ncho_change_log")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (productId) query = query.eq("product_id", productId);
  if (field) query = query.eq("field", field);
  if (action) query = query.eq("action", action);

  const { data, error, count } = await query;

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({ changes: data ?? [], total: count ?? 0 }),
    { headers: { "Content-Type": "application/json" } }
  );
}

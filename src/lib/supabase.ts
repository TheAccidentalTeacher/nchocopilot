// Supabase client for NCHO Tools persistent storage
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

function db(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.NCHO_SUPABASE_URL;
  const key = process.env.NCHO_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase not configured. Set NCHO_SUPABASE_URL and NCHO_SUPABASE_SERVICE_ROLE_KEY in .env.local"
    );
  }
  _client = createClient(url, key);
  return _client;
}

// ── Chat Threads ──

export interface ChatThread {
  id: string;
  title: string;
  messages: ChatMessage[];
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  tool_calls?: ToolCallRecord[];
  timestamp: string;
}

export interface ToolCallRecord {
  tool: string;
  input: Record<string, unknown>;
  result: string;
}

export async function getThreads(): Promise<ChatThread[]> {
  const { data, error } = await db()
    .from("ncho_chat_threads")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getThread(id: string): Promise<ChatThread | null> {
  const { data, error } = await db()
    .from("ncho_chat_threads")
    .select("*")
    .eq("id", id)
    .single();
  if (error && error.code !== "PGRST116") throw error;
  return data;
}

export async function createThread(title?: string): Promise<ChatThread> {
  const { data, error } = await db()
    .from("ncho_chat_threads")
    .insert({ title: title || "New Chat", messages: [] })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateThreadMessages(
  id: string,
  messages: ChatMessage[]
): Promise<void> {
  const { error } = await db()
    .from("ncho_chat_threads")
    .update({ messages, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function updateThreadTitle(
  id: string,
  title: string
): Promise<void> {
  const { error } = await db()
    .from("ncho_chat_threads")
    .update({ title })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteThread(id: string): Promise<void> {
  const { error } = await db()
    .from("ncho_chat_threads")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ── Store Memory ──

export interface StoreMemory {
  id: string;
  fact: string;
  category: string;
  source: string;
  created_at: string;
}

export async function getStoreMemories(): Promise<StoreMemory[]> {
  const { data, error } = await db()
    .from("ncho_store_memory")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function addStoreMemory(
  fact: string,
  category: string = "general",
  source: string = "auto"
): Promise<void> {
  const { error } = await db()
    .from("ncho_store_memory")
    .insert({ fact, category, source });
  if (error) throw error;
}

// ── Change Log ──

export interface ChangeLogEntry {
  id: string;
  product_id: string;
  product_title: string | null;
  field: string;
  old_value: string | null;
  new_value: string | null;
  action: string;
  source: string;
  confidence: number | null;
  created_at: string;
}

export async function logChange(entry: Omit<ChangeLogEntry, "id" | "created_at">): Promise<void> {
  const { error } = await db()
    .from("ncho_change_log")
    .insert(entry);
  if (error) throw error;
}

export async function getRecentChanges(limit: number = 20): Promise<ChangeLogEntry[]> {
  const { data, error } = await db()
    .from("ncho_change_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

// ── Cost Tracking ──

export async function trackCost(
  inputTokens: number,
  outputTokens: number,
  operation: string,
  model: string = "claude-sonnet-4-6"
): Promise<void> {
  // Sonnet 4.6: $3/MTok input, $15/MTok output
  const rates: Record<string, { input: number; output: number }> = {
    "claude-sonnet-4-6": { input: 3, output: 15 },
    "claude-haiku-4-5": { input: 1, output: 5 },
  };
  const rate = rates[model] ?? rates["claude-sonnet-4-6"];
  const costUsd =
    (inputTokens * rate.input) / 1_000_000 +
    (outputTokens * rate.output) / 1_000_000;

  const { error } = await db().from("ncho_cost_tracking").insert({
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    model,
    operation,
    cost_usd: costUsd,
  });
  if (error) throw error;
}

export async function getCostSummary(): Promise<{
  today: number;
  thisMonth: number;
  allTime: number;
}> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { data, error } = await db()
    .from("ncho_cost_tracking")
    .select("cost_usd, created_at");
  if (error) throw error;

  let today = 0;
  let thisMonth = 0;
  let allTime = 0;
  for (const row of data ?? []) {
    allTime += row.cost_usd ?? 0;
    if (row.created_at >= startOfMonth) thisMonth += row.cost_usd ?? 0;
    if (row.created_at >= startOfDay) today += row.cost_usd ?? 0;
  }

  return { today, thisMonth, allTime };
}

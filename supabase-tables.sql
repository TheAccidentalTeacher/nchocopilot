-- NCHO Tools v2 — Supabase tables
-- Run this in the Supabase SQL Editor for the shared Chapterhouse instance
-- All tables prefixed with ncho_ to avoid conflicts

-- Chat threads (persistent conversation history)
CREATE TABLE IF NOT EXISTS ncho_chat_threads (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title       TEXT DEFAULT 'New Chat',
  messages    JSONB DEFAULT '[]'::jsonb,
  pinned      BOOLEAN DEFAULT false,
  user_id     UUID,  -- Supabase Auth user ID (Scott or Anna)
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Store memory (auto-learned facts about products, preferences, decisions)
CREATE TABLE IF NOT EXISTS ncho_store_memory (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fact        TEXT NOT NULL,
  category    TEXT DEFAULT 'general',  -- 'preference', 'product', 'brand', 'taxonomy', 'general'
  source      TEXT DEFAULT 'auto',     -- 'auto' (extracted from chat), 'manual' (/remember command)
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Change log (before/after log of every Shopify write)
CREATE TABLE IF NOT EXISTS ncho_change_log (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id    TEXT NOT NULL,
  product_title TEXT,
  field         TEXT NOT NULL,
  old_value     TEXT,
  new_value     TEXT,
  action        TEXT NOT NULL,
  source        TEXT DEFAULT 'chatbot',
  confidence    REAL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Cost tracking (token usage per API call)
CREATE TABLE IF NOT EXISTS ncho_cost_tracking (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  input_tokens    INTEGER NOT NULL DEFAULT 0,
  output_tokens   INTEGER NOT NULL DEFAULT 0,
  model           TEXT DEFAULT 'claude-sonnet-4-6',
  operation       TEXT,  -- 'chat', 'seo', 'blog', 'tagging', 'extract-learnings'
  cost_usd        REAL,  -- self-calculated: input * $3/MTok + output * $15/MTok
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Flagged products (AI couldn't confidently classify)
CREATE TABLE IF NOT EXISTS ncho_flagged_products (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id    TEXT NOT NULL,
  product_title TEXT,
  reason        TEXT NOT NULL,
  confidence    REAL,
  resolved      BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ncho_change_log_product ON ncho_change_log(product_id);
CREATE INDEX IF NOT EXISTS idx_ncho_change_log_created ON ncho_change_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ncho_store_memory_category ON ncho_store_memory(category);
CREATE INDEX IF NOT EXISTS idx_ncho_cost_tracking_created ON ncho_cost_tracking(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ncho_chat_threads_updated ON ncho_chat_threads(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ncho_chat_threads_user ON ncho_chat_threads(user_id);

-- Migration: Add user_id to existing ncho_chat_threads table
-- Run this if the table already exists:
-- ALTER TABLE ncho_chat_threads ADD COLUMN IF NOT EXISTS user_id UUID;
-- CREATE INDEX IF NOT EXISTS idx_ncho_chat_threads_user ON ncho_chat_threads(user_id);

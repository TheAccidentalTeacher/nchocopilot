# NCHO Tools — Complete Technical Documentation

> **App:** NCHO Tools v2  
> **Purpose:** AI-powered Shopify store management for Next Chapter Homeschool Outpost  
> **Live URL:** https://nchocopilot.vercel.app  
> **GitHub:** https://github.com/TheAccidentalTeacher/nchocopilot  
> **Owners:** Scott & Anna Somers — private tool, not customer-facing  
> **Created:** March 17, 2026  
> **Last Updated:** March 17, 2026

---

## Table of Contents

1. [What This App Does](#1-what-this-app-does)
2. [Tech Stack](#2-tech-stack)
3. [Architecture Overview](#3-architecture-overview)
4. [Environment Variables](#4-environment-variables)
5. [File-by-File Reference](#5-file-by-file-reference)
6. [API Routes](#6-api-routes)
7. [Pages & UI](#7-pages--ui)
8. [The AI Chatbot (v2 Core Feature)](#8-the-ai-chatbot-v2-core-feature)
9. [Supabase Database](#9-supabase-database)
10. [Shopify Integration](#10-shopify-integration)
11. [Brand Rules (Enforced in Code)](#11-brand-rules-enforced-in-code)
12. [What's Done](#12-whats-done)
13. [What Still Needs to Be Done](#13-what-still-needs-to-be-done)
14. [How to Run Locally](#14-how-to-run-locally)
15. [How to Deploy](#15-how-to-deploy)
16. [Troubleshooting](#16-troubleshooting)

---

## 1. What This App Does

NCHO Tools is a private management dashboard for the **Next Chapter Homeschool Outpost** Shopify store. It gives Scott and Anna a single interface to:

- **See store health at a glance** — product count, SEO coverage, vendor issues, blog articles
- **Generate AI-powered SEO** titles and meta descriptions for every product, following NCHO brand voice
- **Generate blog posts** with AI — topic in, full branded blog post out
- **View and push store policies** — shipping, returns, privacy, about us, FAQ (all pre-written)
- **Chat with an AI store assistant** that can read, classify, tag, and edit products directly in Shopify
- **Auto-learn preferences** — the chatbot remembers Anna's decisions and applies them going forward
- **Track every change** — full before/after audit log of every modification
- **Track AI costs** — token usage and dollar cost per operation

The v1 (dashboard, products, blog, policies, settings) provides structured page-based tools. The v2 chatbot provides conversational, agentic access to the same capabilities — plus memory, classification, bulk tagging, and preference learning.

---

## 2. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 16.1.7 |
| Language | TypeScript | ^5 |
| UI | Tailwind CSS | ^4 |
| React | React | 19.2.3 |
| AI | Anthropic SDK (@anthropic-ai/sdk) | ^0.79.0 |
| AI Model | Claude Sonnet 4.6 | `claude-sonnet-4-6` |
| Database | Supabase (PostgreSQL) | @supabase/supabase-js ^2.99.2 |
| Shopify API | Admin API (GraphQL + REST) | 2026-01 |
| Shopify Auth | Client credentials grant | 24hr token auto-refresh |
| Hosting | Vercel | Pro plan |
| Fonts | Geist Sans + Geist Mono | Google Fonts |

**No other runtime dependencies.** The entire app runs on 4 npm packages (next, react, react-dom, @anthropic-ai/sdk, @supabase/supabase-js) plus dev tooling (tailwind, typescript, eslint).

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     BROWSER (Anna)                          │
│                                                             │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ ┌────────┐ ┌──────┐ │
│  │Dashboard │ │Products  │ │Blog    │ │Policies│ │Settings│ │
│  └────┬─────┘ └────┬─────┘ └───┬────┘ └───┬────┘ └──┬───┘ │
│       │             │           │          │         │      │
│  ┌────┴─────────────┴───────────┴──────────┴─────────┴───┐  │
│  │              Chat Panel (💬 bottom-right)              │  │
│  │  Thread sidebar │ Streaming messages │ Tool indicators │  │
│  └────────────────────────────┬───────────────────────────┘  │
└───────────────────────────────┼──────────────────────────────┘
                                │ SSE Stream
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                    NEXT.JS SERVER (Vercel)                   │
│                                                             │
│  API Routes:                                                │
│  /api/dashboard ──────── fetchDashboardData() ──┐           │
│  /api/products ───────── fetchProducts()        │           │
│  /api/generate-seo ───── Claude + brand rules   │           │
│  /api/generate-blog ──── Claude + brand rules   │           │
│  /api/update-product-seo ─ GraphQL mutation      ├──→ Shopify│
│  /api/connection-status ── token + scope check  │   Admin   │
│  /api/sync ───────────── invalidate + re-fetch ─┘   API    │
│                                                             │
│  /api/chat ──── Claude tool_use loop (up to 10 iterations)  │
│       │            │ Uses 9 tools that call Shopify + Supabase│
│       │            ▼                                         │
│  /api/extract-learnings ── auto-save facts from conversations│
│  /api/threads ──── CRUD on chat threads                      │
│  /api/threads/[id] ── GET/PATCH/DELETE single thread         │
│  /api/cost ──── cost tracking summary                        │
│                                                             │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                    SUPABASE (PostgreSQL)                     │
│                 AI Tutor instance — us-west-2                │
│            doezjenqywwabmaugpnb.supabase.co                 │
│                                                             │
│  Tables:                                                    │
│  ncho_chat_threads ────── conversation history (JSONB)      │
│  ncho_store_memory ────── auto-learned facts + preferences  │
│  ncho_change_log ──────── before/after audit trail          │
│  ncho_cost_tracking ───── token usage + USD per operation   │
│  ncho_flagged_products ── AI-uncertain classifications      │
└─────────────────────────────────────────────────────────────┘
```

**Key architectural patterns:**

- **Lazy Supabase initialization** — The Supabase client is created on first use via a `db()` function, not at module import time. This prevents build failures when env vars are empty (Next.js evaluates imports during static analysis).
- **In-memory product cache** — Products are cached for 5 minutes in the `chat-tools.ts` module to avoid re-fetching from Shopify on every chatbot tool call. Cache is invalidated after any write operation.
- **SSE streaming** — The chat API uses Server-Sent Events to stream text tokens, tool activity indicators, and tool results back to the browser in real-time.
- **Agentic tool loop** — Claude can call tools, observe results, and decide to call more tools — up to 10 iterations per message. This allows multi-step operations like "classify this product → generate tags → apply tags → confirm."
- **Fire-and-forget learning** — After every conversation, the extract-learnings endpoint is called asynchronously to mine facts from the conversation and store them in memory.

---

## 4. Environment Variables

All defined in `.env.local` (git-ignored). Must also be set in Vercel.

| Variable | Purpose | Example |
|---|---|---|
| `SHOPIFY_STORE` | Shopify store domain | `next-chapter-homeschool.myshopify.com` |
| `SHOPIFY_CLIENT_ID` | Yellow CoPilot app client ID | `8f84e5c6...` |
| `SHOPIFY_CLIENT_SECRET` | Yellow CoPilot app client secret | `shpss_0c85...` |
| `SHOPIFY_API_VERSION` | Shopify API version | `2026-01` |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude | `sk-ant-api03-...` |
| `APP_PASSWORD` | Simple auth guard (not currently enforced in middleware) | `ncho-tools-2026` |
| `NCHO_SUPABASE_URL` | Supabase project URL | `https://doezjenqywwabmaugpnb.supabase.co` |
| `NCHO_SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | `sb_secret_...` |

**Security notes:**
- `.env.local` is in `.gitignore` — never committed
- The Shopify client secret and Supabase service role key are the most sensitive values
- The Anthropic API key is Scott's personal key — usage is metered
- `APP_PASSWORD` exists for future middleware auth but is not currently wired in

---

## 5. File-by-File Reference

### Root Files

| File | Purpose |
|---|---|
| `package.json` | Dependencies and scripts. 5 runtime deps, 7 dev deps |
| `tsconfig.json` | TypeScript strict mode, ES2017 target, bundler resolution, `@/*` path alias |
| `next.config.ts` | Empty — default Next.js config |
| `postcss.config.mjs` | Tailwind CSS v4 PostCSS plugin |
| `eslint.config.mjs` | Next.js ESLint config |
| `.env.local` | All secrets and configuration (git-ignored) |
| `.gitignore` | Standard Next.js ignores + `.env*` + `api-guide-master.md` + `.env.master` |
| `supabase-tables.sql` | SQL migration for the 5 `ncho_` tables — run manually in Supabase SQL Editor |

### `src/lib/` — Core Libraries

#### `shopify.ts` — Shopify API Client
The foundation layer for all Shopify communication.

- **`getToken()`** — Authenticates via client credentials grant (POST to `/admin/oauth/access_token`). Caches token for 23 hours (Shopify tokens last 24 hours). Auto-refreshes with 5-minute buffer.
- **`gql<T>(query, variables?)`** — Executes GraphQL queries against the Shopify Admin API. Includes 3-retry logic with `Retry-After` header handling for rate limits (429s).
- **`restGet<T>(endpoint)`** — Makes REST GET requests to the Shopify Admin API.
- **`paginateGql<T>(queryTemplate, rootKey)`** — Paginates through GraphQL connections that use `edges/node/pageInfo/cursor` patterns. Takes a template with `__AFTER__` placeholder that gets replaced with cursor-based pagination. Includes 500ms courtesy delay between pages.

#### `shopify-queries.ts` — Data Fetching Functions
High-level query functions built on top of `shopify.ts`.

- **`fetchShopInfo()`** — Shop name, email, domain, plan, currency
- **`fetchProducts()`** — All products with full detail (tags, description, SEO, variants, images, pricing). Uses `paginateGql` to get all products regardless of count.
- **`fetchCollections()`** — All collections with product counts and SEO
- **`fetchBlogs()`** — All blogs with their articles (up to 50 articles per blog)
- **`fetchPages()`** — All published pages
- **`fetchPolicies()`** — Shop policies (shipping, return, privacy, etc.)
- **`fetchDashboardData()`** — Parallel fetch of all 6 above — used by the dashboard

#### `types.ts` — TypeScript Interfaces
All Shopify data shapes:

- `ShopInfo` — store metadata
- `ShopifyProduct` — full product with nested `variants`, `images`, `seo`, `priceRangeV2`, `tags[]`
- `ShopifyCollection` — collection with `productsCount`, `seo`
- `ShopifyBlog` — blog with nested `articles[]` (each has `body`, `tags`, `author`, `image`)
- `ShopifyPage` — static page with `body`, `bodySummary`
- `ShopifyPolicy` — policy with `body`, `type`, `url`

#### `ai-prompts.ts` — AI Prompt Templates
Brand-enforced prompts for the v1 SEO and blog generators.

- **`SEO_SYSTEM_PROMPT`** — System prompt for SEO generation: NCHO brand rules, "your child" not "your student", convicted not curious, warm teacher voice
- **`buildSeoPrompt(product)`** — Builds the user prompt for SEO: product title, vendor, tags, price, description → asks for JSON `{seoTitle, seoDescription}`
- **`BLOG_SYSTEM_PROMPT`** — System prompt for blog generation: same brand rules, soft CTA to the store, never use "journey" or "explore"
- **`buildBlogPrompt(topic, keywords?)`** — Builds the user prompt for blog post: topic, optional keywords → asks for JSON `{title, body, excerpt, seoTitle, seoDescription}`

#### `policies-data.ts` — Static Policy Content
Five complete, paste-ready Shopify policies stored as static strings:

| Key | Title | Content |
|---|---|---|
| `shipping` | Shipping Policy | US-only, free over $60, 7-14 business days, digital instant delivery |
| `returns` | Return & Refund Policy | 30-day physical returns, no digital refunds, 14-day course refund window, damaged order replacement |
| `privacy` | Privacy Policy | COPPA notice, FERPA notice, cookie/tracking disclosure, Meta Pixel + Google Analytics, no data selling |
| `about` | About Us | Scott & Anna's story — classroom teacher + author, Title 1 school, Alaska, teacher-curated curation, Alaska allotment eligible |
| `faq` | FAQ | 8 Q&As — who we are, secular + faith products, allotment eligibility, shipping, returns, digital, contact |

All policies reference `support@nextchapterhomeschool.com`.

#### `supabase.ts` — Database Client & CRUD Operations
Lazy-initialized Supabase client with all database operations.

**Client:**
- `db()` — Returns a singleton Supabase client. Created on first call (not at import time). Throws descriptive error if env vars are missing.

**Types exported:**
- `ChatThread` — id, title, messages (ChatMessage[]), pinned, timestamps
- `ChatMessage` — role (user/assistant), content, optional tool_calls, timestamp
- `ToolCallRecord` — tool name, input, result
- `StoreMemory` — id, fact, category, source, timestamp
- `ChangeLogEntry` — product_id, product_title, field, old_value, new_value, action, source, confidence, timestamp

**Thread operations:**
- `getThreads()` — List all threads, newest first
- `getThread(id)` — Get single thread by UUID
- `createThread(title?)` — Create new thread with empty message array
- `updateThreadMessages(id, messages)` — Replace messages array + update timestamp
- `updateThreadTitle(id, title)` — Rename a thread
- `deleteThread(id)` — Delete a thread

**Memory operations:**
- `getStoreMemories()` — List all memories, newest first
- `addStoreMemory(fact, category, source)` — Insert a new fact

**Change log operations:**
- `logChange(entry)` — Insert a change log entry
- `getRecentChanges(limit)` — Get recent changes, newest first

**Cost tracking:**
- `trackCost(inputTokens, outputTokens, operation, model?)` — Calculates USD cost using per-model rates (Sonnet: $3/$15 per MTok, Haiku: $1/$5) and inserts to tracking table
- `getCostSummary()` — Returns `{today, thisMonth, allTime}` cost totals

#### `chat-tools.ts` — Chatbot Tool Definitions & Executors
The 9 tools the AI chatbot can call, each with a definition (JSON Schema for Claude) and a server-side executor.

**Product Cache:**
- In-memory `ShopifyProduct[]` cache with 5-minute TTL
- `getCachedProducts()` — Returns cached or fresh products
- `invalidateProductCache()` — Clears cache (called after every write)

**Tool Definitions & Executors:**

| # | Tool | What It Does | Reads/Writes |
|---|---|---|---|
| 1 | `get_store_stats` | Returns store health: total products, SEO coverage percent, tag coverage by type (Grade/Age/Book/Genre/GetBooks), vendor issues count, top 10 vendors, collection count | Read |
| 2 | `fetch_products` | Fetches products with 9 filter modes: `all`, `no-seo`, `no-tags`, `vendor-issues`, `no-description`, `by-tag`, `by-vendor`, `by-type`, `search`. Supports `value` parameter and `limit` (default 20). Returns lightweight product summaries. | Read |
| 3 | `fetch_collections` | Lists all collections with product counts and SEO status | Read |
| 4 | `tag_product` | Adds or removes tags on a product via GraphQL `productUpdate` mutation. Logs changes to `ncho_change_log`. Invalidates product cache. | Write |
| 5 | `update_product` | Updates description, SEO title, SEO description, productType, or vendor. Can update multiple fields at once. Logs each changed field individually. Invalidates cache. | Write |
| 6 | `read_change_log` | Reads the audit trail of recent changes | Read |
| 7 | `remember` | Manually saves a fact to `ncho_store_memory` with a category (preference, product, brand, taxonomy, general) | Write (DB only) |
| 8 | `generate_seo` | Returns full product data so the chatbot can craft SEO text using its own reasoning + brand rules, then call `update_product` to save | Read (prep) |
| 9 | `classify_product` | Returns product data with instructions for the chatbot to determine Grade, Age, Book, Genre, Subject tags with confidence levels, then call `tag_product` to apply | Read (prep) |

#### `store-context.ts` — System Prompt Builder
`buildLiveContext()` — Assembles the system prompt for every chatbot message. Fetches live data from Supabase in parallel:

1. **Identity** — "You are Anna's AI store assistant for NCHO"
2. **Brand rules** — All non-negotiable NCHO voice rules (your child, convicted not curious, warm teacher voice)
3. **Tag taxonomy** — Complete reference for Grade:, Age:, Book:, Genre:, Subject: prefix system with valid values
4. **Store memory** — All previously learned facts and preferences, formatted as bullets
5. **Recent changes** — Last 10 changes from the audit log
6. **Cost tracking** — Today/month/all-time spend
7. **Behavioral rules** — 8 rules including: do it don't describe, remember preferences, confirm bulk ops, be specific, flag uncertainty

### `src/components/` — React Components

#### `layout-shell.tsx` — App Shell with Chat Toggle
Client component that wraps all page content.

- Manages `chatOpen` state (boolean)
- When closed: floating 💬 button at bottom-right (pink, 56px, z-50)
- When open: 480px fixed panel on right side, main content shifts left with `mr-[480px]` transition
- Panel has header with "🤖 Store Assistant" title and ✕ close button

#### `chat-panel.tsx` — Full Chat Interface
~450 lines. The complete conversational UI rendered inside the layout shell's right panel.

**Thread Sidebar (left 224px):**
- Thread list fetched from `/api/threads` on mount
- "+ New" button to start fresh conversation
- Click to load full thread from `/api/threads/[id]`
- Hover to reveal × delete button per thread
- "🔄 Sync Store" button at bottom — calls `/api/sync` to refresh product cache
- Collapsible via ◀/▶ toggle

**Message Area:**
- Empty state: greeting ("👋 Hi Anna!") + description + 4 suggestion chips:
  - "Show me products without SEO"
  - "How many products need grade tags?"
  - "Write a blog post about math curriculum"
  - "Classify the Ravensburger products"
- User messages: pink bubbles (right-aligned)
- Assistant messages: white bubbles with pink border (left-aligned)
- Tool call badges: sky-blue chips showing 🔧 tool name
- Auto-scroll to bottom on new messages

**Streaming Display:**
- "Thinking..." with pulse animation when waiting for first token
- Streaming text with ▌ cursor
- Tool activity indicators: ⏳ when running, ✅ when complete
- Success/failure status on tool results

**SSE Parsing:**
Reads the event stream from `/api/chat` and handles 6 event types:
- `thread` → stores thread ID
- `text` → appends content to streaming display
- `tool_start` → adds pending tool indicator
- `tool_result` → updates tool indicator to completed
- `done` → reloads full thread from server, refreshes thread list
- `error` → displays error in stream

**Input:**
- Auto-expanding textarea (42px min, 120px max)
- Enter to send, Shift+Enter for newline
- Send button disabled when streaming or empty

### `src/app/` — Pages

#### `layout.tsx` — Root Layout
- Google Fonts: Geist Sans + Geist Mono
- Background: `bg-gradient-to-br from-pink-50 via-sky-50/40 to-emerald-50/30`
- Left sidebar (224px): NCHO Tools branding, 5 nav links (Dashboard, Products, Blog, Policies, Settings), footer "Private tool — Scott & Anna only"
- Main area wrapped in `<LayoutShell>` which adds the chat panel toggle

#### `globals.css` — Global Styles
- `@import "tailwindcss"` (v4 syntax)
- CSS custom properties: `--background: #fff5f9`, `--foreground: #1e1b2e`
- Body: Arial/Helvetica fallback, min-height 100vh

#### `page.tsx` — Dashboard (Home Page)
The store health overview. Client component that fetches from `/api/dashboard`.

**Components:**
- `StatCard` — Colored stat card with label, value, subtitle. 5 color variants (blue, green, red, amber, gray)
- `ProgressBar` — SEO coverage bar with color coding (emerald at 100%, sky above 50%, amber below)

**Content:**
- 4 stat cards: Total Products, SEO Complete (with percentage), Vendor Issues, Blog Articles
- SEO coverage progress bar with count
- Policies status list with ✅/❌ per policy
- Quick Actions: View Products, Fix All SEO (count), Fix Vendors (count), Manage Policies, New Blog Post
- Collections grid: shows all 33 collections with product counts, "+21 more" overflow

#### `products/page.tsx` — Product Manager
Product listing with SEO generation and saving.

**Features:**
- Product table with search and filter (via URL params: `?filter=no-seo`, `?filter=vendor-issues`)
- Product image thumbnails
- Tags displayed as colored chips
- SEO status indicator per product
- Click product → SEO modal

**SEO Modal:**
- Shows product image, title, vendor, price, tags
- "✨ Generate SEO" button → calls `/api/generate-seo` → fills fields
- Editable SEO title (60 char guide) and description (155 char guide)
- "💾 Save to Shopify" button → calls `/api/update-product-seo`
- Status messages for success/failure (including write scope warning)

#### `blog/page.tsx` — Blog Publisher
Blog article listing and AI blog post generator.

**Features:**
- Lists existing blog articles (from dashboard data)
- "📝 New Post" form:
  - Topic input (required)
  - Keywords input (optional)
  - "✨ Generate Blog Post" → calls `/api/generate-blog`
  - Preview of generated title, body (HTML rendered), excerpt, SEO title, SEO description
  - Note: Publishing to Shopify requires write_content scope (not yet enabled)

#### `policies/page.tsx` — Policy Manager
View and stage store policies.

**Features:**
- 5 policy cards (shipping, returns, privacy, about, FAQ)
- Live/not-set status indicators comparing static content against what's in Shopify
- Expandable policy content with full HTML preview
- "Push to Shopify" button (shows write scope warning)
- "Copy" button for manual paste into Shopify admin
- Yellow banner explaining write scopes aren't enabled yet

#### `settings/page.tsx` — Connection Settings
Shopify connection diagnostics.

**Features:**
- Connection status indicator (green dot = connected)
- Store domain, token validity, scope info
- "Refresh Connection" button → re-checks `/api/connection-status`
- "Refresh Store Data" button → forces dashboard cache refresh
- Last sync timestamp

---

## 6. API Routes

### v1 Routes (Page-Based)

| Method | Route | Purpose | Auth | Cache |
|---|---|---|---|---|
| GET | `/api/dashboard` | Full store health data (shop + products + collections + blogs + pages + policies) | Shopify token | 5-min in-memory |
| GET | `/api/products` | All products array | Shopify token | 5-min in-memory |
| POST | `/api/generate-seo` | Generate SEO title + description via Claude | Anthropic key | None |
| POST | `/api/generate-blog` | Generate full blog post via Claude | Anthropic key | None |
| POST | `/api/update-product-seo` | Push SEO data to Shopify via GraphQL mutation | Shopify token | None |
| GET | `/api/connection-status` | Check Shopify token + connectivity | Shopify token | None |

### v2 Routes (Chatbot)

| Method | Route | Purpose | Auth | Cache |
|---|---|---|---|---|
| POST | `/api/chat` | Streaming SSE chat with Claude tool_use loop | Anthropic + Shopify + Supabase | Product cache 5-min |
| POST | `/api/extract-learnings` | Auto-extract facts from conversation | Anthropic + Supabase | None |
| GET | `/api/threads` | List all chat threads | Supabase | None |
| POST | `/api/threads` | Create new thread | Supabase | None |
| GET | `/api/threads/[id]` | Get single thread with messages | Supabase | None |
| PATCH | `/api/threads/[id]` | Rename a thread | Supabase | None |
| DELETE | `/api/threads/[id]` | Delete a thread | Supabase | None |
| POST | `/api/sync` | Invalidate product cache + re-fetch stats | Shopify token | Forces refresh |
| GET | `/api/cost` | Cost tracking summary (today/month/all-time) | Supabase | None |

---

## 7. Pages & UI

### Visual Design
The entire app uses a **pink/sky/emerald** palette:
- Background: pink-50 → sky-50 → emerald-50 gradient
- Sidebar: white → pink-50 gradient
- Cards: white/80 with backdrop-blur, pink-100 borders
- Buttons: pink-500 (primary), sky-400 (secondary), emerald-500 (success), amber-400 (warning)
- Chat bubbles: pink-500 (user), white with pink border (assistant)
- Tool indicators: sky-50 background with sky-600 text

### Page Map

| URL | Page | Component |
|---|---|---|
| `/` | Dashboard | `src/app/page.tsx` |
| `/products` | Product Manager | `src/app/products/page.tsx` |
| `/blog` | Blog Publisher | `src/app/blog/page.tsx` |
| `/policies` | Policy Manager | `src/app/policies/page.tsx` |
| `/settings` | Settings | `src/app/settings/page.tsx` |

### Navigation
Left sidebar (always visible, 224px wide):
- 📊 Dashboard
- 📦 Products
- 📝 Blog
- 📋 Policies
- ⚙️ Settings

### Chat Panel
Available on every page via floating 💬 button (bottom-right). Opens as a 480px fixed right panel. Contains its own thread sidebar and full chat interface.

---

## 8. The AI Chatbot (v2 Core Feature)

### How It Works

1. **Anna types a message** in the chat panel
2. **System prompt is assembled** via `buildLiveContext()` — injects brand rules, store memory, recent changes, tag taxonomy, cost tracking, and behavioral rules
3. **Last 20 messages** from the thread are included as conversation history
4. **Claude processes** with `tool_use` enabled, seeing 9 available tools
5. If Claude wants to use a tool:
   - SSE sends `tool_start` event → UI shows ⏳ indicator
   - Server executes the tool (reads/writes Shopify/Supabase)
   - SSE sends `tool_result` event → UI shows ✅ indicator
   - Claude sees the result and may call more tools (up to 10 iterations)
6. When Claude responds with text:
   - SSE sends `text` events → UI streams the response
7. After completion:
   - Messages saved to thread in Supabase
   - Cost tracked (input + output tokens × rate)
   - `extract-learnings` called async to mine new facts
   - SSE sends `done` event → UI reloads final thread state

### What Anna Can Ask

**Read operations (work now):**
- "How's the store looking?" → calls `get_store_stats`
- "Show me products without SEO" → calls `fetch_products` with filter `no-seo`
- "How many Ravensburger products do we have?" → calls `fetch_products` with filter `by-vendor`
- "List our collections" → calls `fetch_collections`
- "What changes have been made?" → calls `read_change_log`

**Write operations (require Shopify write scopes):**
- "Tag all Pre-K products with Age:3-5" → calls `fetch_products` then `tag_product` for each
- "Fix the vendor on product X" → calls `update_product`
- "Generate SEO for product X" → calls `generate_seo` then `update_product`
- "Classify the Klutz products" → calls `classify_product` then `tag_product`

**Memory operations (work now):**
- "Remember that Book:Classics maps to Grade:9th-12th" → calls `remember`
- Any preference Anna states is auto-extracted and saved after the conversation

### Auto-Learning (Extract-Learnings)

After each conversation, the system:
1. Takes the last 6 messages
2. Sends them to Claude with an extraction prompt
3. Claude identifies concrete, actionable facts Anna stated
4. Each fact is saved to `ncho_store_memory` with a category
5. On the next conversation, all memories are injected into the system prompt

This means the chatbot gets smarter over time. Anna says "I prefer Ravensburger for puzzles" once → it's remembered forever.

---

## 9. Supabase Database

### Instance
- **Project:** AI Tutor
- **URL:** `https://doezjenqywwabmaugpnb.supabase.co`
- **Region:** West US (Oregon) — us-west-2
- **Plan:** Nano

### Tables

All prefixed with `ncho_` to coexist with other tables in the instance.

#### `ncho_chat_threads`
| Column | Type | Default | Notes |
|---|---|---|---|
| id | UUID | `gen_random_uuid()` | Primary key |
| title | TEXT | 'New Chat' | Thread name shown in sidebar |
| messages | JSONB | '[]' | Array of ChatMessage objects |
| pinned | BOOLEAN | false | Sticky threads (not yet used in UI) |
| created_at | TIMESTAMPTZ | `now()` | |
| updated_at | TIMESTAMPTZ | `now()` | Updated on every message |

**Index:** `idx_ncho_chat_threads_updated` on `updated_at DESC`

#### `ncho_store_memory`
| Column | Type | Default | Notes |
|---|---|---|---|
| id | UUID | `gen_random_uuid()` | Primary key |
| fact | TEXT | NOT NULL | The learned fact |
| category | TEXT | 'general' | One of: preference, product, brand, taxonomy, general |
| source | TEXT | 'auto' | 'auto' (from extract-learnings) or 'manual' (from /remember) |
| created_at | TIMESTAMPTZ | `now()` | |

**Index:** `idx_ncho_store_memory_category` on `category`

#### `ncho_change_log`
| Column | Type | Default | Notes |
|---|---|---|---|
| id | UUID | `gen_random_uuid()` | Primary key |
| product_id | TEXT | NOT NULL | Shopify product GID |
| product_title | TEXT | NULL | Product name at time of change |
| field | TEXT | NOT NULL | What was changed (tags, description, seo_title, etc.) |
| old_value | TEXT | NULL | Previous value (truncated to 200 chars for descriptions) |
| new_value | TEXT | NULL | New value |
| action | TEXT | NOT NULL | Action type (add_tag, remove_tag, set_seo, update_description, etc.) |
| source | TEXT | 'chatbot' | Always 'chatbot' currently |
| confidence | REAL | NULL | AI confidence for classifications |
| created_at | TIMESTAMPTZ | `now()` | |

**Indexes:**
- `idx_ncho_change_log_product` on `product_id`
- `idx_ncho_change_log_created` on `created_at DESC`

#### `ncho_cost_tracking`
| Column | Type | Default | Notes |
|---|---|---|---|
| id | UUID | `gen_random_uuid()` | Primary key |
| input_tokens | INTEGER | 0 | Input tokens used |
| output_tokens | INTEGER | 0 | Output tokens used |
| model | TEXT | 'claude-sonnet-4-6' | Model name |
| operation | TEXT | NULL | 'chat', 'seo', 'blog', 'tagging', 'extract-learnings' |
| cost_usd | REAL | NULL | Self-calculated: input × $3/MTok + output × $15/MTok for Sonnet |
| created_at | TIMESTAMPTZ | `now()` | |

**Index:** `idx_ncho_cost_tracking_created` on `created_at DESC`

#### `ncho_flagged_products`
| Column | Type | Default | Notes |
|---|---|---|---|
| id | UUID | `gen_random_uuid()` | Primary key |
| product_id | TEXT | NOT NULL | Shopify product GID |
| product_title | TEXT | NULL | Product name |
| reason | TEXT | NOT NULL | Why it was flagged |
| confidence | REAL | NULL | Classification confidence |
| resolved | BOOLEAN | false | Whether Anna has reviewed it |
| created_at | TIMESTAMPTZ | `now()` | |

**Note:** The `ncho_flagged_products` table is created but not yet used by any tool executor. It's ready for when the classification system flags low-confidence results.

---

## 10. Shopify Integration

### Authentication
**Client credentials grant** — not OAuth.

1. App obtains token via POST to `https://{shop}/admin/oauth/access_token` with `grant_type=client_credentials`, `client_id`, `client_secret`
2. Token lasts 24 hours
3. `shopify.ts` caches the token and auto-refreshes with a 5-minute buffer
4. Token is passed as `X-Shopify-Access-Token` header on all API calls

### API Versions
- GraphQL: `https://{shop}/admin/api/2026-01/graphql.json`
- REST: `https://{shop}/admin/api/2026-01/{endpoint}`

### Shopify App
- **Name:** Yellow CoPilot
- **Type:** Custom app (Dev Dashboard)
- **Org:** 208508926
- **App ID:** 335390507009

### Current Scopes
All **24 read-only scopes** are granted. The app can read products, collections, blogs, pages, policies, orders, customers, etc.

### Write Scopes Needed
| Scope | Required For |
|---|---|
| `write_products` | Updating SEO, descriptions, tags, vendors, product types via chatbot and SEO tool |
| `write_content` | Publishing blog posts and pushing policies to Shopify pages |

**How to enable:** Anna goes to Shopify Partners Dashboard → Yellow CoPilot app → API scopes → check the write scopes → save → reinstall/re-authorize.

### GraphQL Mutations Used
1. **`productUpdate`** — Updates product fields (description, SEO, tags, vendor, productType). Used by both `update-product-seo` API route and `tag_product`/`update_product` chat tools.

```graphql
mutation productUpdate($input: ProductInput!) {
  productUpdate(input: $input) {
    product { id title tags seo { title description } }
    userErrors { field message }
  }
}
```

---

## 11. Brand Rules (Enforced in Code)

These rules are enforced in three locations:
- `ai-prompts.ts` — v1 SEO and blog system prompts
- `store-context.ts` — v2 chatbot system prompt
- Both use identical rules

### Non-Negotiable Rules
| Rule | Enforced In | Details |
|---|---|---|
| "your child" not "your student" | All AI prompts | Parents see their kids as children first |
| Convicted, not curious | All AI prompts | Customer has already decided to homeschool |
| Banned words | All AI prompts | Never: explore, journey, discover, spiritually curious |
| Preferred words | All AI prompts | Use: teach, intentional, believe, what you know to be true |
| Voice | All AI prompts | Warm, teacher-curated — not corporate, not generic catalog |
| Store name | Policies, prompts | "Next Chapter Homeschool Outpost" |
| Contact email | Policies, prompts | support@nextchapterhomeschool.com |
| Visual identity | Documentation | Red and white primary, earthy/warm accents |

### Tag Taxonomy (Chatbot-Enforced)
| Prefix | Example Values | Notes |
|---|---|---|
| `Grade:` | PreK, K, 1st, 2nd, ... 12th | Maps to school grade level |
| `Age:` | 3-5, 5-7, 8-10, 10-12, 12-14, 14+ | Age ranges |
| `Book:` | Board, Picture, Early Reader, Chapter, Middle Grade, Young Adult, Classics, Reference, Workbook | Book:Classics → high school |
| `Genre:` | Fiction, Nonfiction, Mystery, Historical, Adventure, Fantasy, Biography, Science | |
| `Subject:` | Math, Science, History, English, Art, Music, Geography | |
| `GetBooks` | (no prefix) | Indicates Ingram import — clean up after processing |

---

## 12. What's Done

### v1 Features (Complete & Deployed)
- [x] Shopify API authentication (client credentials grant, auto-refresh)
- [x] GraphQL client with retry logic and pagination
- [x] Dashboard with store health stats, SEO progress, policies status, quick actions, collections
- [x] Product listing with search and filter
- [x] SEO modal with AI generation (Claude) and save-to-Shopify
- [x] Blog publisher with AI generation (topic + keywords → full post)
- [x] Policy viewer with 5 pre-written policies, live/not-set status, copy to clipboard
- [x] Settings page with connection diagnostics
- [x] Pink/sky/emerald UI theme throughout

### v2 Features (Complete & Deployed — Pending Write Scopes for Full Functionality)
- [x] Supabase integration (5 tables created, lazy client, all CRUD)
- [x] AI chatbot with streaming SSE
- [x] 9 chatbot tools (stats, fetch, collections, tag, update, changelog, remember, SEO, classify)
- [x] Agentic tool loop (up to 10 iterations per message)
- [x] Thread management (create, list, rename, delete)
- [x] Store memory (auto-learn + manual remember)
- [x] Change log (before/after audit trail)
- [x] Cost tracking (tokens + USD per operation)
- [x] Extract-learnings (async post-conversation fact mining)
- [x] Brand-aware system prompt with live context injection
- [x] In-memory product cache with invalidation
- [x] Chat panel UI with thread sidebar, streaming, tool indicators
- [x] Suggestion chips for empty state
- [x] Sync button for manual cache refresh

### Infrastructure (Complete)
- [x] Deployed to Vercel at nchocopilot.vercel.app
- [x] GitHub repo at TheAccidentalTeacher/nchocopilot
- [x] Supabase tables created (AI Tutor instance)
- [x] Local env vars configured
- [x] Build passes cleanly (0 errors, 19 routes compiled)

---

## 13. What Still Needs to Be Done

### Blocking — Required Before Full Functionality

| # | Task | Who | Why |
|---|---|---|---|
| 1 | **Add Supabase env vars to Vercel** | Scott | Chat/threads/memory won't work on production without `NCHO_SUPABASE_URL` and `NCHO_SUPABASE_SERVICE_ROLE_KEY` in Vercel environment variables. Redeploy after adding. |
| 2 | **Enable `write_products` scope on Shopify** | Anna | All product writes (tag, update, SEO save) will fail until this scope is enabled. Partners Dashboard → Yellow CoPilot → API scopes → check `write_products` → save. |
| 3 | **Enable `write_content` scope on Shopify** | Anna | Blog publishing and policy pushing will fail without this. Same process as above. |
| 4 | **Test chat end-to-end** | Scott + Anna | After env vars + scopes are live: open chat → send a message → verify streaming, tool calls, thread saving, memory extraction all work. |

### High Priority — Should Do Soon

| # | Task | Details |
|---|---|---|
| 5 | **Thread rename from chat** | Currently threads are titled "New Chat" — auto-rename based on first message (ask Claude to generate a short title). The `updateThreadTitle` function exists, just needs a trigger. |
| 6 | **Wire `APP_PASSWORD` into middleware** | The password exists in env vars but no auth middleware is checking it. Add basic auth or a simple password gate to protect the app from anyone who discovers the URL. |
| 7 | **Blog publishing to Shopify** | The blog generator creates content but can't publish to Shopify yet. Needs `write_content` scope + a GraphQL mutation for `articleCreate`. |
| 8 | **Policy push to Shopify** | Same — policies are pre-written but need write scope to push. Currently shows a "copy manually" fallback. |
| 9 | **Use `ncho_flagged_products` table** | Table is created but no tool writes to it yet. When classification confidence is below threshold, insert a row and surface it in the UI. |
| 10 | **Cost tracking in v1 routes** | The v1 SEO and blog generators call Claude but don't track cost. Wire `trackCost()` into `/api/generate-seo` and `/api/generate-blog`. |

### Nice to Have — Future Improvements

| # | Task | Details |
|---|---|---|
| 11 | **Bulk operations UI** | A dedicated page or chat command for "classify all untagged products" or "generate SEO for all products without it" — with progress tracking. |
| 12 | **Thread pinning in UI** | The `pinned` column exists but the chat UI doesn't expose it. Add a pin toggle that keeps important threads at the top. |
| 13 | **Memory management UI** | A page to view, edit, and delete stored memories. Currently memories can only be viewed in Supabase directly. |
| 14 | **Change log viewer page** | A dedicated page showing all changes in a table with filters (by product, by action type, by date). Currently only accessible via chatbot. |
| 15 | **Export change log** | CSV export of all changes for Anna's records. |
| 16 | **Custom domain** | Move from `nchocopilot.vercel.app` to a subdomain like `tools.nextchapterhomeschool.com`. |
| 17 | **Product description generator** | The chatbot can update descriptions, but a dedicated UI for bulk description generation (similar to the SEO modal) would be useful. |
| 18 | **Collection SEO** | Collections also need SEO titles/descriptions. Add to both chatbot tools and v1 pages. |
| 19 | **Dark mode** | Currently light-only. Not a priority — Anna uses it in daylight. |
| 20 | **Mobile responsive** | The chat panel is 480px fixed — doesn't work on mobile. Low priority since this is a desktop management tool. |

---

## 14. How to Run Locally

```bash
# Clone the repo
git clone https://github.com/TheAccidentalTeacher/nchocopilot.git
cd nchocopilot

# Install dependencies
npm install

# Create .env.local with all required variables (see section 4)
# Copy from an existing .env.local or set each one manually

# Run the dev server
npm run dev

# Open http://localhost:3000
```

### Prerequisites
- Node.js 18+
- npm
- Shopify store with Yellow CoPilot app installed
- Anthropic API key
- Supabase project with `ncho_` tables (run `supabase-tables.sql`)

---

## 15. How to Deploy

The app deploys automatically to Vercel on every push to `main`.

### Manual Deploy Process
1. Make changes locally
2. `npm run build` — verify clean build (0 errors)
3. `git add -A && git commit -m "description" && git push`
4. Vercel auto-deploys from GitHub
5. Verify at https://nchocopilot.vercel.app

### Environment Variables on Vercel
All 8 env vars from `.env.local` must also be set in:
**Vercel → nchocopilot → Settings → Environment Variables**

If you add or change an env var, you must **redeploy** for it to take effect (Vercel → Deployments → Redeploy).

---

## 16. Troubleshooting

### "supabaseUrl is required" build error
The Supabase client was created at module import time with empty env vars. This was fixed by converting to a lazy `db()` function. If it ever reappears, ensure `supabase.ts` uses the `db()` pattern (create on first call, not at import).

### Chat panel doesn't load / shows errors
1. Check Vercel environment variables are set (all 8)
2. Check Supabase tables exist (run `supabase-tables.sql`)
3. Check browser console for specific error messages
4. If "Supabase not configured" — env vars are missing or empty

### Product writes fail
Write operations return errors like "Access denied" until `write_products` scope is enabled on the Shopify app. This is expected — the app was granted read-only scopes initially.

### SEO generation works but won't save
Same issue — `write_products` scope needed. The "Generate" button works (read-only + Claude), but "Save to Shopify" fails (needs write).

### Shopify 429 (rate limit)
The GraphQL client has built-in retry logic with `Retry-After` header handling. The paginator also includes a 500ms courtesy delay. If you still hit limits, reduce concurrent usage.

### AI responses are slow
Claude Sonnet 4.6 takes 2-8 seconds for a response, plus tool execution time. Multi-tool conversations (10 iterations) can take 30+ seconds. This is expected. The streaming UI shows progress so Anna knows it's working.

### Thread data not persisting
Check Supabase connection. The chat gracefully degrades — if Supabase is unreachable, conversations work but aren't saved. Check the browser network tab for failed `/api/threads` calls.

---

## Appendix: Git History

| Commit | Description |
|---|---|
| Initial | v1 scaffolding — Next.js, Shopify integration, dashboard, products, blog, policies, settings |
| UI restyle | All pages restyled to pink/sky/emerald palette |
| v2 build | AI chatbot with 9 agentic tools, persistent memory, streaming SSE, thread management, cost tracking, extract-learnings |

**Total codebase:** ~2,800 lines of application code across 25 source files.

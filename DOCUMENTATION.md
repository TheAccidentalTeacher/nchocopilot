# NCHO Tools — Complete Technical Documentation

> **App:** NCHO Tools v2  
> **Purpose:** AI-powered Shopify store management for Next Chapter Homeschool Outpost  
> **Live URL:** https://nchocopilot.vercel.app  
> **GitHub:** https://github.com/TheAccidentalTeacher/nchocopilot  
> **Owners:** Scott & Anna Somers — private tool, not customer-facing  
> **Created:** March 17, 2026  
> **Last Updated:** March 18, 2026

---

## Table of Contents

1. [What This App Does](#1-what-this-app-does)
2. [Tech Stack](#2-tech-stack)
3. [Architecture Overview](#3-architecture-overview)
4. [Authentication](#4-authentication)
5. [Environment Variables](#5-environment-variables)
6. [File-by-File Reference](#6-file-by-file-reference)
7. [API Routes](#7-api-routes)
8. [Pages & UI](#8-pages--ui)
9. [The AI Chatbot (v2 Core Feature)](#9-the-ai-chatbot-v2-core-feature)
10. [Supabase Database](#10-supabase-database)
11. [Shopify Integration](#11-shopify-integration)
12. [Brand Rules (Enforced in Code)](#12-brand-rules-enforced-in-code)
13. [What's Done](#13-whats-done)
14. [What Still Needs to Be Done](#14-what-still-needs-to-be-done)
15. [How to Run Locally](#15-how-to-run-locally)
16. [How to Deploy](#16-how-to-deploy)
17. [Troubleshooting](#17-troubleshooting)

---

## 1. What This App Does

NCHO Tools is a private management dashboard for the **Next Chapter Homeschool Outpost** Shopify store. It gives Scott and Anna a single interface to:

- **See store health at a glance** — product count, SEO coverage, vendor issues, blog articles
- **Generate AI-powered SEO** titles and meta descriptions for every product, following NCHO brand voice
- **Generate and publish blog posts** with AI — topic in, full branded blog post published to Shopify
- **View and push store policies** — shipping, returns, privacy, about us, FAQ (all pre-written)
- **Chat with an AI store assistant** that can read, classify, tag, edit products, create collections, define metafields, publish blogs, and research products on the web — all directly in Shopify
- **Upload images and files** — paste screenshots for Claude vision analysis, attach CSV/JSON/text files for bulk processing
- **Use voice input** — speak to the chatbot via Web Speech API microphone integration
- **Auto-learn preferences** — the chatbot remembers Anna's decisions and applies them going forward
- **Track every change** — full before/after audit log of every modification
- **Track AI costs** — token usage and dollar cost per operation
- **Password-protected** — Supabase Auth with email/password login (Scott and Anna only), per-user thread isolation

The v1 (dashboard, products, blog, policies, settings) provides structured page-based tools. The v2 chatbot provides conversational, agentic access to the same capabilities — plus memory, classification, web research, collection creation, metafield management, and preference learning.

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
| Auth | Supabase Auth (SSR) | @supabase/ssr ^0.9.0 |
| Shopify API | Admin API (GraphQL + REST) | 2026-01 |
| Shopify Auth | Client credentials grant | 24hr token auto-refresh |
| Hosting | Vercel | Pro plan |
| Fonts | Geist Sans + Geist Mono | Google Fonts |

**Runtime dependencies (6):** next, react, react-dom, @anthropic-ai/sdk, @supabase/supabase-js, @supabase/ssr. Plus dev tooling (tailwind, typescript, eslint).

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     BROWSER (Scott / Anna)                   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  /login — Email + password (Supabase Auth)           │   │
│  └──────────────────────┬───────────────────────────────┘   │
│                         │ Cookie-based session               │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ ┌────────┐ ┌──────┐ │
│  │Dashboard │ │Products  │ │Blog    │ │Policies│ │Settings│ │
│  └────┬─────┘ └────┬─────┘ └───┬────┘ └───┬────┘ └──┬───┘ │
│       │             │           │          │         │      │
│  ┌────┴─────────────┴───────────┴──────────┴─────────┴───┐  │
│  │              Chat Panel (💬 bottom-right)              │  │
│  │  Thread sidebar │ Streaming │ Voice │ File attachments │  │
│  │  Thinking indicator │ Message queue │ Tool indicators  │  │
│  └────────────────────────────┬───────────────────────────┘  │
└───────────────────────────────┼──────────────────────────────┘
                                │ SSE Stream
                                ▼
┌─────────────────────────────────────────────────────────────┐
│              NEXT.JS SERVER (Vercel) + proxy.ts Auth Guard   │
│                                                             │
│  Auth:                                                      │
│  proxy.ts ────────────── Supabase SSR session check ──┐     │
│  /api/auth/logout ────── Sign out + clear cookies     │     │
│                                                       ▼     │
│  API Routes:                                        Supabase│
│  /api/dashboard ──────── fetchDashboardData() ──┐    Auth   │
│  /api/products ───────── fetchProducts()        │           │
│  /api/generate-seo ───── Claude + brand rules   │           │
│  /api/generate-blog ──── Claude + brand rules   │           │
│  /api/update-product-seo ─ GraphQL mutation      ├──→ Shopify│
│  /api/publish-blog ───── Blog article create    │   Admin   │
│  /api/connection-status ── token + scope check  │   API    │
│  /api/sync ───────────── invalidate + re-fetch ─┘           │
│                                                             │
│  /api/chat ──── Claude tool_use loop (up to 10 iterations)  │
│       │            │ Uses 16 tools that call Shopify/Supabase│
│       │            ▼                                         │
│  /api/extract-learnings ── auto-save facts from conversations│
│  /api/threads ──── CRUD on chat threads (per-user isolated)  │
│  /api/threads/[id] ── GET/PATCH/DELETE single thread         │
│  /api/cost ──── cost tracking summary                        │
│                                                             │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                    SUPABASE (PostgreSQL + Auth)              │
│                 AI Tutor instance — us-west-2                │
│            doezjenqywwabmaugpnb.supabase.co                 │
│                                                             │
│  Auth:                                                      │
│  auth.users ───────────── Scott + Anna email/password       │
│    Scott: scott@nextchapterhomeschool.com                   │
│    Anna:  anna@nextchapterhomeschool.com (UUID: 07675d7c)   │
│                                                             │
│  Tables:                                                    │
│  ncho_chat_threads ────── conversation history (JSONB)      │
│    └── user_id column ── per-user thread isolation          │
│  ncho_store_memory ────── auto-learned facts + preferences  │
│  ncho_change_log ──────── before/after audit trail          │
│  ncho_cost_tracking ───── token usage + USD per operation   │
│  ncho_flagged_products ── AI-uncertain classifications      │
└─────────────────────────────────────────────────────────────┘
```

**Key architectural patterns:**

- **Supabase Auth (SSR)** — Cookie-based authentication using `@supabase/ssr`. `proxy.ts` (Next.js 16's middleware convention) checks for a valid session on every request and redirects to `/login` if unauthenticated. API routes return 401 for unauthenticated requests. Per-user thread isolation via `user_id` column on `ncho_chat_threads`.
- **Lazy Supabase initialization** — The Supabase client is created on first use via a `db()` function, not at module import time. This prevents build failures when env vars are empty (Next.js evaluates imports during static analysis).
- **In-memory product cache** — Products are cached for 5 minutes in the `chat-tools.ts` module to avoid re-fetching from Shopify on every chatbot tool call. Cache is invalidated after any write operation.
- **SSE streaming** — The chat API uses Server-Sent Events to stream text tokens, tool activity indicators, and tool results back to the browser in real-time.
- **Agentic tool loop** — Claude can call tools, observe results, and decide to call more tools — up to 10 iterations per message. This allows multi-step operations like "classify this product → generate tags → apply tags → confirm."
- **Fire-and-forget learning** — After every conversation, the extract-learnings endpoint is called asynchronously to mine facts from the conversation and store them in memory.
- **Message queueing** — Users can type and queue their next message while the chatbot is still streaming a response. The queued message auto-sends when the current response completes.

---

## 4. Authentication

### System
**Supabase Auth** with `@supabase/ssr` — cookie-based server-side sessions. No client-side token exposure.

### Users
| User | Email | Role |
|---|---|---|
| Scott Somers | scott@nextchapterhomeschool.com | Owner |
| Anna Somers | anna@nextchapterhomeschool.com | Owner (UUID: `07675d7c-5da3-4bba-b3bf-dc5a6474cba8`) |

### Auth Flow
1. User visits any page → `proxy.ts` (Next.js 16 middleware) intercepts
2. Creates server-side Supabase client with cookie management
3. Refreshes auth token (auto-refresh on expiration)
4. No valid session → redirects to `/login` (pages) or returns 401 (API routes)
5. Login page: email + password form → `signInWithPassword()` → sets session cookie → redirects to `/`
6. Logout: POST `/api/auth/logout` → clears session → redirects to `/login`

### Thread Isolation
Chat threads have a `user_id` column. Each user only sees their own threads. The `user_id` is set automatically from the auth session when threads are created.

### Key Files
| File | Purpose |
|---|---|
| `src/proxy.ts` | Next.js 16 middleware — auth guard for all routes (replaces middleware.ts) |
| `src/app/login/page.tsx` | Login page — email + password form, NCHO branding |
| `src/lib/supabase-auth.ts` | `createServerSupabase()` — creates server-side Supabase client with cookie management |
| `src/lib/auth-helpers.ts` | `getAuthUser()` — extracts user ID + email from session in API routes |
| `src/app/api/auth/logout/route.ts` | Logout endpoint — signs out user, clears cookies |

---

## 5. Environment Variables

All defined in `.env.local` (git-ignored). Must also be set in Vercel.

| Variable | Purpose | Example |
|---|---|---|
| `SHOPIFY_STORE` | Shopify store domain | `next-chapter-homeschool.myshopify.com` |
| `SHOPIFY_CLIENT_ID` | Yellow CoPilot app client ID | `8f84e5c6...` |
| `SHOPIFY_CLIENT_SECRET` | Yellow CoPilot app client secret | `shpss_0c85...` |
| `SHOPIFY_API_VERSION` | Shopify API version | `2026-01` |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude | `sk-ant-api03-...` |
| `NCHO_SUPABASE_URL` | Supabase project URL | `https://doezjenqywwabmaugpnb.supabase.co` |
| `NCHO_SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side DB operations) | `sb_secret_...` |
| `NCHO_SUPABASE_ANON_KEY` | Supabase anon key (browser-side auth) | `eyJhbGci...` |

**Security notes:**
- `.env.local` is in `.gitignore` — never committed
- The Shopify client secret and Supabase service role key are the most sensitive values
- The Anthropic API key is Scott's personal key — usage is metered
- `NCHO_SUPABASE_ANON_KEY` is the public anon key used by the browser for Supabase Auth — safe to expose client-side but still git-ignored
- `NCHO_SUPABASE_SERVICE_ROLE_KEY` bypasses Row Level Security — server-side only, never exposed to the browser

---

## 6. File-by-File Reference

### Root Files

| File | Purpose |
|---|---|
| `package.json` | Dependencies and scripts. 6 runtime deps, 7 dev deps |
| `tsconfig.json` | TypeScript strict mode, ES2017 target, bundler resolution, `@/*` path alias |
| `next.config.ts` | Empty — default Next.js config |
| `postcss.config.mjs` | Tailwind CSS v4 PostCSS plugin |
| `eslint.config.mjs` | Next.js ESLint config |
| `.env.local` | All secrets and configuration (git-ignored) |
| `.gitignore` | Standard Next.js ignores + `.env*` + `api-guide-master.md` + `.env.master` |
| `supabase-tables.sql` | SQL migration for the 5 `ncho_` tables — run manually in Supabase SQL Editor |
| `DOCUMENTATION.md` | This file — complete technical reference |

### `scripts/` — Utility Scripts

| File | Purpose |
|---|---|
| `check-metafields.mjs` | Diagnostic script to inspect metafield definitions on the Shopify store |
| `check-taxonomy.mjs` | Diagnostic script to inspect product category/taxonomy data from Shopify |

### `src/types/` — TypeScript Declarations

| File | Purpose |
|---|---|
| `speech.d.ts` | Web Speech API type declarations — `SpeechRecognition`, `SpeechRecognitionEvent`, `SpeechRecognitionResult`, `SpeechRecognitionAlternative`. Extends `Window` interface with optional `SpeechRecognition`/`webkitSpeechRecognition` |

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
The 16 tools the AI chatbot can call, each with a definition (JSON Schema for Claude) and a server-side executor.

**Product Cache:**
- In-memory `ShopifyProduct[]` cache with 5-minute TTL
- `getCachedProducts()` — Returns cached or fresh products
- `invalidateProductCache()` — Clears cache (called after every write)

**Tool Definitions & Executors:**

| # | Tool | What It Does | Reads/Writes |
|---|---|---|---|
| 1 | `get_store_stats` | Returns store health: total products, SEO coverage percent, tag coverage by type (Grade/Age/Book/Genre/GetBooks), vendor issues count, top 10 vendors, collection count | Read |
| 2 | `fetch_products` | Fetches products with 10+ filter modes: `all`, `no-seo`, `no-tags`, `vendor-issues`, `no-description`, `no-category`, `no-metafields`, `by-tag`, `by-vendor`, `by-type`, `search`. Supports `value` parameter and `limit` (default 20). Returns lightweight product summaries. | Read |
| 3 | `fetch_collections` | Lists all collections with product counts and SEO status | Read |
| 4 | `tag_product` | Adds or removes tags on a product via GraphQL `productUpdate` mutation. Logs changes to `ncho_change_log`. Invalidates product cache. | Write |
| 5 | `update_product` | Updates title, handle (URL slug), description, SEO title, SEO description, productType, vendor, Standard Product Category (taxonomy GID), or compare at price. Compare at price lives on variants — handled via `productVariantsBulkUpdate` mutation automatically. Pass `compareAtPrice: null` to clear inflated prices from imports. Can update multiple fields at once. Logs each changed field individually. Invalidates cache. | Write |
| 6 | `read_change_log` | Reads the audit trail of recent changes | Read |
| 7 | `remember` | Manually saves a fact to `ncho_store_memory` with a category (preference, product, brand, taxonomy, general) | Write (DB only) |
| 8 | `generate_seo` | Returns full product data so the chatbot can craft SEO text using its own reasoning + brand rules, then call `update_product` to save | Read (prep) |
| 9 | `classify_product` | Returns product data with instructions for the chatbot to determine Grade, Age, Book, Genre, Subject tags with confidence levels, then call `tag_product` to apply | Read (prep) |
| 10 | `search_web` | Research products on the web. Two modes: (a) pass a URL → fetches the page and extracts text. (b) pass a search query → DuckDuckGo instant answer. No API key needed. | Read (external) |
| 11 | `publish_blog` | Publishes a blog post to Shopify. Creates an article on the store blog with title, body (HTML), excerpt, SEO title, SEO description, and tags. Logs the action to the change log. | Write |
| 12 | `update_metafields` | Writes metafield values to a Shopify product. Known custom metafields (namespace: `custom`): `collapsible_headline_1`, `collapsible_headline_2_author_brand`, `collapsible_text_1`, `collapsible_text_2`. All `single_line_text_field` type. Can write any future metafields Anna creates. | Write |
| 13 | `create_collection` | Creates a new Shopify collection. Smart collections use rules (TAG EQUALS, TYPE CONTAINS, VENDOR NOT_EQUALS, etc.) to auto-include matching products. Manual collections have no rules. Supports sort orders. Logs creation to change log. | Write |
| 14 | `create_metafield_definition` | Creates a store-level metafield definition so it appears as a named, editable field in Shopify Admin. Must be created BEFORE writing values to a new metafield key. Automatically pinned. Handles duplicates gracefully (TAKEN error). | Write |
| 15 | `undo_changes` | Undoes recent changes to Shopify products. Reverses tag additions/removals, SEO updates, description/title/vendor changes by restoring old values from the change log. Can target a specific product or undo the N most recent changes. Each undo is logged as its own change log entry for traceability. | Write |
| 16 | `generate_description` | Generates an accurate product description by downloading the product's Shopify image and passing it to Claude via AI vision. Claude sees the actual puzzle artwork/game box/kit contents instead of guessing from the title. Returns image + product metadata, writes description following Product Description Rules in system prompt, then calls `update_product` to save. Flags `[NEEDS REVIEW]` when uncertain. | Read + Vision |

#### `store-context.ts` — System Prompt Builder
`buildLiveContext()` — Assembles the system prompt for every chatbot message. Fetches live data from Supabase in parallel:

1. **Identity** — "You are Anna's AI store assistant for NCHO"
2. **Self-awareness** — Full description of the app's architecture, tech stack, every page, and all 16 tools
3. **Brand rules** — All non-negotiable NCHO voice rules (your child, convicted not curious, warm teacher voice)
4. **Tag taxonomy** — Complete reference for Grade:, Age:, Book:, Genre:, Subject: prefix system with valid values
5. **Store memory** — All previously learned facts and preferences, formatted as bullets
6. **Recent changes** — Last 15 changes from the audit log
7. **Cost tracking** — Today/month/all-time spend
8. **Behavioral rules** — 14 rules including: do it don't describe, remember preferences, confirm bulk ops, be specific, flag uncertainty, use web search when descriptions are thin, explain your own architecture when asked

#### `supabase-auth.ts` — Server-Side Auth Client
- **`createServerSupabase()`** — Creates a server-side Supabase client with cookie management via `@supabase/ssr`. Used in Server Components and API routes for session verification.

#### `auth-helpers.ts` — Auth Utilities
- **`getAuthUser()`** — Extracts `{id, email}` from the current session cookie in API routes. Returns `null` if no valid session. Try/catch wrapped for safety.

### `src/components/` — React Components

#### `layout-shell.tsx` — App Shell with Chat Toggle
Client component that wraps all page content.

- Manages `chatOpen` state (boolean)
- When closed: floating 💬 button at bottom-right (pink, 56px, z-50)
- When open: 480px fixed panel on right side, main content shifts left with `mr-[480px]` transition
- Panel has header with "🤖 Store Assistant" title and ✕ close button

#### `sidebar.tsx` — Navigation Sidebar
Client component for the left nav sidebar.

- 6 nav links with emoji icons: 📊 Dashboard, 📦 Products, 🔄 Change Log, 📝 Blog, 📋 Policies, ⚙️ Settings
- Active page highlighting (pink background)
- Displays logged-in user's first name (parsed from email: "scott" or "anna")
- Logout button → POST `/api/auth/logout` → redirect to `/login`
- Pink + white gradient background

#### `chat-panel.tsx` — Full Chat Interface
~1,100 lines. The complete conversational UI rendered inside the layout shell's right panel.

**Thread Sidebar (left 224px):**
- Thread list fetched from `/api/threads` on mount (per-user filtered)
- "+ New" button to start fresh conversation
- Click to load full thread from `/api/threads/[id]`
- Double-click or pencil icon to rename thread inline
- Hover to reveal × delete button per thread
- Auto-titles new threads from first message (first 50 chars + "…")
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

**Thinking Indicator:**
- Animated 3-dot bouncing bar above the input area during streaming
- Context-aware status text:
  - "Thinking..." — waiting for first token
  - "Working on it — using {tool}..." — tool is executing
  - "Writing response..." — streaming text
  - "Your next message is queued ✓" — message queued while streaming

**Message Queue System:**
- When streaming is active, input remains unlocked
- Send button changes to "Queue" during streaming
- User can type and submit; message is stored in `queuedMessage` state
- After current response completes, queued message auto-sends via programmatic click
- Button shows "Queued ✓" confirmation

**Voice Input:**
- Microphone button next to send button
- Uses Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`)
- Continuous mode OFF, interim results ON — transcript appears in input field as user speaks
- Mic button pulses red with animation when listening
- Browser fallback alert if Web Speech API is unsupported
- Stores recognition instance in `recognitionRef`

**File Attachments:**
- Attach button (📎) for file upload — images (PNG, JPG, GIF, WebP) + text files (CSV, JSON, TXT, HTML, MD, PDF)
- Max 10MB per file
- Images sent as base64 to Claude vision
- Text files sent as content strings (up to 50KB truncated)
- Paste handler: detects clipboard images, prevents default paste
- Preview thumbnails shown before sending

**Streaming Display:**
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
- Send/Queue button, microphone button, attach button — all remain enabled during streaming
- Contextual placeholder text ("Type a message...", "Listening...", "Type to queue your next message...")

### `src/` — Root Source Files

#### `proxy.ts` — Authentication Middleware (Next.js 16)
Next.js 16 uses `proxy.ts` instead of `middleware.ts` for request interception.

- Creates server-side Supabase client using `@supabase/ssr` with cookie management
- Refreshes auth token on every request (handles expiration automatically)
- No valid session → redirects to `/login` for page requests, returns 401 for `/api/` routes
- Login page is bypassed (no auth required)
- Matcher protects all routes except `_next`, static files, and favicon

### `src/app/` — Pages

#### `login/page.tsx` — Login Page
Email + password authentication form.

- Client-side Supabase browser client (`createBrowserClient` with anon key)
- `signInWithPassword()` on form submit
- Error display with red border box for invalid credentials
- Loading state on submit button ("Signing in...")
- Placeholder: "scott@... or anna@..."
- On success: `window.location.href = "/"` (full page reload to pick up cookies)
- Pink/white gradient background with NCHO branding

#### `layout.tsx` — Root Layout
- Google Fonts: Geist Sans + Geist Mono
- Background: `bg-gradient-to-br from-pink-50 via-sky-50/40 to-emerald-50/30`
- Left sidebar (224px): NCHO Tools branding, 6 nav links (Dashboard, Products, Change Log, Blog, Policies, Settings), user name + sign out button
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
- Status messages for success/failure

#### `blog/page.tsx` — Blog Publisher
Blog article listing and AI blog post generator.

**Features:**
- Lists existing blog articles (from dashboard data)
- "📝 New Post" form:
  - Topic input (required)
  - Keywords input (optional)
  - "✨ Generate Blog Post" → calls `/api/generate-blog`
  - Preview of generated title, body (HTML rendered), excerpt, SEO title, SEO description
  - "Publish to Shopify" button → calls `/api/publish-blog`

#### `policies/page.tsx` — Policy Manager
View and stage store policies.

**Features:**
- 5 policy cards (shipping, returns, privacy, about, FAQ)
- Live/not-set status indicators comparing static content against what's in Shopify
- Expandable policy content with full HTML preview
- "Push to Shopify" button (write_content scope enabled)
- "Copy" button for manual paste into Shopify admin

#### `changes/page.tsx` — Change Log
Visual timeline of every AI-initiated change to the Shopify store with per-entry undo.

**Features:**
- Entries grouped by day with sticky date headers
- Color-coded action badges (green=tag add, blue=SEO, purple=description, gray=undo)
- Expandable rows showing before/after diff (red=old, green=new)
- "↩ Undo" button on every reversible entry — triggers freshness check against live Shopify value
- Conflict detection modal when field has drifted since original change — shows current vs. restore value, "Cancel" or "Override & Undo"
- Filters: search by product name, filter by field type, filter by action type
- Pagination (50 per page)
- Toast notifications for undo success/failure
- Non-reversible items (collection creation, blog publish, metafield definitions) shown without undo buttons

#### `settings/page.tsx` — Connection Settings
Shopify connection diagnostics.

**Features:**
- Connection status indicator (green dot = connected)
- Store domain, token validity, scope info
- "Refresh Connection" button → re-checks `/api/connection-status`
- "Refresh Store Data" button → forces dashboard cache refresh
- Last sync timestamp

---

## 7. API Routes

### Auth Routes

| Method | Route | Purpose | Auth |
|---|---|---|---|
| POST | `/api/auth/logout` | Sign out user, clear Supabase session cookies | Supabase Auth |

### v1 Routes (Page-Based)

| Method | Route | Purpose | Auth | Cache |
|---|---|---|---|---|
| GET | `/api/dashboard` | Full store health data (shop + products + collections + blogs + pages + policies) | Shopify token | 5-min in-memory |
| GET | `/api/products` | All products array | Shopify token | 5-min in-memory |
| POST | `/api/generate-seo` | Generate SEO title + description via Claude | Anthropic key | None |
| POST | `/api/generate-blog` | Generate full blog post via Claude | Anthropic key | None |
| POST | `/api/update-product-seo` | Push SEO data to Shopify via GraphQL mutation | Shopify token | None |
| POST | `/api/publish-blog` | Publish blog article to Shopify | Shopify token | None |
| GET | `/api/connection-status` | Check Shopify token + connectivity | Shopify token | None |

### v2 Routes (Chatbot)

| Method | Route | Purpose | Auth | Cache |
|---|---|---|---|---|
| POST | `/api/chat` | Streaming SSE chat with Claude tool_use loop (16 tools) | Anthropic + Shopify + Supabase | Product cache 5-min |
| POST | `/api/extract-learnings` | Auto-extract facts from conversation | Anthropic + Supabase | None |
| GET | `/api/threads` | List all chat threads (per-user filtered) | Supabase Auth | None |
| POST | `/api/threads` | Create new thread (with user_id) | Supabase Auth | None |
| GET | `/api/threads/[id]` | Get single thread with messages | Supabase | None |
| PATCH | `/api/threads/[id]` | Rename a thread | Supabase | None |
| DELETE | `/api/threads/[id]` | Delete a thread | Supabase | None |
| POST | `/api/sync` | Invalidate product cache + re-fetch stats | Shopify token | Forces refresh |
| GET | `/api/cost` | Cost tracking summary (today/month/all-time) | Supabase | None |
| GET | `/api/changes` | Change log entries with optional filters (field, action, productId) + pagination | Supabase | None |
| POST | `/api/undo` | Undo a single change log entry — freshness check against live Shopify, conflict detection, force override | Shopify + Supabase | Writes undo entry to change log |

---

## 8. Pages & UI

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
| `/login` | Login | `src/app/login/page.tsx` |
| `/` | Dashboard | `src/app/page.tsx` |
| `/products` | Product Manager | `src/app/products/page.tsx` |
| `/changes` | Change Log | `src/app/changes/page.tsx` |
| `/blog` | Blog Publisher | `src/app/blog/page.tsx` |
| `/policies` | Policy Manager | `src/app/policies/page.tsx` |
| `/settings` | Settings | `src/app/settings/page.tsx` |

### Navigation
Left sidebar (always visible, 224px wide):
- 📊 Dashboard
- 📦 Products
- � Change Log
- �📝 Blog
- 📋 Policies
- ⚙️ Settings
- User display (first name from email) + Logout button

### Chat Panel
Available on every page via floating 💬 button (bottom-right). Opens as a 480px fixed right panel. Contains its own thread sidebar and full chat interface with voice input, file attachments, message queueing, and thinking indicator.

---

## 9. The AI Chatbot (v2 Core Feature)

### How It Works

1. **Scott or Anna types a message** (or uses voice input, or queues while streaming)
2. **System prompt is assembled** via `buildLiveContext()` — injects identity, self-awareness, brand rules, store memory, recent changes, tag taxonomy, cost tracking, and 14 behavioral rules
3. **Last 20 messages** from the thread are included as conversation history
4. **Attachments processed** — images converted to base64 for Claude vision, files converted to text content
5. **Claude processes** with `tool_use` enabled, seeing 15 available tools
6. If Claude wants to use a tool:
   - SSE sends `tool_start` event → UI shows ⏳ indicator + "Working on it — using {tool}..."
   - Server executes the tool (reads/writes Shopify/Supabase)
   - SSE sends `tool_result` event → UI shows ✅ indicator
   - Claude sees the result and may call more tools (up to 10 iterations)
7. When Claude responds with text:
   - SSE sends `text` events → UI streams the response with ▌ cursor
8. After completion:
   - Messages saved to thread in Supabase
   - Cost tracked (input + output tokens × rate)
   - `extract-learnings` called async to mine new facts
   - SSE sends `done` event → UI reloads final thread state

### What Anna Can Ask

**Read operations:**
- "How's the store looking?" → calls `get_store_stats`
- "Show me products without SEO" → calls `fetch_products` with filter `no-seo`
- "How many Ravensburger products do we have?" → calls `fetch_products` with filter `by-vendor`
- "List our collections" → calls `fetch_collections`
- "What changes have been made?" → calls `read_change_log`
- "Look up this product on the web" → calls `search_web`

**Write operations:**
- "Tag all Pre-K products with Age:3-5" → calls `fetch_products` then `tag_product` for each
- "Fix the vendor on product X" → calls `update_product`
- "Generate SEO for product X" → calls `generate_seo` then `update_product`
- "Classify the Klutz products" → calls `classify_product` then `tag_product`
- "Write and publish a blog post about math curriculum" → calls `publish_blog`
- "Create a collection for all Grade:3rd products" → calls `create_collection`
- "Create a metafield definition for Product Information" → calls `create_metafield_definition`
- "Set the collapsible text for this product" → calls `update_metafields`

**Undo operations:**
- "Undo that" → calls `undo_changes` (undoes most recent change)
- "Undo the last 5 changes" → calls `undo_changes` with count=5
- "Undo everything you did to that puzzle" → calls `undo_changes` with productId
- "Those tags are wrong, put them back" → calls `undo_changes`

**Memory operations:**
- "Remember that Book:Classics maps to Grade:9th-12th" → calls `remember`
- Any preference Anna states is auto-extracted and saved after the conversation

**Image/file operations:**
- Paste a screenshot of a product page → Claude analyzes it visually
- Upload a CSV of products → Claude parses and offers to bulk-process

### Auto-Learning (Extract-Learnings)

After each conversation, the system:
1. Takes the last 6 messages
2. Sends them to Claude with an extraction prompt
3. Claude identifies concrete, actionable facts Anna stated
4. Each fact is saved to `ncho_store_memory` with a category
5. On the next conversation, all memories are injected into the system prompt

This means the chatbot gets smarter over time. Anna says "I prefer Ravensburger for puzzles" once → it's remembered forever.

---

## 10. Supabase Database

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
| user_id | UUID | NULL | Supabase Auth user ID — per-user thread isolation |
| created_at | TIMESTAMPTZ | `now()` | |
| updated_at | TIMESTAMPTZ | `now()` | Updated on every message |

**Indexes:**
- `idx_ncho_chat_threads_updated` on `updated_at DESC`
- `idx_ncho_chat_threads_user` on `user_id`

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

## 11. Shopify Integration

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
All **24 read-only scopes** plus the following **write scopes** are granted:

| Write Scope | Enables |
|---|---|
| `write_products` | Updating SEO, descriptions, tags, vendors, product types, metafields, collections via chatbot and SEO tool |
| `write_content` | Publishing blog posts and pushing policies to Shopify pages |
| `write_publications` | Publishing products to sales channels |

### GraphQL Mutations Used
1. **`productUpdate`** — Updates product fields (title, handle, description, SEO, tags, vendor, productType, category). Used by `update-product-seo` API route and `tag_product`/`update_product` chat tools.
2. **`productVariantsBulkUpdate`** — Updates variant-level fields (compareAtPrice). Used by `update_product` chat tool when clearing or setting compare at price.
2. **`collectionCreate`** — Creates smart or manual collections. Used by `create_collection` chat tool.
3. **`metafieldDefinitionCreate`** — Creates store-level metafield definitions. Used by `create_metafield_definition` chat tool.
4. **`articleCreate`** — Publishes blog articles. Used by `publish_blog` chat tool.

---

## 12. Brand Rules (Enforced in Code)

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

## 13. What's Done

### v1 Features (Complete & Deployed)
- [x] Shopify API authentication (client credentials grant, auto-refresh)
- [x] GraphQL client with retry logic and pagination
- [x] Dashboard with store health stats, SEO progress, policies status, quick actions, collections
- [x] Product listing with search and filter
- [x] SEO modal with AI generation (Claude) and save-to-Shopify
- [x] Blog publisher with AI generation (topic + keywords → full post) + publish to Shopify
- [x] Policy viewer with 5 pre-written policies, live/not-set status, copy to clipboard
- [x] Settings page with connection diagnostics
- [x] Pink/sky/emerald UI theme throughout

### v2 Features (Complete & Deployed)
- [x] Supabase integration (5 tables created, lazy client, all CRUD)
- [x] AI chatbot with streaming SSE
- [x] 16 chatbot tools (stats, fetch, collections, tag, update, changelog, remember, SEO, classify, search_web, publish_blog, update_metafields, create_collection, create_metafield_definition, undo_changes, generate_description)
- [x] Agentic tool loop (up to 10 iterations per message)
- [x] Thread management (create, list, rename via double-click/pencil, delete)
- [x] Auto-thread titling from first message
- [x] Store memory (auto-learn + manual remember)
- [x] Change log (before/after audit trail)
- [x] Cost tracking (tokens + USD per operation)
- [x] Extract-learnings (async post-conversation fact mining)
- [x] Brand-aware system prompt with live context injection + full self-awareness
- [x] In-memory product cache with invalidation
- [x] Chat panel UI with thread sidebar, streaming, tool indicators
- [x] Suggestion chips for empty state
- [x] Sync button for manual cache refresh
- [x] Image paste + file upload (Claude vision for screenshots, text extraction for CSV/JSON/TXT)
- [x] Web search tool (DuckDuckGo + URL fetch for product research)
- [x] Blog publishing tool (via chatbot → Shopify `articleCreate`)
- [x] Metafield read/write support (product collapsible sections)
- [x] Standard Product Category (taxonomy GID) support
- [x] Product title field in update_product tool
- [x] Collection creation tool (smart + manual with rules)
- [x] Metafield definition creation tool (store-level field setup)
- [x] Undo tool — reverses recent tag/SEO/description/title/vendor changes using change log old values
- [x] Change Log page — visual timeline of every AI change, grouped by day, expandable before/after diff, per-entry undo buttons
- [x] Undo API (`/api/undo`) — freshness check against live Shopify values, conflict detection modal, force override option
- [x] Changes API (`/api/changes`) — paginated change log with server-side field/action/product filters

### UX Features (Complete & Deployed)
- [x] Thinking indicator — animated bouncing dots + context-aware status text
- [x] Message queue system — type and send while streaming, auto-sends when done
- [x] Voice input — Web Speech API microphone, live transcript in input field
- [x] Unlocked input during streaming — attach, send/queue, and mic buttons always available
- [x] Stop button — red "■ Stop" button during streaming that aborts the tool loop mid-operation (AbortController + server-side signal check)

### Authentication (Complete & Deployed)
- [x] Supabase Auth with `@supabase/ssr` — cookie-based server sessions
- [x] Login page (email + password)
- [x] `proxy.ts` auth guard (Next.js 16 middleware pattern)
- [x] Per-user thread isolation (user_id on ncho_chat_threads)
- [x] Logout endpoint + UI button
- [x] Two users configured (Scott + Anna)

### Shopify Write Scopes (Enabled)
- [x] `write_products` — product updates, tags, SEO, metafields, collections
- [x] `write_content` — blog publishing, policy pushing
- [x] `write_publications` — product publishing to sales channels

### Infrastructure (Complete)
- [x] Deployed to Vercel at nchocopilot.vercel.app
- [x] GitHub repo at TheAccidentalTeacher/nchocopilot
- [x] Supabase tables created (AI Tutor instance) with auth users
- [x] All env vars configured (local + Vercel)
- [x] Build passes cleanly (0 errors)

---

## 14. What Still Needs to Be Done

### High Priority

| # | Task | Details |
|---|---|---|
| 1 | **Use `ncho_flagged_products` table** | Table is created but no tool writes to it yet. When classification confidence is below threshold, insert a row and surface it in the UI. |
| 2 | **Cost tracking in v1 routes** | The v1 SEO and blog generators call Claude but don't track cost. Wire `trackCost()` into `/api/generate-seo` and `/api/generate-blog`. |
| 3 | **Policy push to Shopify** | Policies are pre-written but need GraphQL mutation to push to Shopify pages. Currently shows a "copy manually" fallback. |

### Nice to Have — Future Improvements

| # | Task | Details |
|---|---|---|
| 4 | **Bulk operations UI** | A dedicated page or chat command for "classify all untagged products" or "generate SEO for all products without it" — with progress tracking. |
| 5 | **Thread pinning in UI** | The `pinned` column exists but the chat UI doesn't expose it. Add a pin toggle that keeps important threads at the top. |
| 6 | **Memory management UI** | A page to view, edit, and delete stored memories. Currently memories can only be viewed in Supabase directly. |
| ~~7~~ | ~~**Change log viewer page**~~ | ~~DONE — shipped as `/changes` page with per-entry undo, freshness checks, conflict detection, filters, pagination.~~ |
| 8 | **Export change log** | CSV export of all changes for Anna's records. |
| 9 | **Custom domain** | Move from `nchocopilot.vercel.app` to a subdomain like `tools.nextchapterhomeschool.com`. |
| 10 | **Product description generator** | The chatbot can update descriptions, but a dedicated UI for bulk description generation (similar to the SEO modal) would be useful. |
| 11 | **Collection SEO** | Collections also need SEO titles/descriptions. Add to both chatbot tools and v1 pages. |
| 12 | **Dark mode** | Currently light-only. Not a priority — Anna uses it in daylight. |
| 13 | **Mobile responsive** | The chat panel is 480px fixed — doesn't work on mobile. Low priority since this is a desktop management tool. |

---

## 15. How to Run Locally

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
- Supabase project with `ncho_` tables (run `supabase-tables.sql`) and Auth users configured

---

## 16. How to Deploy

The app deploys automatically to Vercel on every push to `main`.

### Manual Deploy Process
1. Make changes locally
2. `npm run build` — verify clean build (0 errors)
3. `git add -A && git commit -m "description" && git push`
4. Vercel auto-deploys from GitHub
5. Verify at https://nchocopilot.vercel.app

### Environment Variables on Vercel
All env vars from `.env.local` must also be set in:
**Vercel → nchocopilot → Settings → Environment Variables**

If you add or change an env var, you must **redeploy** for it to take effect (Vercel → Deployments → Redeploy).

---

## 17. Troubleshooting

### "supabaseUrl is required" build error
The Supabase client was created at module import time with empty env vars. This was fixed by converting to a lazy `db()` function. If it ever reappears, ensure `supabase.ts` uses the `db()` pattern (create on first call, not at import).

### Login page loops / can't sign in
1. Check `NCHO_SUPABASE_URL` and `NCHO_SUPABASE_ANON_KEY` are set in Vercel (anon key is needed for the browser-side auth client)
2. Verify the user exists in Supabase Auth (Dashboard → Authentication → Users)
3. Check browser dev tools for specific error messages from Supabase

### Redirected to /login on every page
The `proxy.ts` middleware requires a valid Supabase auth session. If the session cookie is expired or missing:
1. Try logging in again — session auto-refreshes on each request
2. Clear cookies and sign in fresh
3. If using an incognito window, cookies don't persist between sessions

### Chat panel doesn't load / shows errors
1. Check Vercel environment variables are set (all 8)
2. Check Supabase tables exist (run `supabase-tables.sql`)
3. Check browser console for specific error messages
4. If "Supabase not configured" — env vars are missing or empty

### Shopify "Token request failed: 400 Bad Request"
The `getToken()` function does a client_credentials grant to Shopify. A 400 means:
1. **Client secret changed** — Check that `SHOPIFY_CLIENT_SECRET` in Vercel matches the current app secret in Dev Dashboard
2. **App not installed** — Check Shopify Admin → Settings → Apps → Yellow CoPilot is installed
3. **App version issue** — If Scott created a new app version in Dev Dashboard, the old secret may be invalidated. Get the new secret and update Vercel env vars.

### Product writes fail with "Access denied"
Write operations require the correct scopes on the Shopify app. Currently `write_products`, `write_content`, and `write_publications` are enabled. If they were removed during app editing, re-enable them in Dev Dashboard and reinstall.

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
| `2bbdb6d` | Initial commit from Create Next App |
| `89445ec` | v1 scaffolding — Next.js, Shopify integration, dashboard, products, blog, policies, settings |
| `37b5a56` | Restyle UI: pink/sky/emerald airy palette |
| `e8e5ed7` | v2: AI chatbot with agentic tools, persistent memory, streaming chat |
| `d9046e4` | Add comprehensive v2 documentation |
| `7294d60` | Trigger redeploy with Supabase env vars |
| `f45d09a` | Fix: chat panel always-on 50% resizable, fix SSE parser, fix thread loading errors, add search_web tool |
| `0ff619f` | Deep self-awareness: chatbot knows its own architecture, every page, every tool, full tech stack |
| `5c7e22e` | feat: image paste + file upload in chat — Claude vision for screenshots, text content for CSV/JSON/MD/TXT files |
| `8f11884` | feat: enable all write features — blog publish route + UI, publish_blog chatbot tool |
| `1a6df32` | fix: null-check mutation responses to prevent userErrors crash |
| `bf5d631` | feat: thread rename (double-click, pencil icon, auto-title on first message) |
| `c72a6ec` | fix: switch fetchPolicies from broken GraphQL to REST API |
| `140d5cc` | Add title field to update_product tool |
| `e5bbfe3` | Add Standard Product Category (taxonomy) support to update_product tool |
| `c96b126` | Add metafield read/write support for product collapsible sections |
| `39e2d1f` | Add Supabase Auth — login page, proxy protection, per-user threads |
| `06dc73c` | feat: add create_collection tool (smart + manual collections) |
| `6da0058` | feat: thinking indicator, unlocked input during streaming, voice input mic button |
| `b850c47` | feat: add create_metafield_definition tool (store-level metafield setup) |
| `0fc2f99` | docs: comprehensive documentation update — fix tool count (10→14), add publish_blog, fix stale scope refs, rewrite README |
| `e8f2e5b` | feat: stop button + undo_changes tool — interrupt mid-operation, reverse wrong changes |
| `950204d` | feat: Change Log page — visual timeline with per-entry undo, freshness checks, conflict detection |

**Total codebase:** ~6,200+ lines of application code across 39 source files.

# NCHO Tools

AI-powered Shopify store management for **Next Chapter Homeschool Outpost**.

Live: [nchocopilot.vercel.app](https://nchocopilot.vercel.app)

## What It Does

An internal tool built for Anna (and Scott) to manage the NCHO Shopify store through an AI chatbot and dedicated pages. The chatbot can read products, generate SEO, classify/tag products, write blog posts, create collections, manage metafields, and research products on the web — all through natural language.

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16.1.7 (App Router, TypeScript, Tailwind v4) |
| AI | Claude Sonnet 4.6 (Anthropic SDK) |
| Database | Supabase (PostgreSQL) — threads, memory, change log, cost tracking |
| Auth | Supabase Auth (`@supabase/ssr`) — cookie-based sessions |
| Shopify | Admin API 2026-01, client credentials grant |
| Hosting | Vercel (auto-deploy from `main`) |

## Pages

- **Dashboard** — Store health cards (product count, SEO coverage, vendor issues, collections, blog count)
- **Products** — Product table with SEO generation modals
- **Change Log** — Visual timeline of every AI change with per-entry undo, freshness checks, conflict detection, filters, pagination
- **Blog** — AI blog post generator + publish to Shopify
- **Policies** — Pre-written store policies (copy or push to Shopify)
- **Settings** — Shopify connection status + active scopes
- **Chat** — AI chatbot with 15 tools, streaming, vision, voice input, file attachments, stop button, undo

## Setup

```bash
npm install
cp .env.example .env.local   # fill in env vars
npm run dev                   # http://localhost:3000
```

### Required Environment Variables

```
SHOPIFY_STORE_URL=next-chapter-homeschool.myshopify.com
SHOPIFY_API_VERSION=2026-01
SHOPIFY_CLIENT_ID=...
SHOPIFY_CLIENT_SECRET=...
ANTHROPIC_API_KEY=...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NCHO_SUPABASE_ANON_KEY=...
```

## Documentation

See [DOCUMENTATION.md](DOCUMENTATION.md) for the complete technical reference — architecture, file-by-file breakdown, API routes, tool specs, and deployment details.

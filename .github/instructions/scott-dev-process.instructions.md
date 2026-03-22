---
description: "Scott Somers' personal development methodology — the Dream Floor process. Applies to all code in all repos. Read this before writing a single line."
applyTo: "**"
---

# Scott Somers — Development Methodology
*The Dream Floor Process. Distilled from 92 Q&A sessions, March 18, 2026.*

This is how Scott builds. This is not a suggestion list. This is the process.

---

## The Cardinal Rule: Think Before You Build

No code gets written until the thinking is done. Every significant feature passes through the following sequence. Skipping steps produces code that has to be ripped out.

### Step 1: Pre-Flight Reading

Before touching any file in a repo, read all context that exists for it:
- The `CLAUDE.md` in the repo root (if present)
- The `.github/copilot-instructions.md` (or the email workspace equivalent)
- Any `intel/` files that reference this repo or feature
- The existing DB schema (all migrations, not just the latest)
- The API route(s) that the feature will touch

**Do not assume you know the codebase. Read it.**

### Step 2: Known Issues Inventory

Before adding new features, triage what exists:
- **Fix immediately** — anything that blocks the feature you're about to build
- **Triage** — broken things that need a note/comment but don't block
- **Leave alone** — unrelated broken things; note with a `// TODO:` comment only

Do not touch broken things that aren't in scope. Note them. Move on.

### Step 3: Lock Architecture Before Coding

Architecture decisions get made once and documented. The coder implements — it does not redesign. If a decision is wrong, stop and surface it before writing code, not after.

Format for a locked decision:
```
**Decision**: [what was decided]
**Why**: [the actual reason — not "best practice"]
**Not**: [the alternative that was rejected and why]
```

### Step 4: Write the Implementation Spec First

For any non-trivial feature, the spec comes before the code:
- Phase-by-phase breakdown
- Every phase has: what gets built, what DB changes are required, what the verification step is
- Exact SQL migration patterns for schema changes
- Explicit note on what existing code is preserved vs. replaced

The spec is the brief. The coder executes from the brief.

---

## Non-Negotiable Security Gates

These are checked before any feature ships. No exceptions.

### Student Data Protection
- ALL student content routes through `src/lib/ai/student-safe-completion.ts` — no direct SDK calls
- No Groq, no consumer AI products with student content — Anthropic API, OpenAI API, Azure AI only
- Anonymize before every AI call — no names, no `child_id`, no PII in prompts
- Children under 13 cannot self-register — parent creates account → child profile → child login

### Multi-Tenancy
- `user_id UUID REFERENCES auth.users(id) NOT NULL` on every new table, every time, no exceptions
- RLS policy on every new table: `USING (auth.uid() = user_id)`
- The migration pattern for existing tables:
```sql
ALTER TABLE [table_name] ADD COLUMN user_id UUID REFERENCES auth.users(id);
-- Backfill: set all existing rows to the primary user's user_id
-- Update existing RLS policies to: USING (auth.uid() = user_id)
```

### SSRF Prevention
- All server-side URL fetching must validate against an allowed domain list OR implement SSRF protection
- Never allow arbitrary requests to internal network addresses (169.254.x.x, 10.x.x.x, 172.16-31.x.x, 127.x.x.x)
- URL validation before any `fetch()` call in an API route

### Prompt Injection Defense
- Scan user inputs for data exfiltration patterns and privilege escalation attempts before passing to any AI
- Check both the user's original prompt AND generated tool arguments
- Log governance violations — never silently drop them

### No Secrets in Code
- Environment variables only — never hardcoded keys, tokens, or credentials
- `.env.local` is the floor. Production secrets go in Railway/Vercel env vars, never in code.

---

## Legacy Code Rules

When you encounter legacy code:
1. **Do not delete it** — mark with a comment: `// LEGACY: [what it does] — [why it's deprecated] — architecture reference only`
2. **Do not build new features on it** — use it to understand the pattern, build the new thing fresh
3. **Document what was migrated and where** — "The Curriculum Factory has been migrated to SomersSchool/CoursePlatform"

If code is marked LEGACY in a CLAUDE.md or comment, read it for architecture patterns only. Do not extend it.

---

## Database Migration Discipline

Every schema change:
- Gets its own migration file with a timestamp prefix
- Includes the backfill step for existing rows (never leave null where NOT NULL is the eventual state)
- Includes the RLS policy update if the table has multi-tenant requirements
- Is backward-compatible — the app must still run on the old schema until the migration is applied

Never run destructive migrations (DROP COLUMN, DROP TABLE) without an explicit instruction from Scott. Propose them. Don't execute them.

---

## Streaming & API Architecture

- SSE over WebSockets for all streaming. Always.
- Typed SSE events, not raw text chunks:
  ```
  { type: "text", delta: "..." }
  { type: "tool_start", name: "...", input: {...} }
  { type: "tool_result", name: "...", output: {...} }
  { type: "council_turn", persona: "Gandalf", delta: "..." }
  { type: "done" }
  ```
- Every streaming upgrade must be backward-compatible — unrecognized event types fall back gracefully
- Context/system prompts belong in the DB (`context_files` table pattern), not hardcoded in route files
- API Keys scope: ElevenLabs keys are scoped per project — never reuse a key across products

---

## The Batch Size Law

When an agent task fails, the first question is: **"Is this batch too large?"**

Cut the batch in half before changing the prompt. If it still fails with a smaller batch, then change the prompt.

This applies to:
- AI generation loops (curriculum, briefs, research)
- DB migration runs
- Worker job dispatches
- Any multi-file refactor

---

## Backward Compatibility

The app ships to real users (Scott, Anna, students). Breaking changes need a migration path:
- Never remove a DB column — mark as deprecated, migrate data, then remove in a second pass
- Never change an API response shape without versioning or a fallback
- Never rename a Supabase table without a migration that handles the rename atomically

---

## Context Architecture

- System prompts and AI context documents belong in the DB, not in route files
- The pattern is `context_files` table → `buildLiveContext()` → system prompt
- Editing AI behavior happens through the UI or DB, not through deploys
- Context depth is the highest-ROI improvement to any AI feature — the brief AI knowing Scott's actual business is more valuable than any new feature

---

## Anti-Hallucination Standard

For any AI output that makes factual claims (Intel briefs, research summaries, opportunity analysis):
- Every factual claim must be traceable to a source URL
- Claims that can't be traced get flagged with ⚠️, not silently included
- This is non-negotiable — a hallucinated competitor metric is worse than no metric

---

## The Dream Floor Rule

The `email` workspace (`WEBSITES/email/`) is the strategy and planning floor. It is not the build floor.

- **Do** use it for: strategy, research, brainstorming, documentation, decision logging, context preservation, Council sessions
- **Do not** use it for: implementation work on other repos, scaffolding, migrations, shipping features

When work needs to happen in a repo, open that repo in VS Code and build there. Keep the thinking and the building in their own lanes.

---

## Council of the Unserious — When to Invoke

For architecture decisions, product direction, or curriculum design — run the full Council:

1. **Gandalf** — creates from zero, frames the approach
2. **Data** — audits, finds gaps, asks the devastating question
3. **Polgara** — finalizes, makes it serve the actual child/user
4. **Earl** — cuts it to what ships Tuesday
5. **Beavis & Butthead** — stress-tests it against a real kid in a real chair

For routine coding tasks (bug fix, adding a column, wiring a webhook) — skip the Council. Ship it.

---

## Repo-Specific Context

This instruction applies globally. Each repo also has its own `CLAUDE.md` with repo-specific rules. When there's a conflict, the repo's `CLAUDE.md` wins for that repo.

Hot repos and their primary concerns:
- **CoursePlatform** — COPPA compliance, student data protection, Alaska allotment legality, SomersSchool secular content requirement (Alaska Statute 14.03.320)
- **NextChapterHomeschool (ClassCiv)** — 29-table schema, 11-phase epoch FSM, real students in Scott's classroom, no breaking changes during active school use
- **Chapterhouse** — Scott + Anna only, private, no student data, Groq approved here
- **BibleSaaS** — personal use first, no social graph, privacy-first, beta before commercial
- **roleplaying** — ElevenLabs scoped keys, DALL-E image generation, Babylon.js physics

---

*Last updated: March 19, 2026. Distilled from chapterhouse-brainstorm-interview.md, chapterhouse-implementation-spec.md, and chapterhouse-vs-dreamfloor.md.*

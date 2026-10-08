# Frontpage Roadmap

> **For agentic workers:** This is the master plan. It fixes the architecture, data model and phase boundaries for the whole product. Each phase gets its own bite-sized TDD plan (`docs/plans/YYYY-MM-DD-phase-N-*.md`), written right before that phase starts so its code is grounded in what earlier phases actually shipped. Phase 1 is already written: `2026-10-08-phase-1-foundation.md`.

**Goal:** Ship Frontpage, a full-stack RSS/Atom reader with real auth, a one-click guest mode, a digest view, layout customization, accessibility-first reading prefs and AI summaries, deployed on Vercel.

**Architecture:** One Next.js 16 App Router app. Server Components read from Postgres via Prisma 7. Mutations go through Server Actions. Feeds are fetched and parsed server-side by a pure TypeScript library (`src/lib/feeds/`) that is unit-tested with `node --test`. Feeds and items are global, shared rows keyed by feed URL. Per-user data (subscriptions, categories, read/saved state, prefs) points at them. Guests are Better Auth anonymous users seeded with the 19 curated feeds.

**Tech Stack:** Next.js 16 · React 19 · TypeScript · Tailwind v4 · Prisma 7 + `@prisma/adapter-pg` · Postgres (Postgres.app locally, Neon in prod) · Better Auth (email+password, anonymous plugin) · htmlparser2/domutils/entities · sanitize-html · zod · lucide-react · @dnd-kit · cmdk · @anthropic-ai/sdk · Resend · pnpm · Vercel.

**Spec:** `spec/core-requirements.md`, `spec/design-challenges.md`, `spec/technical-requirements.md`, `spec/differentiators.md`, `guidance/*.md`, `data/README.md` (all inside `RSS-feed-reader/`).

**Scope chosen by the user (2026-10-08):** full-stack path, Better Auth, all 12 Core + 6 Stretch features, design challenges **Digest view** and **Layout customization**, and differentiators **AI summarization** and **Accessibility-first reading**. Design challenge 1 (onboarding) is not in scope. Its cold-start part is covered by a minimal empty state with starter packs (Phase 4) because a signed-up user would otherwise land on a blank page.

## Global Constraints

- App lives in `RSS-feed-reader/` on branch `rss-feed-reader` (worktree `/Users/elshanx/dev/projects/fem-rss-feed-reader`). The challenge reference files (`spec/`, `guidance/`, `AGENTS.md`, `CLAUDE.md`, `README-template.md`, `preview.jpg`, `data/README.md`) are git-ignored by the starter `.gitignore`. Keep it that way.
- Mirror `todo-app/` conventions: pnpm, Prisma 7 with `prisma-client` generator → `src/generated/prisma`, `src/lib/db.ts` singleton with `PrismaPg`, `src/lib/env.ts` zod-validated env, airbnb-extended ESLint + Prettier (single quotes, JSX single quotes, width 100, trailing comma es5), `@/*` → `src/*`.
- **Next 16 is not the Next.js in your training data.** Before writing route/cache/proxy code, read the relevant guide in `node_modules/next/dist/docs/`. `middleware.ts` is now `proxy.ts`. `cookies()`, `headers()`, `params` and `searchParams` are async.
- Tests: `node --test 'src/**/*.test.ts'` on Node 24 (native type stripping). Every module a test imports, directly or transitively, must use **relative imports with `.ts` extensions** (no `@/` alias), **`import type`** for type-only imports, and no TS-only runtime syntax (`enum`, `namespace`, parameter properties).
- No code comments unless the *why* is non-obvious. No `any`. ES modules only. Destructured imports.
- Feed fetches: 10-second timeout per feed, follow at most 5 redirects, update stored URL only on 301/308, body cap 5 MB, block private/loopback/link-local addresses (SSRF).
- Brand tokens come from `starter/tokens.css` with these **contrast fixes** (the stock values fail WCAG AA for small text): light `--color-text-tertiary: #656d76` (4.98:1 on bg-secondary), light `--color-warning: #a16207`, light `--color-success: #15803d`, dark `--color-text-tertiary: #848d97` (4.52:1 on bg-tertiary). Record this in the README.
- Badge counts cap at `99+`. Touch targets ≥ 44×44 px on coarse pointers. Status never uses color alone.
- AI: `@anthropic-ai/sdk`, model `claude-opus-5-5` at `output_config.effort: 'low'`, with server-side refusal fallback (`betas: ['server-side-fallback-2026-07-01']`, `fallbacks: 'default'`). Every AI feature must degrade to a hidden/disabled control when `ANTHROPIC_API_KEY` is unset.

## Review Focus

1. **Hostile or broken feed input**: truncated XML, HTML served as a feed, a 50 MB body, a redirect loop, a `localhost` URL. The user should see a specific error, and nothing should crash or hang past 10 s. Owned by Phase 1 Tasks 5–6.
2. **Script injection via feed content**: `<script>`, `onerror=`, `javascript:` links in item HTML or titles must never execute in reader view or lists. Owned by Phase 1 Task 4 (sanitizer tests) and Phase 3 (titles render as text, never as HTML).
3. **Guest → account upgrade loses data**: a guest who marks items read, saves some, then signs up should keep all of it. Owned by Phase 2 (link hook test via a manual verification script).
4. **One user's data leaking to another**: every Server Action must scope by `session.user.id`, including an `itemId` the user isn't subscribed to. Owned by every phase. Each action file gets a review checklist line.
5. **Mark-all-read on 1,000+ items, and unread counts with 100 feeds**: must be single SQL statements, not N queries. Owned by Phase 3.

---

## Data Model (Prisma, final shape; Phase 1 creates the first migration)

```
Feed           id, url @unique, title, siteUrl?, description?, iconUrl?, etag?, lastModified?,
               lastFetchedAt?, lastSuccessAt?, latestItemAt?, failCount=0, lastError?, lastErrorStatus?,
               errorPermanent=false, nextFetchAt=now()
Item           id, feedId→Feed(cascade), guid, url?, title, author?, excerpt, contentHtml?, imageUrl?,
               publishedAt, createdAt, aiSummary? (Phase 9), search tsvector (Phase 5)
               @@unique([feedId, guid])  @@index([feedId, publishedAt desc])
Category       id, userId→User(cascade), name, position   @@unique([userId, name])
Subscription   id, userId→User(cascade), feedId→Feed(cascade), categoryId?→Category(SetNull), title?, createdAt
               @@unique([userId, feedId])  @@index([userId, categoryId])
ItemState      userId→User(cascade), itemId→Item(cascade), readAt?, savedAt?
               @@id([userId, itemId])  @@index([userId, savedAt])
Preference     userId @id →User(cascade), layout='comfortable', refreshMinutes=30, readerFont='serif',
               readerSize=18, readerLeading=1.7, readerMeasure=68, digestSeenAt?   (Phase 7/8 add columns)
User/Session/Account/Verification  — Better Auth tables (+ isAnonymous)
```

Answers to the spec's database questions, so they make it into the README:

- **Indexes:** `Item(feedId, publishedAt desc)` serves feed, category and "all" views because those resolve to a set of `feedId`s. Category views join through `Subscription(userId, categoryId)`. Date ranges ride the same index.
- **Deleting a feed (unsubscribe):** deletes the `Subscription` and that user's `ItemState` rows for the feed **where `savedAt` is null**, so bookmarks survive. Feeds with zero subscribers are deleted by the daily maintenance cron, which cascades to items and states.
- **Volume / unbounded growth:** only items a user has touched get an `ItemState` row. The maintenance cron deletes items older than 90 days that nobody has saved, and states cascade with them, so the table is bounded by roughly 90 days × feeds × users.
- **When to fetch:** on demand, stale-while-revalidate. Page loads schedule `after()` refreshes for the user's feeds whose `nextFetchAt` has passed. A daily cron (the Vercel Hobby limit) keeps guest feeds warm.
- **Dedup:** the key is `(feedId, guid)`. `guid` = RSS `<guid>` / Atom `<id>`, else the link, else `sha1(title + date)`. On re-fetch the first stored version wins (`createMany skipDuplicates`). Edited content isn't re-synced. That's a documented tradeoff that keeps refresh cheap.
- **Concurrency:** read/save writes are idempotent upserts with explicit timestamps. Other tabs pick up changes via `router.refresh()` on `visibilitychange`.

## Route Map

```
/                         landing (Phase 10; stub in Phase 1)
/sign-in /sign-up /forgot-password /reset-password      (Phase 2)
/app                      all items; ?category=<id> | ?feed=<id> | ?show=unread      (P1 stub → P3)
/app/item/[id]            reader view (P3)
/app/saved                bookmarks (P5)
/app/search               search (P5)
/app/digest               digest (P7)
/app/feeds                manage feeds + categories + health dashboard + OPML (P4/P5)
/app/settings             layout, refresh interval, reading prefs, theme (P6–P8)
/accessibility            accessibility statement (P8)
/api/auth/[...all]        Better Auth (P1)
/api/opml                 OPML export (P5)
/api/cron/maintenance     daily: refresh due feeds, purge guests >24h, orphan feeds, items >90d (P2/P6)
```

`proxy.ts` redirects requests under `/app` that have no session cookie to `/sign-in` (Phase 2). Layouts also verify the session server-side. The proxy is only an optimistic check.

---

## Phases

Each phase ends with a verifiable deliverable: tests green, `pnpm lint && pnpm typecheck && pnpm build` clean, and a browser check of the listed behaviors. Commit per task, open a PR per phase into `main`.

### Phase 1: Foundation (detailed plan written)
Scaffold, feed library (dates, encoding, sanitize, parse RSS 2.0/Atom/RDF, fetch with SSRF guard/timeout/redirects/conditional GET, health + backoff), Prisma schema, refresh service, Better Auth with anonymous guests seeded from `data/sample-feeds.json`, and a bare `/app` item list.
**Covers:** Core 2 (fully), Core 8 (classification/backoff logic), Core 11 (guest seeding), Core 12 (schema), Tech req. "Server-side feed fetching".

### Phase 2: Accounts
- Sign up / sign in / sign out forms (labels, `aria-describedby` errors, values preserved on error).
- Password reset: Better Auth `sendResetPassword` sends via Resend. In dev, with no `RESEND_API_KEY`, log the link to the server console. **Caveat:** a Resend sandbox sender only delivers to the account owner's address, so production needs a verified domain. Document this in the README.
- `proxy.ts` protection plus a server-side session check in `app/app/layout.tsx`.
- Guest → account: anonymous plugin `onLinkAccount({ anonymousUser, newUser })` moves categories, subscriptions, item states and preference rows to `newUser.user.id` in one transaction. Merge on unique conflicts.
- Guest banner: a dismissible "Your reading list disappears in 24 h — create a free account to keep it" bar plus a sign-up CTA in the sidebar footer. Never block an action.
- `/api/cron/maintenance` (guarded by `CRON_SECRET`) deletes anonymous users older than 24 h. `vercel.json` cron runs daily.
**Covers:** Core 9, Core 11 (prompts, session scope, messaging).

### Phase 3: Reading core
- App shell: sidebar (All, Digest, Saved, Search, categories with nested feeds and unread counts, health summary), collapsible on desktop, drawer on mobile, skip link, `aria-current`.
- Item list: cursor pagination over `(publishedAt, id)` in pages of 50, an IntersectionObserver sentinel, and `content-visibility: auto` on rows instead of a virtualization library. Skeleton rows match the real row height.
- Item row: favicon (monogram fallback), title, source, relative time with full date in `title`/`<time dateTime>`, excerpt. Unread uses dot + weight + sr-only "Unread".
- Read state: open marks read, `m`-style toggle button, `useOptimistic`. Mark all read per feed/category/global is one `INSERT … SELECT … ON CONFLICT` with a 5 s undo toast (`aria-live`).
- Unread counts: one grouped SQL query per request.
- Reader view `/app/item/[id]`: sanitized `contentHtml` in Georgia at `--content-max-width`, metadata, "Open original" link, prev/next within the current list context (`?from=` carries the filter). Excerpt-only items show the excerpt plus a prominent "Read on <site>" link.
- Responsive pass, 200% zoom, no horizontal scroll, responsive images/`pre` overflow.
**Covers:** Core 3, 5, 6, 7.

### Phase 4: Feeds & categories
- Add feed: URL input → server action validates by fetch + parse, then shows title, description and icon. If the URL is an HTML page, discover `<link rel="alternate" type="application/rss+xml|atom+xml">` and use that.
- Edit custom title and category, and remove with confirmation (native `<dialog>`).
- Categories: create/rename/delete (feeds go to Uncategorized), reorder with dnd-kit plus keyboard-accessible up/down buttons, and a virtual "Uncategorized" group.
- `/app/feeds` health dashboard: counts by status (active/stale/error/dead) with icon + text, last successful fetch, last error in plain language, and a Retry button (forced refresh with a 60 s minimum interval).
- Empty state for new accounts: starter packs (the 5 curated categories, one click each), "Import OPML" and "Add a feed URL".
**Covers:** Core 1, 4, 8 (UI parts).

### Phase 5: Bookmarks, search, OPML
- Save/unsave from list and reader. `/app/saved` sorts by saved/published, filters with search, and shows a count in the nav.
- Search: a generated `tsvector` column (title weight A, excerpt weight B) with a GIN index via a raw SQL migration, queried through `$queryRaw`, prefix-matching the last term, scoped to the user's subscriptions, filterable by feed, category and date range. Highlights use `ts_headline`, rendered by splitting on sentinel markers (never as raw HTML). Requests are debounced at 200 ms. Recent searches live in `localStorage`.
- OPML import: parse with htmlparser2 (lowercased attribute names, so `xmlurl` works). Flatten nested outlines into a `Parent / Child` category name. The preview flags duplicates (in-file and already subscribed) and validates each URL with concurrency 4. The result reads "X added, Y duplicates skipped, Z invalid". Must handle `data/sample-feeds.opml` exactly as `data/README.md` describes (19 valid, 1 dead, dupes flagged).
- OPML export at `/api/opml`, grouped by category.
**Covers:** Stretch 13, 14, 15.

### Phase 6: Refresh & polling
- "Refresh all" and per-feed refresh actions run concurrency-6 pools via `after()`, with a non-blocking progress indicator and `aria-live` completion.
- Refresh interval pref: 15/30/60 min or manual. The client polls a lightweight `newItemCount(since)` action on that interval and on focus, then shows a "5 new items" banner that inserts them without moving the scroll position.
- ETag/Last-Modified support already exists (Phase 1). This phase surfaces "Last updated".
- The maintenance cron also refreshes due feeds and purges orphan feeds and old items.
**Covers:** Stretch 16, Core 8 (manual retry wiring).

### Phase 7: Layouts + Digest (design challenges)
- **Layouts**, a global preference with a toolbar segmented control (`radiogroup`):
  - *Compact*: one line, no excerpt or image. For triage.
  - *Comfortable* (default): title, two-line excerpt, meta, and a small right thumbnail when one exists. Reasoning: it serves both the scanner and the reader, and it degrades well when there's no image.
  - *Cards*: an image-led grid. Items without an image get a tinted panel with the source favicon and name, so no grid cell is ever blank.
  - Split pane: on wide viewports (≥ 75rem), Compact and Comfortable open the reader in a right pane instead of navigating.
  - Per-category layouts are deliberately out. The reasoning (one mental model, less settings sprawl) goes in the README.
- **Digest** `/app/digest`, a separate view:
  - Window: "Since last digest" (the default, from `Preference.digestSeenAt`, falling back to 24 h), "Today", or "This week".
  - Ranking: score = recency decay × source rarity (`1 / log2(2 + feed's items in the last 7 days)`), capped at 2 items per feed so high-volume feeds like HN don't dominate, then grouped by category with the top 5 each and "N more" linking to the filtered list.
  - Quiet days (fewer than 8 items) show everything in a flat list with a "That's everything" note. Busy days keep the caps.
  - The "Done — mark these read" action marks the shown items read and sets `digestSeenAt`.
  - Phase 9 adds the AI briefing paragraph on top.
  - Ranking is a pure function `rankDigest(items, now)` with unit tests.
**Covers:** Design challenges 2 and 3.

### Phase 8: Accessibility-first reading + keyboard
- Settings: reader font (Georgia / Inter / Atkinson Hyperlegible / OpenDyslexic, self-hosted, loaded only when selected), size 16–24, line height 1.4–2.0, measure 55–80ch, with a live preview. Stored in `Preference` and applied as CSS custom properties on the reader.
- Themes: light / dark / system / high-contrast (AAA tokens, ≥ 7:1) via next-themes. Honor `prefers-contrast: more` when set to system.
- Global reduced motion: a CSS rule under `prefers-reduced-motion` plus an explicit "Reduce motion" pref that sets `data-reduce-motion`.
- Live region announcer (`useAnnounce()`) for refresh results, mark-all-read and new items.
- `/accessibility` statement page, the `guidance/accessibility.md` checklist audited and ticked, and a VoiceOver pass recorded in the README.
- Keyboard: `j/k`, `o`/Enter, `s`, `m`, `g h` / `g s` / `g f`, `/`, and `?` (shortcut sheet in a `<dialog>`). Keys are ignored while focus is in inputs. The selected item gets `aria-selected` plus a visible ring and `scrollIntoView({ block: 'nearest' })`. `cmdk` command palette on ⌘/Ctrl-K: go to category or feed, search, change layout, refresh all.
**Covers:** Differentiator 5, Stretch 18.

### Phase 9: AI summarization
- `summarizeItem(itemId)` server action: if `Item.aiSummary` exists, return it. Otherwise send the article text (sanitized HTML → text, full length) to `claude-opus-5-5` with effort `low`, a system prompt asking for 2 short paragraphs, plain text, no preamble, and fallback enabled. Store the result on `Item`, so it's shared across users and costs one call per item ever.
- Digest briefing: one call per user per digest window, over the top ~20 titles and excerpts, producing a 3–5 sentence "what happened" paragraph cached in a `DigestBriefing(userId, windowKey)` row.
- Guardrails: per-user daily cap (guests 5, accounts 50) tracked in a table, and typed error handling (`Anthropic.RateLimitError` → "Try again in a minute", `APIError` → hide quietly). Check `stop_reason === 'refusal'` before reading content. The UI shows a skeleton while generating and labels output "AI summary".
- Cost note for the README: summaries are cached per item, so cost scales with distinct items opened, not views. Switching to `claude-haiku-5-5` is a one-line change if cost matters. That's the user's call.
**Covers:** Differentiator 1 (summaries + highlights digest). Auto-tagging and natural-language search are out of scope.

### Phase 10: Landing, polish, deploy
- Landing: hero with the value prop, a product screenshot (static `next/image`, `priority`), 4 feature highlights, and dual CTAs (Sign up / Try as guest, equal prominence). No client JS beyond the guest button.
- SVG favicon, per-route `<title>`, OG image.
- Performance: Lighthouse on the deployed URL (targets Perf > 85, A11y > 90, BP > 90), CLS check, lazy images.
- Deploy: Neon Postgres, Vercel env (`DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `RESEND_API_KEY`, `ANTHROPIC_API_KEY`, `CRON_SECRET`), `vercel-build: prisma migrate deploy && next build`.
- README from `README-template.md`: decisions above, design-challenge write-ups, differentiators, Lighthouse scores, contrast-fix note, AI cost note.
**Covers:** Core 10, Stretch 17, Tech req. deployment.

## Spec Coverage Check

| Spec item | Phase |
|---|---|
| Core 1 Feed management | 4 (health fields from 1) |
| Core 2 Parsing | 1 |
| Core 3 Browsing | 3 |
| Core 4 Categories | 4 |
| Core 5 Read/unread | 3 |
| Core 6 Article view | 3 |
| Core 7 Responsive | 3, then every phase |
| Core 8 Error handling | 1 (logic), 4 (UI), 6 (retry/backoff wiring) |
| Core 9 Auth | 2 |
| Core 10 Landing | 1 (stub), 10 |
| Core 11 Guest | 1 (seed), 2 (messaging/expiry) |
| Core 12 Persistence | 1 |
| Stretch 13 Bookmarks / 14 Search / 15 OPML | 5 |
| Stretch 16 Refresh | 6 |
| Stretch 17 Performance | 3 (pagination, skeletons), 10 (audit) |
| Stretch 18 Keyboard | 8 |
| Design: Digest / Layouts | 7 |
| Diff: AI / Accessibility | 9 / 8 |
| Tech: rate limiting, timeouts, redirects, caching headers | 1 (fetcher), 6 (pool, min interval) |

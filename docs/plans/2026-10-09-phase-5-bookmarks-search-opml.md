# Phase 5: Bookmarks, Search, OPML Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use `- [ ]`.
>
> Task 0 copies this file to `RSS-feed-reader/docs/plans/2026-10-09-phase-5-bookmarks-search-opml.md` (worktree `/Users/elshanx/dev/projects/fem-rss-feed-reader`, branch `rss-feed-reader`) and commits it. Paths are relative to `RSS-feed-reader/`.

## Context

Phases 1–4 shipped parsing, accounts, the reading core and feed/category management. Phase 5 covers spec Stretch 13 (bookmarks), 14 (search) and 15 (OPML), per roadmap § Phase 5. It also fixes the Phase 4 `ponytail:` gap: unsubscribing currently deletes saved items.

**Outcome:**
- Save/unsave from the list and reader. `/app/saved` sorts by date saved or published, searches within, and the sidebar shows a count. Saved items survive unsubscribing and stay openable.
- `/app/search`: full-text search over title (weight A) + excerpt (weight B) with highlighted terms, filters by feed, category and date range, results as you type (200 ms debounce), a no-results state, and recent searches in `localStorage`.
- OPML import on `/app/feeds`: upload → preview (duplicates flagged) → import → "X added, Y duplicates skipped, Z invalid". `data/sample-feeds.opml` gives 19 added, 5 duplicates, 1 invalid on a fresh account.
- OPML export at `/api/opml`, grouped by category.

## Global Constraints

- Inherit Phases 1–4: Next 16, Prisma 7, pnpm, airbnb ESLint + Prettier, no comments except non-obvious *why*, no `any`, no new deps. Read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` before writing `/api/opml`.
- Pure modules in `src/lib/opml/` and `src/lib/search/` (relative `.ts` imports, `import type`). Add both globs to `project/node-test-modules` in `eslint.config.mjs`.
- Every query/action scopes by `session.user.id`. Item visibility becomes **subscribed OR saved by this user**; everything else stays subscription-only.
- Item titles/excerpts render as text. Highlights are split on sentinel characters into `<mark>` elements, never `dangerouslySetInnerHTML`.
- Run `pnpm lint` unpiped.

## Review Focus

1. **Saving must not change read state.** Saving an item with no state row inserts `readAt` = NULL only if it is inside the 14-day unread window, else `now()`, so an old item doesn't turn unread. Pinned in Task 3 SQL + Task 7 check.
2. **Saved survives unsubscribe**, and the reader still opens it; the item list, counts and mark-all-read still ignore unsubscribed feeds. Pinned in Tasks 2–3.
3. **Search scoping and injection:** raw user text never reaches `to_tsquery` unescaped. `toTsQuery` keeps only letter/number tokens; the SQL also uses parameters. Results only come from the user's visible items. Pinned in Task 1 tests + Task 3.
4. **OPML hostile input:** file cap 1 MB, at most 200 outlines, each URL goes through `previewFeed` (SSRF guard, 10 s timeout) at concurrency 4. A crafted confirm request can't skip validation because validation runs in the import action itself.
5. **Guest → account** carries `savedAt` too (`guest-link.ts` copy includes the column).

## File Structure

```
prisma/schema.prisma + migration   ItemState.savedAt + @@index([userId, savedAt]); Item.search tsvector (generated) + GIN   (T2)
src/lib/opml/parse.ts(+test)       parseOpml(xml): OpmlEntry[]                                     (T1)
src/lib/opml/plan.ts(+test)        planImport(entries, subscribedUrls): ImportRow[]                 (T1)
src/lib/opml/build.ts(+test)       buildOpml(groups, title): string                                 (T1)
src/lib/search/query.ts(+test)     toTsQuery(raw): string | null; parseSearchParams(params)         (T1)
src/lib/search/highlight.ts(+test) splitHighlights(text): { text, match }[]                         (T1)
src/lib/items.ts        + saved column, setSaved, listSaved, savedCount, searchItems, visibility for reader   (T3)
src/lib/subscriptions.ts  unsubscribe keeps saved rows; importOpml(userId, rows)                     (T2, T6)
src/lib/guest-link.ts     copy savedAt                                                               (T2)
src/app/app/actions.ts    + setSavedAction, searchAction                                              (T3)
src/app/app/saved/page.tsx, src/app/app/search/page.tsx                                              (T4, T5)
src/app/api/opml/route.ts                                                                            (T6)
src/components/ SaveButton.tsx, SearchForm.tsx (client), RecentSearches.tsx, Highlighted.tsx, OpmlImport.tsx (client)
Sidebar.tsx (Saved + count, Search), ItemRow.tsx + reader page (SaveButton), StarterPacks.tsx (Import OPML link)
```

---

### Task 0: Save the plan
- [ ] Copy to `docs/plans/2026-10-09-phase-5-bookmarks-search-opml.md`. Commit: "Add Phase 5 bookmarks, search and OPML plan".

### Task 1: Pure helpers (TDD)
```ts
// opml/parse.ts — htmlparser2 with xmlMode false so attribute names are lowercased (xmlurl === xmlUrl)
export interface OpmlEntry { url: string; title: string | null; category: string | null }
export default function parseOpml(xml: string): OpmlEntry[];
//   outlines with an xmlurl attr are feeds (type optional); title = title ?? text ?? null (entities decoded, trimmed);
//   category = ancestor outline names joined ' / ' ('Nested Category / Subcategory'); root-level feed → null;
//   invalid http(s) URL → kept with url as given (the import marks it invalid); throws OpmlError if no <opml>/<body>
// opml/plan.ts
export type ImportStatus = 'new' | 'duplicate' | 'subscribed';
export interface ImportRow extends OpmlEntry { status: ImportStatus }
export default function planImport(entries: OpmlEntry[], subscribedUrls: string[]): ImportRow[];
//   URL key = new URL(url).href (fallback raw); first occurrence wins; later ones 'duplicate'; already subscribed → 'subscribed'
// opml/build.ts
export default function buildOpml(groups: { name: string | null; feeds: { title: string; url: string; siteUrl: string | null }[] }[], title: string): string;
//   OPML 2.0, XML-escaped attrs, null-name group at root
// search/query.ts
export function toTsQuery(raw: string): string | null;   // 'css grid lay' → 'css & grid & lay:*'; tokens /[\p{L}\p{N}]+/gu, max 8; '' / punctuation-only → null
export interface SearchParams { q: string; feedId: string | null; categoryId: string | null; from: Date | null; to: Date | null }
export function parseSearchParams(params: Record<string, string | string[] | undefined>): SearchParams;  // ids via ID_PATTERN, dates YYYY-MM-DD, `to` inclusive (end of day UTC)
// search/highlight.ts
export const MARK_START = '\u0001', MARK_END = '\u0002';
export default function splitHighlights(text: string): { text: string; match: boolean }[];
```
- [ ] Tests: `parseOpml(readFileSync('data/sample-feeds.opml'))` has 25 entries; the lowercase-attr CSS-Tricks entry, the no-type web.dev entry, the nested Smashing entry (`'Nested Category / Subcategory'`), the minimal Cloudflare entry (`title: null`), `AI & ML` decoded. `planImport` on it with no subscriptions → 20 `new` + 5 `duplicate`; with Simon's URL subscribed → that one `subscribed`. `buildOpml` → `parseOpml` round trip, `<` / `&` / `"` escaped. `toTsQuery` cases incl. `"a' | b:* & !"`, unicode `café`. `splitHighlights` on mixed/none/unterminated markers.
- [ ] Red → implement → `pnpm test` green, lint 0. Commit: "Add OPML parse/plan/build and search query/highlight helpers".

### Task 2: Schema and data rules
- [ ] `ItemState`: add `savedAt DateTime?` and `@@index([userId, savedAt])`. `Item`: add `search Unsupported("tsvector")?` and `@@index([search], type: Gin)`.
- [ ] `pnpm db:migrate --create-only --name saved_and_search`, then edit the SQL so the column is generated:
  `ALTER TABLE "Item" ADD COLUMN "search" tsvector GENERATED ALWAYS AS (setweight(to_tsvector('english', coalesce("title", '')), 'A') || setweight(to_tsvector('english', coalesce("excerpt", '')), 'B')) STORED;` Apply with `pnpm db:migrate`. Then run `pnpm db:migrate` again: it must report no drift (if Prisma wants to re-create the column, fall back to dropping the field from the schema and keeping only the raw-SQL migration + index — note which way in the commit).
- [ ] `guest-link.ts`: include `"savedAt"` in the ItemState copy.
- [ ] `subscriptions.ts` `unsubscribe`: `deleteMany` gets `savedAt: null`; remove the `ponytail:` marker.
- [ ] Typecheck/lint/test. Commit: "Add saved state and a generated search vector, and keep saved items on unsubscribe".

### Task 3: Queries and actions
In `src/lib/items.ts`:
- [ ] `listColumns` + `(st."savedAt" IS NOT NULL) AS saved`; `ListedItem.saved: boolean`.
- [ ] `getItemForUser`: use a `visibleFrom(userId)` variant — `LEFT JOIN "Subscription" s …` + `WHERE (s.id IS NOT NULL OR st."savedAt" IS NOT NULL)`. `getNeighbors` and lists keep `from()`.
- [ ] `setSaved(userId, itemId, saved)`: one statement — `INSERT … SELECT ${userId}, i.id, CASE WHEN i."publishedAt" >= s."createdAt" - interval '14 days' THEN NULL ELSE now() END, ${saved ? now : null} FROM visible … ON CONFLICT DO UPDATE SET "savedAt" = EXCLUDED."savedAt"` (unsave of an unsubscribed item works because the conflict path doesn't need the subscription — use `visibleFrom`).
- [ ] `listSaved(userId, { sort: 'saved' | 'published', q })` — visibility via saved rows, `q` through `toTsQuery` on `i.search`, `LIMIT 500` with `// ponytail: no pagination for saved; cursor on (savedAt, id) if lists grow past 500`.
- [ ] `savedCount(userId)`; add to `getNavigation` output.
- [ ] `searchItems(userId, params, limit = 50)` — `from(userId)` + filters + `i.search @@ to_tsquery('english', ${tsq})`, order `ts_rank` desc then `publishedAt` desc, `ts_headline('english', title|excerpt, query, 'StartSel=\u0001,StopSel=\u0002,HighlightAll=true')` for title and `MaxFragments=2` for excerpt.
- [ ] `src/app/app/actions.ts`: `setSavedAction(itemId, saved)` (ID check, `refresh()`); `searchAction(search: string)` → `searchItems` (used by the client as-you-type).
- [ ] Typecheck/lint. Commit: "Add save, saved list, saved count and full-text search queries".

### Task 4: Bookmark UI + `/app/saved`
- [ ] `SaveButton` (client, `useOptimistic`): bookmark icon filled/outline, `aria-pressed`, sr-only "Save"/"Saved", 36 px (44 coarse). Add to `ItemRow` actions and the reader header.
- [ ] `Sidebar`: under All items, `Saved` (count via `badgeCount`, `aria-current`) and `Search` links. `NavLink` takes an `href` variant if it only accepts filters — check and extend minimally.
- [ ] `/app/saved/page.tsx`: heading with count, sort segmented links (`?sort=saved|published`, `aria-current`), a GET search form (`?q=`), rows reuse `ItemRow` inside `ReadStateProvider`; empty states ("Nothing saved yet — use the bookmark on any item" / "No saved items match"). Reader links carry no `?from` (prev/next falls back to all).
- [ ] Browser/HTTP check. Commit: "Add bookmarks with a Saved view, sorting and in-list search".

### Task 5: `/app/search`
- [ ] Page (server): reads params with `parseSearchParams`, renders `SearchForm` and server results for the initial URL (shareable/back-button friendly).
- [ ] `SearchForm` (client): `type=search` input labelled "Search articles", feed `<select>`, category `<select>`, from/to `<input type=date>`. Debounce 200 ms → `router.replace('?…', { scroll: false })` inside `startTransition`; results region `aria-live=polite` with "N results" / `aria-busy` while pending.
- [ ] `Highlighted` renders `splitHighlights` parts with `<mark className='bg-accent-subtle text-text-primary'>`.
- [ ] No results: "No articles match "q"" + tips (fewer words, clear filters button). Empty query: show `RecentSearches` (last 8 from `localStorage` key `frontpage:recent-searches`, try/catch, saved on result render, clear button).
- [ ] Measure: `EXPLAIN ANALYZE` uses the GIN index; response < 500 ms on the guest data. Commit: "Add full-text search with filters, highlights and recent searches".

### Task 6: OPML import + export
- [ ] `/api/opml/route.ts` GET: `getSession` → 401 if none; `listManagedFeeds` → `buildOpml`; headers `Content-Type: text/x-opml; charset=utf-8`, `Content-Disposition: attachment; filename="frontpage-subscriptions.opml"`.
- [ ] `subscriptions.ts` `importOpml(userId, rows: OpmlEntry[])`: recompute `planImport` against current subscriptions (never trust client statuses), run `previewFeed` on `new` rows with a concurrency-4 pool (copy the `refreshFeeds` worker pattern), then for valid ones upsert Feed, upsert Category by name (position via `nextCategoryPosition`), `createMany skipDuplicates` subscriptions; `after()` → `refreshFeeds`. Returns `{ added, duplicates, invalid: { url, title, message }[] }`.
- [ ] Actions: `previewOpmlAction(_, formData)` — `File` ≤ 1 MB, `parseOpml`, ≤ 200 entries, returns `planImport` rows; `importOpmlAction(rows)` — re-validates shape (strings, http(s)) then `importOpml`.
- [ ] `OpmlImport` (client) in an `id='import'` section on `/app/feeds`: file input → preview table (title or URL, category, status badge with text: New / Duplicate in file / Already following) → "Import N feeds" → pending "Checking N feeds…" → result summary in `aria-live` with the invalid list and messages. An "Export OPML" link to `/api/opml` next to it.
- [ ] `StarterPacks`: add "Import OPML" link to `/app/feeds#import`.
- [ ] Commit: "Add OPML import with preview and results, and OPML export".

### Task 7: Verification
1. `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build` exit 0, unpiped.
2. **Save semantics (psql):** save a 6-month-old item → row has `readAt` set, list shows it read; save a fresh unread item → stays unread. Unsave → `savedAt` null.
3. **Unsubscribe:** save an item, unsubscribe its feed → still in `/app/saved` and opens in the reader; absent from `/app` and counts.
4. **Scoping:** `setSavedAction`/`searchAction` with another user's item ids / feed ids → no rows, no results.
5. **Search:** `css grid`, a prefix (`typescr`), punctuation-only, unicode; filters narrow results; `EXPLAIN` shows the GIN index; timing < 500 ms.
6. **OPML:** fresh account imports `data/sample-feeds.opml` → "19 added, 5 duplicates skipped, 1 invalid" with the 404 message; re-import → 0 added, all duplicates/already following. Export → re-parse gives the same feeds and categories.
7. **Guest → account:** saved items persist after sign-up.
8. Browser walkthrough at 375/1440 if Chrome is connected (else HTTP smoke as in Phase 4), then a fresh-reviewer pass over Phases 4+5 against both Review Focus lists, one fix pass, push, and open the PR.

## Deferred (not Phase 5)
- Phase 6 orphan-feed cleanup must skip feeds whose items are saved, and the 90-day item purge must skip saved items (already in the roadmap; restate in the Phase 6 plan).
- Natural-language/AI search: out of scope. Search over full article body: out (title + excerpt per roadmap).

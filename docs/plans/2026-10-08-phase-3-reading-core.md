# Phase 3: Reading Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.
>
> On approval, Task 0 copies this file to `RSS-feed-reader/docs/plans/2026-10-08-phase-3-reading-core.md` (worktree `/Users/elshanx/dev/projects/fem-rss-feed-reader`, branch `rss-feed-reader`) and commits it. Execution runs from that copy. All paths below are relative to `RSS-feed-reader/`.

## Context

Phases 1–2 shipped the feed library, schema, guests, accounts and a bare `/app` list (50 items, no filters, no read state). Phase 3 turns that into a usable reader. It covers spec Core 3 (browsing), Core 5 (read/unread), Core 6 (article view) and Core 7 (responsive), as the roadmap (`docs/plans/2026-10-08-frontpage-roadmap.md` § Phase 3) defines them.

Three uncommitted fixes from today's debugging sit in the worktree, and Task 0 commits them first:
- `src/lib/feeds/parse.ts` + test: `isTruncated` regex backtracked exponentially on comment-heavy feeds and froze the server.
- `src/components/GuestButton.tsx`: added `router.refresh()` after `push('/app')`, so a stale cached `/app` redirect isn't reused.

**Decision (user, 2026-10-08): the unread baseline is 14 days.** An item counts as unread when it has no `readAt` and either has an explicit state row (the user marked it unread) or was published no more than 14 days before the subscription was created. Older back-catalog items show as read, so a fresh guest sees meaningful counts instead of 99+ everywhere.

**Outcome:**
- A sidebar shows All, categories with nested feeds, unread counts (capped at 99+) and a feed-health line. It collapses on desktop and becomes a drawer on mobile.
- `/app` filters by `?category=`, `?feed=` and `?show=unread`, and scrolls through every item 50 at a time.
- Unread is shown three ways: a dot, heavier text and an sr-only "Unread" label. Opening an item marks it read. Each row has a read/unread toggle.
- Mark all read works globally, per category and per feed. Each is one SQL statement, with a 5 s undo.
- `/app/item/[id]` is the reader view: sanitized content, metadata, "Open original", and prev/next within the list the user came from.

## Global Constraints

- Inherit the roadmap's and Phase 1–2's constraints: Next 16 (async `searchParams`/`params`, `proxy.ts`), Prisma 7, pnpm, airbnb ESLint + Prettier, default export for single-export files, no comments except a non-obvious *why*, no `any`.
- **Read the Next 16 docs before writing route/action code.** In `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/`, read `refresh.md` (`refresh()` from `next/cache`, Server Actions only), `after.md` and `use-router.md`.
- Pure modules go in `src/lib/reading/`. They use relative `.ts` imports and `import type`, never `@/`. Add `src/lib/reading/**/*.ts` to the `project/node-test-modules` glob in `eslint.config.mjs`.
- No new dependencies. Use `IntersectionObserver`, native `<dialog>`, `Intl.RelativeTimeFormat` and `useOptimistic`.
- Every query and action scopes by `session.user.id` through a `JOIN "Subscription" s ON s."userId" = $userId`. An item from a feed the user isn't subscribed to must be invisible and unmodifiable.
- Run `pnpm lint` without piping it; check its exit code.
- Badge counts cap at `99+`. Touch targets are ≥ 44×44 px on coarse pointers. Status never relies on color alone.

## Review Focus

1. **Cross-user access**: `setRead`, `markAllRead`, `loadItems` and the reader page called with another user's `itemId`, `feedId` or `categoryId` must be a no-op or a 404. Pinned in Task 3 (SQL always joins the user's subscriptions) and the Task 8 manual check.
2. **Mark-all-read at scale**: one `INSERT … SELECT … ON CONFLICT` and one undo `UPDATE`, never N queries. Pinned in Task 3. Check it with `psql` on a 1,000+ item user in Task 8.
3. **Unread semantics**: the 14-day window, explicit mark-unread on an old item, and undo restoring exactly the rows it marked. Pinned in Task 3 SQL and Task 8 SQL checks.
4. **Feed HTML in the reader**: `contentHtml` is already sanitized at ingest. Titles and excerpts always render as text, never `dangerouslySetInnerHTML`. Only `contentHtml` uses it. Pinned in Task 6.
5. **Pagination correctness**: no duplicates or gaps when many items share a `publishedAt`. The cursor is `(publishedAt, id)` with a row-value comparison. Pinned in Task 1 (cursor test) and Task 3 SQL.

## File Structure

```
prisma/schema.prisma                + ItemState model, relations on User/Item          (T2)
src/lib/reading/
  filters.ts   parseListFilter(params), filterToSearch(filter)                         (T1)
  cursor.ts    encodeCursor({ publishedAt, id }), decodeCursor(raw)                    (T1)
  format.ts    relativeTime(date, now), badgeCount(n)                                  (T1)
  counts.ts    rollUpCounts(feedCounts, subscriptions)                                 (T1)
  *.test.ts
src/lib/items.ts        listItems, getItemForUser, getNeighbors, unreadCounts, getNavigation,
                        markAllRead, undoMarkAllRead, setRead   [server-only]          (T3)
src/lib/guest-link.ts   + move ItemState rows                                          (T2)
src/app/app/actions.ts  'use server': loadItems, setReadAction, markAllReadAction, undoMarkAllReadAction (T3)
src/app/app/layout.tsx  shell grid: header + Sidebar + main                            (T4)
src/app/app/page.tsx    filters from searchParams, title per filter                    (T5)
src/app/app/item/[id]/page.tsx  reader view                                            (T6)
src/components/
  Sidebar.tsx (server), SidebarShell.tsx (client: collapse + <dialog> drawer), NavLink.tsx (client, aria-current) (T4)
  ItemList.tsx (server, existing: keep refresh logic, render ItemFeed)                 (T5)
  ItemFeed.tsx (client: pages, sentinel, read overrides), ItemRow.tsx, FeedIcon.tsx,
  ItemListSkeleton.tsx, MarkAllRead.tsx (button + undo toast)                          (T5)
  MarkReadOnView.tsx, ReaderNav.tsx                                                    (T6)
src/app/globals.css     .reader-content prose rules, row content-visibility            (T5, T6)
```

---

### Task 0: Commit pending fixes and save the plan

- [ ] Commit `src/lib/feeds/parse.ts` + `parse.test.ts`: "Make truncation check linear so comment-heavy feeds can't freeze the server".
- [ ] Commit `src/components/GuestButton.tsx`: "Refresh the router after guest sign-in so a cached /app redirect isn't reused".
- [ ] Copy this plan to `docs/plans/2026-10-08-phase-3-reading-core.md` and commit: "Add Phase 3 reading core plan".

### Task 1: Pure reading helpers (TDD)

**Files:** create `src/lib/reading/{filters,cursor,format,counts}.ts` and their tests. Update the `eslint.config.mjs` glob.

**Produces:**
```ts
// filters.ts
export type ListFilter =
  | { kind: 'all'; unreadOnly: boolean }
  | { kind: 'category'; id: string | null; unreadOnly: boolean }   // id null = Uncategorized
  | { kind: 'feed'; id: string; unreadOnly: boolean };
export function parseListFilter(params: Record<string, string | string[] | undefined>): ListFilter;
//   ?feed wins over ?category; ?category=uncategorized → id null; ?show=unread → unreadOnly; arrays take first value; ids must match /^[\w-]{1,64}$/ else 'all'
export function filterToSearch(filter: ListFilter): string;   // '' | '?category=…&show=unread' — inverse of parseListFilter
// cursor.ts
export interface Cursor { publishedAt: Date; id: string }
export function encodeCursor(cursor: Cursor): string;          // base64url of `${iso}|${id}`
export function decodeCursor(raw: string | null | undefined): Cursor | null;   // null on any garbage
// format.ts
export function relativeTime(date: Date, now: Date): string;   // 'just now' <1 min, '5m ago', '3h ago', 'yesterday', '4d ago', else 'Mar 3' / 'Mar 3, 2025' (other year)
export function badgeCount(n: number): string;                 // '' for 0, '1'…'99', '99+'
// counts.ts
export interface NavCounts { total: number; byFeed: Record<string, number>; byCategory: Record<string, number>; uncategorized: number }
export default function rollUpCounts(
  feedCounts: { feedId: string; count: number }[],
  subscriptions: { feedId: string; categoryId: string | null }[]
): NavCounts;   // ignores feedIds without a subscription
```

- [ ] **Step 1: write the failing tests.** Cover:
  - **filters:** the round trip `parseListFilter(Object.fromEntries(new URLSearchParams(filterToSearch(f))))` deep-equals `f` for all 4 shapes; feed wins over category; a bad id (`'../x'`, 65 chars) falls back to all; arrays use the first value.
  - **cursor:** round trip; two cursors with the same date and different ids differ; `decodeCursor` returns null for `'@@'`, `''`, `null`, a valid base64 string without `|`, and an invalid date.
  - **format:** each `relativeTime` bucket at a fixed `now`, a same-year date vs. an other-year date, and `badgeCount(0, 7, 99, 100, 5000)`.
  - **counts:** total equals the sum, category sums, the uncategorized bucket, and an unknown feedId ignored.
- [ ] **Step 2:** run `node --test src/lib/reading/*.test.ts`. Expected: FAIL, modules missing.
- [ ] **Step 3:** implement. `relativeTime` uses `Intl.RelativeTimeFormat('en', { numeric: 'auto', style: 'narrow' })` for the m/h/d buckets and `Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year?: 'numeric' })` past 7 days.
- [ ] **Step 4:** `pnpm test` is green and `pnpm lint` exits 0. Commit: "Add list filter, cursor, relative time and unread roll-up helpers".

### Task 2: ItemState table and guest carry-over

- [ ] Add to `prisma/schema.prisma`:
```prisma
model ItemState {
  userId String
  user   User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  itemId String
  item   Item      @relation(fields: [itemId], references: [id], onDelete: Cascade)
  readAt DateTime?

  @@id([userId, itemId])
  @@index([itemId])
}
```
  Also add `states ItemState[]` to `User` and `Item`. (Phase 5 adds `savedAt` and its index. No speculative columns now.) A row with `readAt = null` means **explicitly unread**.
- [ ] Run `pnpm db:migrate --name item_state`.
- [ ] `src/lib/guest-link.ts`: inside the existing transaction, after subscriptions, run
  `tx.$executeRaw\`INSERT INTO "ItemState" ("userId","itemId","readAt") SELECT ${toUserId}, "itemId", "readAt" FROM "ItemState" WHERE "userId" = ${fromUserId} ON CONFLICT DO NOTHING\``.
  The target account's existing state wins. Update the ponytail comment so only Preference is still pending (Phase 6).
- [ ] `pnpm typecheck` exits 0. Commit: "Add per-user item read state and carry it over on guest sign-up".

### Task 3: Reading queries and Server Actions

**Files:** rewrite `src/lib/items.ts` (keep `feedsToRefresh`). Create `src/app/app/actions.ts`.

All reads go through **one SQL builder** so the list, counts, neighbors and mark-all can't disagree about scoping or unread:
```ts
const UNREAD_WINDOW = Prisma.sql`interval '14 days'`;
const base = (userId: string) => Prisma.sql`
  FROM "Item" i
  JOIN "Subscription" s ON s."feedId" = i."feedId" AND s."userId" = ${userId}
  LEFT JOIN "ItemState" st ON st."itemId" = i.id AND st."userId" = ${userId}`;
const isUnread = Prisma.sql`(st."readAt" IS NULL AND (st."userId" IS NOT NULL OR i."publishedAt" >= s."createdAt" - ${UNREAD_WINDOW}))`;
const filterSql = (f: ListFilter) =>  // category id null → s."categoryId" IS NULL
  Prisma.sql`${f.kind === 'feed' ? Prisma.sql`AND i."feedId" = ${f.id}` : f.kind === 'category' ? (f.id ? Prisma.sql`AND s."categoryId" = ${f.id}` : Prisma.sql`AND s."categoryId" IS NULL`) : Prisma.empty} ${f.unreadOnly ? Prisma.sql`AND ${isUnread}` : Prisma.empty}`;
```
Functions (all `userId`-first):
- `listItems(userId, filter, cursor | null)`: `SELECT i.id, i.title, i.url, i.excerpt, i."publishedAt", i."imageUrl", (i."contentHtml" IS NOT NULL) AS "hasContent", i."feedId", COALESCE(s.title, f.title) AS "feedTitle", f."iconUrl", ${isUnread} AS unread` + `JOIN "Feed" f` + filter + `AND (i."publishedAt", i.id) < (${c.publishedAt}, ${c.id})` when there's a cursor + `ORDER BY i."publishedAt" DESC, i.id DESC LIMIT 51`. Returns `{ items: first 50, nextCursor }`.
- `getItemForUser(userId, itemId)`: a full row with `contentHtml`, `author` and the feed's `siteUrl`, or `null`.
- `getNeighbors(userId, filter, { publishedAt, id })`: two `LIMIT 1` queries. Newer uses `>` with `ASC`, older uses `<` with `DESC`. Returns `{ prevId, nextId }`.
- `unreadCounts(userId)`: `SELECT i."feedId", count(*)::int AS count ${base} WHERE ${isUnread} GROUP BY i."feedId"`.
- `getNavigation(userId)`: categories (ordered by `position`) with subscriptions + feed (title, iconUrl and the `feedHealth` inputs), plus `rollUpCounts(await unreadCounts(userId), subs)` and a health tally from `feedHealth()` (`src/lib/feeds/health.ts`).
- `setRead(userId, itemId, read)`: `INSERT INTO "ItemState" SELECT ${userId}, i.id, ${read ? now : null} FROM "Item" i JOIN "Subscription" s … WHERE i.id = ${itemId} ON CONFLICT ("userId","itemId") DO UPDATE SET "readAt" = EXCLUDED."readAt"`. Inserting zero rows means not subscribed, which is a no-op.
- `markAllRead(userId, filter)`: `const markedAt = new Date()`, then `INSERT INTO "ItemState" ("userId","itemId","readAt") SELECT ${userId}, i.id, ${markedAt} ${base} WHERE ${isUnread} ${filterSql} ON CONFLICT ("userId","itemId") DO UPDATE SET "readAt" = EXCLUDED."readAt"`. Returns `{ count, markedAt }`.
- `undoMarkAllRead(userId, markedAt)`: `UPDATE "ItemState" SET "readAt" = NULL WHERE "userId" = ${userId} AND "readAt" = ${markedAt}`. Those rows were unread before, so explicit-unread is exactly right.

`actions.ts` (`'use server'`):
- Each action calls `requireUser()` (`src/lib/session.ts`).
- Each one validates its input: filter via `parseListFilter`, cursor via `decodeCursor`, ids via the same id regex.
- Mutations end with `refresh()` from `next/cache` so the sidebar counts re-render.
- `loadItems(search, cursor)` returns serialized rows and `nextCursor`.

- [ ] Implement it, then check it with `pnpm typecheck`.
- [ ] **SQL sanity (psql, guest user):** `EXPLAIN` the list query uses `Item_feedId_publishedAt_idx`. The mark-all + undo round trip leaves the unread count unchanged.
- [ ] Commit: "Add scoped item queries, unread counts and read-state actions".

### Task 4: App shell and sidebar

- [ ] `src/app/app/layout.tsx`:
  - Keep `requireUser`, `GuestBanner` and the header.
  - Add a menu button in the header (mobile only). It opens the drawer.
  - Below the header, a grid: `SidebarShell` holding `<Sidebar userId>`, then `{children}`.
  - The desktop sidebar is `--sidebar-width`, sticky and scrolls independently.
- [ ] `Sidebar.tsx` (server) calls `getNavigation(userId)` and renders `<nav aria-label='Feeds'>`:
  - "All items" with the total.
  - Each category, with its feeds nested under a native `<details open>` and a `FeedIcon` per feed.
  - An "Uncategorized" group, shown only when it has feeds.
  - Each count goes through `badgeCount`, with an sr-only label like "12 unread".
  - A footer health line, e.g. "2 feeds need attention" (warning icon + text). It links to `/app/feeds` in Phase 4; for now it's plain text.
- [ ] `NavLink.tsx` (client) compares `usePathname()` + `useSearchParams()` to its href and sets `aria-current='page'` plus an active style.
- [ ] `SidebarShell.tsx` (client):
  - **≥ 64rem:** a collapse toggle (`aria-expanded`). The collapsed state persists in `localStorage` inside try/catch.
  - **< 64rem:** the sidebar renders inside a `<dialog>` opened with `showModal()` from the header button. Esc and backdrop close it natively, and it also closes on `pathname`/`searchParams` change. Focus returns to the menu button.
- [ ] Browser check at 375 px, 768 px and 1280 px. Commit: "Add app shell with sidebar, unread counts and mobile drawer".

### Task 5: Item list, pagination, read state, mark all read

- [ ] `page.tsx` awaits `searchParams`, then calls `parseListFilter`. `generateMetadata` titles the page by filter (e.g. "Frontend", "Unread · All items"). The `<h1>` matches. An "All / Unread" segmented link pair toggles `?show=unread`.
- [ ] `ItemList.tsx` keeps its refresh logic (`feedsToRefresh`, `refreshFeeds`, `after`, 8 s wait). It then calls `listItems(userId, filter, null)` and renders `<ItemFeed initial={…} filter={search} now={Date.now()} />`. The empty state is filter-aware: "No unread items here" with a "Show all" link, or "Your feeds are still loading".
- [ ] `ItemFeed.tsx` (client):
  - Keeps `pages` state and a `readOverrides` map driven by `useOptimistic`.
  - A sentinel `<div>` watched by `IntersectionObserver` (`rootMargin: '600px'`) calls `loadItems` and then appends.
  - A "Load more" button is the no-JS / failure fallback.
  - The `key` is the filter string, so changing filters resets the state.
- [ ] `ItemRow.tsx`:
  - Shows `FeedIcon`, the title, the feed title (source), `<time dateTime title={full date}>{relativeTime(publishedAt, now)}</time>` and a two-line excerpt.
  - Unread items get the dot + `font-semibold` + sr-only "Unread". Read items get `text-text-secondary`, with a 150 ms color transition (none under `prefers-reduced-motion`).
  - The title links to `/app/item/{id}{filter}`. An "Open original" icon link (`target=_blank`, sr label) shows when `url` exists. Both mark the item read optimistically and call `setReadAction`.
  - A toggle button reads "Mark as read" / "Mark as unread" (`aria-pressed` is not used, because the label carries the state). It's ≥ 44 px on coarse pointers.
  - The row style uses `content-visibility: auto; contain-intrinsic-size: auto 7rem`.
- [ ] `FeedIcon.tsx` (client) renders a 16 px `<img loading='lazy' alt=''>` and falls back `onError` to a monogram (first letter on `bg-bg-tertiary`). Add a targeted `eslint-disable-next-line @next/next/no-img-element` with a *why*: arbitrary remote favicon hosts.
- [ ] `ItemListSkeleton.tsx` renders 8 rows the same height as the real ones. It replaces the current Suspense fallback text.
- [ ] `MarkAllRead.tsx` (client):
  - The button label follows the filter: "Mark all read", "Mark Frontend read" or "Mark <feed> read".
  - It runs `markAllReadAction` and sets every visible row read optimistically.
  - It then shows a toast in an `aria-live='polite'` region, "Marked 37 items read · Undo", for 5 s. Undo calls `undoMarkAllReadAction(markedAt)`.
- [ ] Browser check: scroll through 100+ items with no duplicates, the read toggle, the counts update in the sidebar, and mark-all + undo. Commit: "Add paginated item feed with read state and mark-all-read undo".

### Task 6: Reader view

- [ ] `src/app/app/item/[id]/page.tsx`:
  - Await `params`/`searchParams`, call `getItemForUser`, and use `notFound()` when it returns null. `generateMetadata` gives the item title.
  - Layout: an `<article>` at `max-w-(--content-max-width)`, with the title as `<h1>` and a meta line (feed title · author · `<time>` full date). An "Open original ↗" link opens in a new tab.
  - With content: `<div className='reader-content' dangerouslySetInnerHTML={{ __html: contentHtml }} />`. This is the only raw-HTML sink, and the content was sanitized at ingest.
  - Excerpt only: the excerpt as text, plus a prominent "Read the full article on <site>" link.
  - `ReaderNav` at top and bottom has "← Back to list" (`/app{from}`), "Newer" and "Older" from `getNeighbors(userId, parseListFilter(searchParams), item)`, and preserves `from`.
  - `<MarkReadOnView id={id} />` (client) calls `setReadAction(id, true)` once in `useEffect`. This happens on view, not during render, so link prefetches don't mark items read.
- [ ] `.reader-content` in `globals.css`:
  - Georgia (`--font-serif`), 1.125rem, leading 1.7.
  - `h2–h6` scale; `img, video, picture { max-width: 100%; height: auto }`.
  - `pre { overflow-x: auto }`; `code` uses `--font-mono`.
  - Tables in a scroll wrapper via `display:block; overflow-x:auto`; blockquote border; link underline.
- [ ] Browser check: a full-content item (e.g. a Smashing or CSS-Tricks feed), an excerpt-only item, prev/next under `?show=unread`, and 200% zoom with no horizontal scroll. Commit: "Add reader view with metadata, original link and in-context prev/next".

### Task 7: Responsive and accessibility pass

- [ ] Check 320 px, 375 px, 768 px, 1024 px and 1440 px for no horizontal scroll (`document.documentElement.scrollWidth <= innerWidth`). Also check at 200% zoom.
- [ ] Do a keyboard-only pass: skip link → main, the sidebar in tab order, a drawer focus trap via `<dialog>`, a visible focus ring everywhere, and the toast announced.
- [ ] Contrast: the unread dot and the read text color meet AA against both themes' backgrounds (tokens are already contrast-fixed).
- [ ] Commit any fixes: "Polish responsive layout and focus handling for reading views".

### Task 8: Verification (end of phase)

1. `pnpm test`: the existing 51 plus the Task 1 tests, all green. `pnpm lint`, `pnpm typecheck` and `pnpm build` each exit 0, unpiped.
2. **Scoping:** as guest A, call `setReadAction` with an `itemId` from a feed only guest B subscribes to (through the browser console form action or a temporary page). Expect no `ItemState` row. `/app/item/<that id>` returns 404. `?feed=<B's feed>` shows the empty state.
3. **Scale:** `psql` confirms global mark-all on a guest with 1,000+ items runs as one `INSERT` (check the dev log query count, or `pg_stat_statements` if it's enabled). Undo restores the exact prior unread count.
4. **Unread window:** a fresh guest's counts only include items from the last 14 days before sign-up. Mark-unread on a 6-month-old item makes it unread and counted.
5. **Guest → account:** read some items as a guest, sign up, and the read state persists.
6. Browser walk-through of Tasks 4–6 at mobile and desktop widths.
7. Final whole-branch review (fresh reviewer) against Review Focus, then one TDD fix pass. Open a PR for Phase 3.

## Deferred (not Phase 3)

- Feed/category management, the `/app/feeds` health dashboard, and starter-pack empty states: Phase 4.
- `savedAt`, Saved and Search in nav: Phase 5. The sidebar gets entries then, not dead links now.
- Cross-tab sync on `visibilitychange`, and polling: Phase 6.
- Layout variants and split pane: Phase 7. Keyboard shortcuts: Phase 8.

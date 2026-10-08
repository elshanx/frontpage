# Phase 6: Refresh & Polling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use `- [ ]`.
> Worktree `/Users/elshanx/dev/projects/fem-rss-feed-reader`, branch `rss-feed-reader`. Paths relative to `RSS-feed-reader/`.

## Context

Phases 1–5 shipped. Feeds today refresh only as a side effect of opening `/app` (`ItemList` → `feedsToRefresh` → `after(refreshFeeds)`), or via the per-feed Retry on `/app/feeds`. There is no way to refresh on demand from the reading view, no sign that new items have arrived without reloading, no "last updated", and the daily cron only purges guests, so orphan feeds and old items grow forever. Phase 6 covers Stretch 16 and the Core 8 retry wiring (roadmap § Phase 6), plus the Phase 5 deferral: purges must keep saved items.

**Outcome:**
- A "Refresh" button in the `/app` toolbar refreshes the feeds in the current view (all, a category or one feed), forced, honouring the existing 60 s minimum per feed. It shows a spinner without blocking the page, and an `aria-live` message reports "Refreshed N feeds · M new items".
- "Updated 4 min ago" next to it (max `lastSuccessAt` of feeds in scope, `<time>` with full date in `title`).
- A refresh-interval preference (15 / 30 / 60 min / Manual, default 30) on a new minimal `/app/settings`. The client polls a cheap `checkNewItems(search, since)` action on that interval and when the tab becomes visible again. A "Show 5 new items" banner prepends them into the list without moving the scroll position.
- The daily cron also refreshes due feeds, deletes orphan feeds (no subscribers **and** no saved items), and deletes items older than 90 days that nobody saved.

## Assumptions (say so if wrong)
- `Preference` doesn't exist yet. Phase 6 creates it with only `refreshMinutes` (0 = manual). Phases 7/8 add their own columns. `/app/settings` holds just this one control for now.
- "Per-feed refresh" = the toolbar button scoped to `?feed=`, plus the existing Retry on `/app/feeds`. No new per-row button.
- "New" = `Item.createdAt > since` (when we stored it), not `publishedAt`, so a backfilled old item still counts once.
- Refresh all runs inside the action (awaited, pool of 6, 10 s per feed) instead of `after()` + progress polling. That way the result message is real. Worst case for ~100 feeds ≈ 17 rounds × 10 s, which fits Vercel's function limit. `ponytail:` note: switch to `after()` + polling `lastFetchedAt` if users exceed ~150 feeds.

## Global Constraints
Inherit Phases 1–5: Next 16 (read `node_modules/next/dist/docs/` for `after`, route handlers and `maxDuration` before using them), Prisma 7, pnpm, airbnb ESLint + Prettier, no comments except the non-obvious *why*, no `any`, no new deps. Every query scopes by `session.user.id`. Run `pnpm lint` unpiped.

## Review Focus
1. **Purges never delete saved items** or feeds that have saved items. Pinned by the SQL in Task 4 and the psql check in Task 6.
2. **Refresh can't be abused:** feed ids come from the user's own subscriptions (never from the client). `force` still goes through `claim()`'s 60 s floor, so hammering the button is a no-op.
3. **Polling is cheap:** one indexed count query per poll, no polling when the tab is hidden or on Manual, at most one check per 60 s on focus.
4. **New-items insert keeps scroll:** prepend + dedupe by id. Rely on browser scroll anchoring (`overflow-anchor`), and verify in the browser.

## File Structure
```
prisma/schema.prisma + migration  Preference(userId @id → User cascade, refreshMinutes Int @default(30)) (T1)
src/lib/reading/refresh-interval.ts(+test)  REFRESH_OPTIONS, parseRefreshMinutes(value): number | null   (T1)
src/lib/guest-link.ts             move the Preference row on guest → account (skip if target has one)  (T1)
src/lib/items.ts                  feedIdsInScope(userId, filter), lastUpdated(userId, filter),
                                  countNewItems(userId, filter, since), listNewItems(userId, filter, since)  (T2)
src/lib/refresh.ts                refreshFeeds returns nothing new; caller counts items via createdAt   (unchanged)
src/app/app/actions.ts            refreshAction(search), checkNewItems(search, since), loadNewItems(search, since)  (T2)
src/components/RefreshButton.tsx  (client) button + aria-live result + "Updated x ago"             (T3)
src/components/ItemFeed.tsx       poll loop + new-items banner + prepend                            (T3)
src/app/app/page.tsx              toolbar wiring, pass refreshMinutes                               (T3)
src/app/app/settings/page.tsx + actions.ts   refresh-interval radio group form                      (T3)
src/components/Sidebar.tsx        Settings link                                                     (T3)
src/lib/maintenance.ts            refreshDueFeeds(now), purgeOrphanFeeds(), purgeOldItems(now)       (T4)
src/app/api/cron/maintenance/route.ts   call them, return counts                                     (T4)
```

---

### Task 0: Save the plan
- [ ] Copy to `docs/plans/2026-10-09-phase-6-refresh-polling.md`. Commit: "Add Phase 6 refresh and polling plan".

### Task 1: Preference + interval helper (TDD)
- [ ] `refresh-interval.ts`: `REFRESH_OPTIONS = [15, 30, 60, 0] as const`; `parseRefreshMinutes(raw: unknown)` → a member or `null`. Test: valid strings and numbers, `'45'`, `''`, `'abc'`, `-1` → null. Add the glob to `project/node-test-modules` in `eslint.config.mjs` if `src/lib/reading/**` isn't already covered.
- [ ] Schema `Preference { userId String @id; user User @relation(cascade); refreshMinutes Int @default(30) }` + `User.preference Preference?`. `pnpm db:migrate --name preference`.
- [ ] `getRefreshMinutes(userId)` (missing row → 30) and `setRefreshMinutes(userId, m)` (upsert) in a new small `src/lib/preferences.ts`.
- [ ] `guest-link.ts`: copy the guest's Preference row to the new user `ON CONFLICT DO NOTHING`.
- [ ] Test/typecheck/lint. Commit: "Add refresh interval preference".

### Task 2: Queries + actions
- [ ] `items.ts`:
  - `feedIdsInScope(userId, filter)`: `SELECT DISTINCT s."feedId" FROM "Subscription" s WHERE s."userId" = … ${scope}`. Reuse `scopeSql` (it uses `i."feedId"` for the feed case, so add a small variant or join `Item`-free by mapping the feed case to `s."feedId"`).
  - `lastUpdated(userId, filter)`: `max(f."lastSuccessAt")` over those subscriptions.
  - `countNewItems(userId, filter, since)`: `SELECT count(*)::int ${from(userId)} WHERE i."createdAt" > ${since} ${filterSql(filter)}`.
  - `listNewItems(userId, filter, since)`: `listColumns` with the same where, ordered `publishedAt DESC`, `LIMIT 100`.
- [ ] `actions.ts`:
  - `refreshAction(search)`: `requireUser`, `feedIdsInScope`, `since = new Date()`, `await refreshFeeds(ids, { force: true })`, then `countNewItems(since)` → `{ feeds: ids.length, newItems }`. `refresh()`.
  - `checkNewItems(search, since: number)`: validate the number; `after(() => refreshFeeds(due ids in scope))` reusing `feedsToRefresh`; return `countNewItems`.
  - `loadNewItems(search, since)`: return `{ items: listNewItems(...), fetchedAt: Date.now() }`.
- [ ] Typecheck/lint. Commit: "Add scoped refresh, new-item count and new-item list actions".

### Task 3: UI
- [ ] `RefreshButton` (client): lucide `RefreshCw` icon + "Refresh" text, `useTransition`, icon spins (`motion-safe:animate-spin`) while pending, button stays enabled for the rest of the page. Result in a `role='status'` span: "Refreshed 19 feeds · 7 new items" / "Already up to date". Shows `Updated <relative>` from the server prop, reusing `src/lib/reading/format.ts` relative-time helpers. Min 44 px on coarse pointers.
- [ ] `ItemFeed`: new props `refreshMinutes`. `since` ref starts at `initial.fetchedAt`. An effect sets `setInterval(check, minutes * 60_000)` when `minutes > 0`, skipping when `document.hidden`. A `visibilitychange` → visible triggers `check` if the last check was ≥ 60 s ago (also on Manual? **no**: Manual means no automatic checks). `check` → `checkNewItems(search, since)` → `newCount`.
  Banner (sticky top, `role='status'`): "Show N new items" button → `loadNewItems` → merge into `items` (dedupe by id, re-sort by `publishedAt` desc, id desc), `since = fetchedAt`, `newCount = 0`, announce "N new items added". Also after `RefreshButton` succeeds, `router.refresh()` is enough because the server list re-renders. Check: `ReadStateProvider key={search}` must not reset ItemFeed state unexpectedly.
- [ ] `/app/page.tsx`: fetch `getRefreshMinutes` + `lastUpdated` alongside the label; put `RefreshButton` beside `MarkAllRead`; pass `refreshMinutes` through `ItemList` → `ItemFeed`.
- [ ] `/app/settings/page.tsx` + `settings/actions.ts`: `<form action>` with a `fieldset`/`legend` "Check for new items" and 4 radio inputs (Every 15 min / 30 min / hour / Manually only), submit "Save", `useActionState`-free server action → `parseRefreshMinutes` → `setRefreshMinutes` → `refresh()`. Show "Saved" via a `?saved=1` redirect or a status message. Sidebar footer gets a "Settings" `NavLink` with `aria-current`.
- [ ] Browser check. Commit: "Add refresh button, last-updated time, new-item polling and settings".

### Task 4: Maintenance cron
- [ ] `src/lib/maintenance.ts`:
  - `refreshDueFeeds(now)`: ids of feeds with ≥ 1 subscription and `nextFetchAt <= now`, `take: 300`, then `refreshFeeds(ids)`. `// ponytail: capped at 300 per run; page through or fan out if the daily cron starts timing out`.
  - `purgeOrphanFeeds()`: `DELETE FROM "Feed" f WHERE NOT EXISTS (subscription) AND NOT EXISTS (SELECT 1 FROM "Item" i JOIN "ItemState" st ON st."itemId" = i.id WHERE i."feedId" = f.id AND st."savedAt" IS NOT NULL)`.
  - `purgeOldItems(now)`: `DELETE FROM "Item" i WHERE i."publishedAt" < now - 90d AND i."createdAt" < now - 90d AND NOT EXISTS (saved state)`. Known tradeoff: a feed whose XML still lists a purged item re-inserts it on the next fetch, and it comes back unread only if inside the 14-day unread window, which it isn't, so it shows as read. `// ponytail: purged items can be re-inserted if still in the feed XML; tombstone guids if that matters`.
- [ ] Route: order guests → orphan feeds → old items → refresh due; return `{ purgedGuests, purgedFeeds, purgedItems, refreshed }`. Set `export const maxDuration = 300` after checking the Next 16 docs.
- [ ] Commit: "Refresh due feeds and purge orphan feeds and old unsaved items in the daily cron".

### Task 5: README
- [ ] Add a "Refresh & polling" decisions section: on-demand + polling + daily cron (Hobby limit), the 60 s floor, why `createdAt` defines "new", the purge rules and the re-insert tradeoff.
- [ ] Commit: "Document refresh and retention decisions".

### Task 6: Verification
1. `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, all exit 0, unpiped.
2. **Refresh:** click Refresh on All → status message with counts; click again within 60 s → "Already up to date", no fetches (check `lastFetchedAt` unchanged in psql). Scoped to `?feed=` → only that feed's `lastFetchedAt` moves.
3. **Polling:** set the interval to 15 min, then in psql `UPDATE "Item" SET "createdAt" = now()` on 3 items of a subscribed feed (or insert test rows) → trigger a focus check (hide/show the tab after 60 s) → banner "Show 3 new items" → click → rows appear, scroll position unchanged at mid-list. Manual → no `checkNewItems` requests in the network log.
4. **Scoping:** `refreshAction`/`checkNewItems` with another user's `?feed=` id → 0 feeds, count 0.
5. **Cron (psql + curl with `CRON_SECRET`):** an orphan feed with a saved item survives, one without is deleted. A 100-day-old unsaved item is deleted, a saved one survives. 401 without the header.
6. **Guest → account:** set the interval as a guest, sign up → preference kept.
7. Browser pass at 375/1440 if Chrome is connected (else HTTP smoke), then a fresh-reviewer pass against Review Focus, one fix pass, push, open the PR.

## Deferred
- Server push (SSE/websockets) instead of polling: out. Polling at ≥ 15 min is cheap.
- Per-category refresh intervals: out (same reasoning as per-category layouts).
